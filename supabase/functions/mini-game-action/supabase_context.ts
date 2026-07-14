import { createClient } from "@supabase/supabase-js";

import type { MiniGameRequestContext, RpcError, RpcResult } from "./handler.ts";

export interface SupabaseEnvironment {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

export interface SupabaseClientOptions {
  global?: {
    headers: Record<string, string>;
  };
  auth: {
    persistSession: boolean;
  };
}

interface SupabasePortError {
  message: string;
  code?: string;
}

export interface SupabaseClientPort {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: SupabasePortError | null;
    }>;
  };
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: SupabasePortError | null }>;
}

export type SupabaseClientFactory = (
  url: string,
  key: string,
  options?: SupabaseClientOptions,
) => SupabaseClientPort;

const defaultClientFactory: SupabaseClientFactory = (url, key, options) =>
  createClient(url, key, options) as unknown as SupabaseClientPort;

export const readSupabaseEnvironment = (
  getEnvironmentVariable: (name: string) => string | undefined = (name) =>
    Deno.env.get(name),
): SupabaseEnvironment => {
  const supabaseUrl = getEnvironmentVariable("SUPABASE_URL");
  const anonKey = getEnvironmentVariable("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase function environment is not configured.");
  }

  return { supabaseUrl, anonKey, serviceRoleKey };
};

const rpcError = (error: SupabasePortError | null): RpcError | null =>
  error
    ? {
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    }
    : null;

const callRpc = async (
  client: SupabaseClientPort,
  name: string,
  args: Record<string, unknown>,
): Promise<RpcResult> => {
  const { data, error } = await client.rpc(name, args);
  return { data, error: rpcError(error) };
};

export const createSupabaseRequestContext = (
  authorization: string,
  environment = readSupabaseEnvironment(),
  clientFactory: SupabaseClientFactory = defaultClientFactory,
): MiniGameRequestContext => {
  const userClient = clientFactory(
    environment.supabaseUrl,
    environment.anonKey,
    {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        persistSession: false,
      },
    },
  );
  const serviceClient = clientFactory(
    environment.supabaseUrl,
    environment.serviceRoleKey,
    {
      auth: {
        persistSession: false,
      },
    },
  );

  return {
    getUser: async () => {
      const { data, error } = await userClient.auth.getUser();

      if (error || !data.user || typeof data.user.id !== "string") {
        return null;
      }

      return { id: data.user.id };
    },
    userRpc: (name, args) => callRpc(userClient, name, args),
    serviceRpc: (name, args) => callRpc(serviceClient, name, args),
  };
};
