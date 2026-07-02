import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateRegisteredPlayerRequest {
  displayName?: string;
  username?: string;
}

interface UserProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  role: 'HOST' | 'PLAYER';
}

const defaultPassword = '123456';
const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const displayNameMaxLength = 80;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });

const normalizeUsername = (username: string) => username.trim().toLowerCase();
const normalizeDisplayName = (displayName: string) => displayName.trim().replace(/\s+/g, ' ');
const usernameFromDisplayName = (displayName: string) => {
  const baseUsername = normalizeUsername(displayName)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return baseUsername.length >= 3 ? baseUsername : `player-${crypto.randomUUID().slice(0, 8)}`;
};
const usernameWithSuffix = (username: string, suffix: string) => {
  const maxBaseLength = 32 - suffix.length - 1;
  return `${username.slice(0, maxBaseLength)}-${suffix}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase function environment is not configured.' }, 500);
  }

  const authorization = req.headers.get('Authorization');

  if (!authorization) {
    return json({ error: 'Authentication required.' }, 401);
  }

  let payload: CreateRegisteredPlayerRequest;

  try {
    payload = (await req.json()) as CreateRegisteredPlayerRequest;
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  const displayName = normalizeDisplayName(payload.displayName ?? payload.username ?? '');

  if (displayName.length === 0 || displayName.length > displayNameMaxLength) {
    return json({ error: 'Player name must be 1-80 characters.' }, 400);
  }

  let username = normalizeUsername(payload.username ?? usernameFromDisplayName(displayName));

  if (!usernamePattern.test(username)) {
    return json(
      {
        error:
          'Player login must be 3-32 characters and use only letters, numbers, underscore, or hyphen.'
      },
      400
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization
      }
    },
    auth: {
      persistSession: false
    }
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const {
    data: { user },
    error: userError
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: 'Authentication required.' }, 401);
  }

  const { data: hostProfile, error: hostError } = await userClient
    .from('users')
    .select('id,role')
    .eq('id', user.id)
    .single();

  if (hostError || hostProfile?.role !== 'HOST') {
    return json({ error: 'Host privileges required.' }, 403);
  }

  const usernameWasRequested = Boolean(payload.username?.trim());
  let email = `${username}@pokertrack.local`;
  let duplicateUser = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error: duplicateError } = await userClient
      .from('users')
      .select('id,username')
      .eq('username', username)
      .maybeSingle();

    if (duplicateError) {
      return json({ error: duplicateError.message }, 500);
    }

    duplicateUser = data;

    if (!duplicateUser || usernameWasRequested) {
      break;
    }

    username = usernameWithSuffix(username, crypto.randomUUID().slice(0, 6));
    email = `${username}@pokertrack.local`;
  }

  if (duplicateUser) {
    return json({ error: 'A player with this login already exists.' }, 409);
  }

  const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: displayName,
      role: 'PLAYER'
    }
  });

  if (createUserError || !createdUser.user) {
    return json({ error: createUserError?.message ?? 'Unable to create player.' }, 400);
  }

  const { data: profile, error: profileError } = await userClient
    .from('users')
    .select('id,username,display_name,role')
    .eq('id', createdUser.user.id)
    .single<UserProfileRow>();

  if (profileError) {
    return json({
      player: {
        id: createdUser.user.id,
        username,
        displayName
      },
      temporaryPassword: defaultPassword
    });
  }

  return json({
    player: {
      id: profile.id,
      username: profile.username ?? username,
      displayName: profile.display_name ?? displayName
    },
    temporaryPassword: defaultPassword
  });
});
