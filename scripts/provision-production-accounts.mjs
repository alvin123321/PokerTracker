import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl =
  process.env.SUPABASE_URL ?? 'https://rfyaqfecnkwrlcdfmmaj.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const playerPassword = process.env.PLAYER_DEFAULT_PASSWORD ?? '123456';
const hostPassword = process.env.HOST_PASSWORD ?? 'admin1223';

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Set it in this terminal, then rerun this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: {
    transport: WebSocket
  }
});

const normalizeDisplayName = (name) => name.trim().replace(/\s+/g, ' ');
const usernameFromDisplayName = (displayName) => {
  const baseUsername = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return baseUsername.length >= 3 ? baseUsername : null;
};

const findAuthUserByEmail = async (email) => {
  const perPage = 1000;

  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const found = data.users.find((user) => user.email?.toLowerCase() === email);

    if (found || data.users.length < perPage) {
      return found ?? null;
    }
  }

  return null;
};

const ensureAuthUser = async ({ username, displayName, role, password }) => {
  const email = `${username}@pokertrack.local`;
  const existingUser = await findAuthUserByEmail(email);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
        role
      }
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
      role
    }
  });

  if (error) {
    throw error;
  }

  return data.user;
};

const upsertProfile = async ({ userId, username, displayName, role }) => {
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      username,
      display_name: displayName,
      role
    },
    {
      onConflict: 'id'
    }
  );

  if (error) {
    throw error;
  }
};

const linkPlayerRows = async ({ userId, playerIds }) => {
  for (const playerId of playerIds) {
    const { error } = await supabase.from('players').update({ user_id: userId }).eq('id', playerId);

    if (error) {
      throw error;
    }
  }
};

const ensureAccount = async ({ username, displayName, role, password, playerIds = [] }) => {
  const user = await ensureAuthUser({ username, displayName, role, password });

  if (!user?.id) {
    throw new Error(`Unable to create ${username}.`);
  }

  await upsertProfile({ userId: user.id, username, displayName, role });

  if (playerIds.length > 0) {
    await linkPlayerRows({ userId: user.id, playerIds });
  }

  return { username, displayName, role, linkedPlayers: playerIds.length };
};

const main = async () => {
  const created = [];

  created.push(
    await ensureAccount({
      username: 'admin1223',
      displayName: 'Admin',
      role: 'HOST',
      password: hostPassword
    })
  );

  const { data: playerRows, error: playersError } = await supabase
    .from('players')
    .select('id,name,user_id')
    .order('name', { ascending: true });

  if (playersError) {
    throw playersError;
  }

  const playersByUsername = new Map();

  for (const player of playerRows ?? []) {
    const displayName = normalizeDisplayName(player.name ?? '');
    const username = usernameFromDisplayName(displayName);

    if (!username) {
      console.warn(`Skipping player with invalid login name: ${player.name}`);
      continue;
    }

    const entry =
      playersByUsername.get(username) ??
      {
        username,
        displayName,
        playerIds: []
      };

    entry.playerIds.push(player.id);
    playersByUsername.set(username, entry);
  }

  for (const player of playersByUsername.values()) {
    if (player.username === 'admin1223') {
      continue;
    }

    created.push(
      await ensureAccount({
        username: player.username,
        displayName: player.displayName,
        role: 'PLAYER',
        password: playerPassword,
        playerIds: player.playerIds
      })
    );
  }

  console.table(created);
  console.log(`Provisioned ${created.length} production account(s).`);
  console.log(`Host password: ${hostPassword}`);
  console.log(`Player password: ${playerPassword}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
