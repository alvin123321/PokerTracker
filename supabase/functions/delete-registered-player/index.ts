import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DeleteRegisteredPlayerRequest {
  userId: string;
}

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

  let payload: DeleteRegisteredPlayerRequest;

  try {
    payload = (await req.json()) as DeleteRegisteredPlayerRequest;
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  if (!payload.userId) {
    return json({ error: 'Player user id is required.' }, 400);
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

  const { data: hostProfile, error: hostError } = await serviceClient
    .from('users')
    .select('id,role')
    .eq('id', user.id)
    .single();

  if (hostError || hostProfile?.role !== 'HOST') {
    return json({ error: 'Host privileges required.' }, 403);
  }

  const { data: playerProfile, error: playerError } = await serviceClient
    .from('users')
    .select('id,role')
    .eq('id', payload.userId)
    .single();

  if (playerError || playerProfile?.role !== 'PLAYER') {
    return json({ error: 'Registered player not found.' }, 404);
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(payload.userId);

  if (deleteError) {
    return json({ error: deleteError.message }, 400);
  }

  return json({ ok: true });
});
