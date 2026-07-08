import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const supabaseUrl = process.env.SUPABASE_URL ?? 'https://rfyaqfecnkwrlcdfmmaj.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = new Map();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];

  if (!arg.startsWith('--')) {
    continue;
  }

  const key = arg.slice(2);
  const next = process.argv[index + 1];

  if (!next || next.startsWith('--')) {
    args.set(key, 'true');
    continue;
  }

  args.set(key, next);
  index += 1;
}

const username = args.get('username')?.trim().toLowerCase();
const password = args.get('password') ?? process.env.NEW_PASSWORD;
const note = args.get('note') ?? 'Service-role password recovery script.';

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!username) {
  console.error('Missing --username.');
  process.exit(1);
}

if (!password || password.length < 6) {
  console.error('Provide --password with at least 6 characters.');
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

const emailFromUsername = (value) =>
  value.includes('@') ? value : `${value}@pokertrack.local`;

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

const main = async () => {
  const email = emailFromUsername(username);
  const authUser = await findAuthUserByEmail(email);

  if (!authUser?.id) {
    throw new Error(`No auth user found for ${username}.`);
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id,username,display_name,role')
    .eq('id', authUser.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  const { error: passwordError } = await supabase.auth.admin.updateUserById(authUser.id, {
    password
  });

  if (passwordError) {
    throw passwordError;
  }

  const { error: auditError } = await supabase.from('password_change_audit').insert({
    target_user_id: profile.id,
    changed_by: null,
    change_source: 'SERVICE_SCRIPT',
    note
  });

  if (auditError) {
    throw auditError;
  }

  console.log(`Password reset for ${profile.username ?? username} (${profile.role}).`);
  console.log('Audit row recorded in public.password_change_audit.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
