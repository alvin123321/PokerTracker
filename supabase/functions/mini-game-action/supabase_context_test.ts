import assert from "node:assert/strict";

import {
  createSupabaseRequestContext,
  readSupabaseEnvironment,
  type SupabaseClientFactory,
  type SupabaseClientOptions,
  type SupabaseClientPort,
} from "./supabase_context.ts";

const USER_ID = "30000000-0000-4000-8000-000000000001";

Deno.test("readSupabaseEnvironment requires all function secrets", () => {
  const complete = new Map([
    ["SUPABASE_URL", "https://example.supabase.co"],
    ["SUPABASE_ANON_KEY", "anon-key"],
    ["SUPABASE_SERVICE_ROLE_KEY", "service-key"],
  ]);

  assert.deepEqual(readSupabaseEnvironment((name) => complete.get(name)), {
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon-key",
    serviceRoleKey: "service-key",
  });
  assert.throws(
    () =>
      readSupabaseEnvironment((
        name,
      ) => (name === "SUPABASE_URL" ? "url" : undefined)),
    /not configured/i,
  );
});

Deno.test("createSupabaseRequestContext isolates user and service RPC clients", async () => {
  const factoryCalls: Array<{
    url: string;
    key: string;
    options: SupabaseClientOptions | undefined;
  }> = [];
  const rpcCalls: Array<
    { client: string; name: string; args: Record<string, unknown> }
  > = [];

  const client = (clientName: string): SupabaseClientPort => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: clientName === "user" ? { id: USER_ID } : null },
          error: null,
        }),
    },
    rpc: (name, args) => {
      rpcCalls.push({ client: clientName, name, args });
      return Promise.resolve({ data: clientName, error: null });
    },
  });
  const factory: SupabaseClientFactory = (url, key, options) => {
    factoryCalls.push({ url, key, options });
    return client(key === "anon-key" ? "user" : "service");
  };
  const context = createSupabaseRequestContext(
    "Bearer user-token",
    {
      supabaseUrl: "https://example.supabase.co",
      anonKey: "anon-key",
      serviceRoleKey: "service-key",
    },
    factory,
  );

  assert.deepEqual(await context.getUser(), { id: USER_ID });
  assert.deepEqual(
    await context.userRpc("join_mini_game", { p_game_id: "game-id" }),
    {
      data: "user",
      error: null,
    },
  );
  assert.deepEqual(
    await context.serviceRpc("store_mini_game_equities", {
      p_game_id: "game-id",
    }),
    { data: "service", error: null },
  );
  assert.deepEqual(rpcCalls, [
    { client: "user", name: "join_mini_game", args: { p_game_id: "game-id" } },
    {
      client: "service",
      name: "store_mini_game_equities",
      args: { p_game_id: "game-id" },
    },
  ]);
  assert.deepEqual(factoryCalls, [
    {
      url: "https://example.supabase.co",
      key: "anon-key",
      options: {
        global: { headers: { Authorization: "Bearer user-token" } },
        auth: { persistSession: false },
      },
    },
    {
      url: "https://example.supabase.co",
      key: "service-key",
      options: { auth: { persistSession: false } },
    },
  ]);
});

Deno.test("createSupabaseRequestContext treats auth errors as unauthenticated", async () => {
  const client: SupabaseClientPort = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: { id: USER_ID } },
          error: { message: "expired" },
        }),
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  const context = createSupabaseRequestContext(
    "Bearer expired-token",
    { supabaseUrl: "url", anonKey: "anon", serviceRoleKey: "service" },
    () => client,
  );

  assert.equal(await context.getUser(), null);
});
