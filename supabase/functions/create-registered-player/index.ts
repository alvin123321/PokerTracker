import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface CreateRegisteredPlayerRequest {
  displayName?: string;
  username?: string;
}

interface UserProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
}

interface AuthAdminUserResponse {
  id?: string;
  user?: {
    id?: string;
  };
  code?: string;
  error_code?: string;
  error?: string;
  msg?: string;
  message?: string;
  [key: string]: unknown;
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
const authAdminErrorMessage = (body: AuthAdminUserResponse, fallback: string) =>
  body.error ?? body.msg ?? body.message ?? fallback;

const authAdminErrorDetails = (body: AuthAdminUserResponse) => ({
  code: body.code ?? body.error_code ?? null,
  message: body.message ?? body.msg ?? body.error ?? null,
  raw: body
});

const createAuthUser = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  username: string,
  displayName: string
) => {
  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: displayName,
          role: 'PLAYER'
        }
      })
    });
  } catch (error) {
    return {
      userId: null,
      error: error instanceof Error ? error.message : 'Auth admin request failed.',
      details: null
    };
  }

  const body = (await response.json().catch(() => ({}))) as AuthAdminUserResponse;

  if (!response.ok) {
    return {
      userId: null,
      error: authAdminErrorMessage(body, `Auth admin request failed with ${response.status}.`),
      details: authAdminErrorDetails(body)
    };
  }

  const userId = body.user?.id ?? body.id ?? null;

  if (!userId) {
    return {
      userId: null,
      error: 'Auth admin response did not include a user id.',
      details: authAdminErrorDetails(body)
    };
  }

  return {
    userId,
    error: null,
    details: null
  };
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

  const createdUser = await createAuthUser(
    supabaseUrl,
    serviceRoleKey,
    email,
    username,
    displayName
  );

  if (createdUser.error || !createdUser.userId) {
    return json(
      {
        error: createdUser.error ?? 'Unable to create player.',
        details: createdUser.details
      },
      400
    );
  }

  const { data: createdProfiles, error: profileError } = await userClient.rpc(
    'create_registered_player_profile',
    {
      p_user_id: createdUser.userId,
      p_username: username,
      p_display_name: displayName
    }
  );

  if (profileError) {
    return json({ error: profileError.message }, 500);
  }

  const profile = (createdProfiles as UserProfileRow[] | null)?.[0];

  if (!profile) {
    return json({ error: 'Player profile was not returned after creation.' }, 500);
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
