import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateRegisteredPlayerRequest {
  username: string;
}

interface UserProfileRow {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  role: 'HOST' | 'PLAYER';
}

const defaultPassword = '123456';
const usernamePattern = /^[a-z0-9][a-z0-9_-]{2,31}$/;
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

  const username = normalizeUsername(payload.username ?? '');

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

  const email = `${username}@pokertrack.local`;
  const displayName = username;

  const { data: duplicateUser, error: duplicateError } = await userClient
    .from('users')
    .select('id,email,username')
    .or(`username.eq.${username},email.eq.${email}`)
    .maybeSingle();

  if (duplicateError) {
    return json({ error: duplicateError.message }, 500);
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
    .select('id,email,username,display_name,role')
    .eq('id', createdUser.user.id)
    .single<UserProfileRow>();

  if (profileError) {
    return json({
      player: {
        id: createdUser.user.id,
        email,
        username,
        displayName
      },
      temporaryPassword: defaultPassword
    });
  }

  return json({
    player: {
      id: profile.id,
      email: profile.email,
      username: profile.username ?? username,
      displayName: profile.display_name ?? displayName
    },
    temporaryPassword: defaultPassword
  });
});
