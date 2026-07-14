import assert from "node:assert/strict";

import {
  createMiniGameHandler,
  type MiniGameRequestContext,
  parseMiniGameAction,
  rpcCallForAction,
  type RpcResult,
} from "./handler.ts";
import type { PersistedEquity } from "./equity.ts";

const GAME_ID = "10000000-0000-4000-8000-000000000001";
const PARTICIPANT_ID = "20000000-0000-4000-8000-000000000001";
const USER_ID = "30000000-0000-4000-8000-000000000001";

interface RecordedCall {
  client: "user" | "service";
  name: string;
  args: Record<string, unknown>;
}

const mutationData = [
  { game_id: GAME_ID, state_version: 2, equity_status: "PENDING" },
];
const pendingSnapshot = {
  id: GAME_ID,
  stateVersion: 2,
  equityStatus: "PENDING",
  status: "OPEN",
  board: [],
  participants: [],
};
const readySnapshot = {
  ...pendingSnapshot,
  equityStatus: "READY",
  equityVersion: 2,
};
const noEquities: PersistedEquity[] = [];

const result = (
  data: unknown,
  error: RpcResult["error"] = null,
): RpcResult => ({ data, error });

const context = (
  calls: RecordedCall[],
  options: {
    user?: { id: string } | null;
    mutation?: RpcResult;
    detail?: RpcResult;
    refreshedDetail?: RpcResult;
    store?: RpcResult;
  } = {},
): MiniGameRequestContext => {
  let detailCalls = 0;

  return {
    getUser: () =>
      Promise.resolve(
        options.user === undefined ? { id: USER_ID } : options.user,
      ),
    userRpc: (name, args) => {
      calls.push({ client: "user", name, args });

      if (name === "get_mini_game_detail") {
        detailCalls += 1;
        return Promise.resolve(
          detailCalls === 1
            ? options.detail ?? result(pendingSnapshot)
            : options.refreshedDetail ?? result(readySnapshot),
        );
      }

      return Promise.resolve(options.mutation ?? result(mutationData));
    },
    serviceRpc: (name, args) => {
      calls.push({ client: "service", name, args });
      return Promise.resolve(options.store ?? result(true));
    },
  };
};

const request = (body: unknown, authorization = "Bearer valid-token") =>
  new Request("http://localhost/functions/v1/mini-game-action", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const responseBody = (response: Response) =>
  response.json() as Promise<Record<string, unknown>>;

Deno.test("parseMiniGameAction and rpcCallForAction map every public action", () => {
  const cases: Array<[unknown, string | null, Record<string, unknown> | null]> =
    [
      [
        { action: "create", name: "Table", minPlayers: 2, maxPlayers: 10 },
        "create_mini_game",
        { p_name: "Table", p_min_players: 2, p_max_players: 10 },
      ],
      [
        {
          action: "update",
          gameId: GAME_ID,
          name: "Table",
          minPlayers: 3,
          maxPlayers: 8,
        },
        "update_mini_game",
        {
          p_game_id: GAME_ID,
          p_name: "Table",
          p_min_players: 3,
          p_max_players: 8,
        },
      ],
      [{ action: "join", gameId: GAME_ID }, "join_mini_game", {
        p_game_id: GAME_ID,
      }],
      [
        { action: "remove", gameId: GAME_ID, participantId: PARTICIPANT_ID },
        "remove_mini_game_participant",
        { p_game_id: GAME_ID, p_participant_id: PARTICIPANT_ID },
      ],
      [
        { action: "reshuffle", gameId: GAME_ID },
        "reshuffle_mini_game",
        { p_game_id: GAME_ID },
      ],
      [{ action: "start", gameId: GAME_ID }, "start_mini_game", {
        p_game_id: GAME_ID,
      }],
      [
        { action: "reveal-turn", gameId: GAME_ID },
        "reveal_mini_game_turn",
        { p_game_id: GAME_ID },
      ],
      [
        { action: "reveal-river", gameId: GAME_ID },
        "reveal_mini_game_river",
        { p_game_id: GAME_ID },
      ],
      [{ action: "delete", gameId: GAME_ID }, "delete_mini_game", {
        p_game_id: GAME_ID,
      }],
      [{ action: "recalculate", gameId: GAME_ID }, null, null],
    ];

  for (const [input, expectedName, expectedArgs] of cases) {
    const action = parseMiniGameAction(input);
    const rpcCall = rpcCallForAction(action);
    assert.equal(rpcCall?.name ?? null, expectedName);
    assert.deepEqual(rpcCall?.args ?? null, expectedArgs);
  }
});

Deno.test("parseMiniGameAction rejects malformed discriminated requests", () => {
  const invalidRequests = [
    null,
    [],
    {},
    { action: "unknown" },
    { action: "create", name: "x", minPlayers: 2, maxPlayers: 10 },
    { action: "create", name: "Table", minPlayers: 11, maxPlayers: 10 },
    {
      action: "update",
      gameId: "not-a-uuid",
      name: "Table",
      minPlayers: 2,
      maxPlayers: 4,
    },
    { action: "remove", gameId: GAME_ID },
  ];

  for (const invalidRequest of invalidRequests) {
    assert.throws(() => parseMiniGameAction(invalidRequest));
  }
});

Deno.test("handler authenticates and stores exact equities after a mutation", async () => {
  const calls: RecordedCall[] = [];
  const handler = createMiniGameHandler({
    createContext: () => context(calls),
    calculateEquities: () => noEquities,
  });

  const response = await handler(request({ action: "join", gameId: GAME_ID }));

  assert.equal(response.status, 200);
  assert.deepEqual(await responseBody(response), {
    ok: true,
    gameId: GAME_ID,
    stateVersion: 2,
    equityStatus: "READY",
    snapshot: readySnapshot,
  });
  assert.deepEqual(calls, [
    { client: "user", name: "join_mini_game", args: { p_game_id: GAME_ID } },
    {
      client: "user",
      name: "get_mini_game_detail",
      args: { p_game_id: GAME_ID },
    },
    {
      client: "service",
      name: "store_mini_game_equities",
      args: {
        p_game_id: GAME_ID,
        p_expected_state_version: 2,
        p_equities: [],
      },
    },
    {
      client: "user",
      name: "get_mini_game_detail",
      args: { p_game_id: GAME_ID },
    },
  ]);
});

Deno.test("handler retains mutation success when equity calculation fails", async () => {
  const handler = createMiniGameHandler({
    createContext: () => context([]),
    calculateEquities: () => {
      throw new Error("sensitive calculation detail");
    },
  });

  const response = await handler(request({ action: "start", gameId: GAME_ID }));
  const body = await responseBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.equityStatus, "PENDING");
  assert.deepEqual(body.snapshot, pendingSnapshot);
  assert.match(String(body.warning), /retri/i);
  assert.doesNotMatch(JSON.stringify(body), /sensitive calculation detail/);
});

Deno.test("handler retains mutation success when equity storage fails", async () => {
  const handler = createMiniGameHandler({
    createContext: () =>
      context([], {
        store: result(null, { message: "service credential leaked here" }),
      }),
    calculateEquities: () => noEquities,
  });

  const response = await handler(
    request({ action: "reshuffle", gameId: GAME_ID }),
  );
  const body = await responseBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.equityStatus, "PENDING");
  assert.match(String(body.warning), /retri/i);
  assert.doesNotMatch(JSON.stringify(body), /credential/);
});

Deno.test("handler does not claim READY after a stale equity write", async () => {
  const handler = createMiniGameHandler({
    createContext: () => context([], { store: result(false) }),
    calculateEquities: () => noEquities,
  });

  const response = await handler(
    request({ action: "recalculate", gameId: GAME_ID }),
  );
  const body = await responseBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.equityStatus, "PENDING");
  assert.match(String(body.warning), /newer game state/i);
});

Deno.test("handler skips equity work for delete", async () => {
  const calls: RecordedCall[] = [];
  const handler = createMiniGameHandler({
    createContext: () => context(calls),
    calculateEquities: () => {
      throw new Error("must not run");
    },
  });

  const response = await handler(
    request({ action: "delete", gameId: GAME_ID }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await responseBody(response), {
    ok: true,
    gameId: GAME_ID,
    stateVersion: 2,
    equityStatus: "PENDING",
  });
  assert.deepEqual(calls, [
    { client: "user", name: "delete_mini_game", args: { p_game_id: GAME_ID } },
  ]);
});

Deno.test("handler returns structured unauthorized and malformed responses", async () => {
  const authenticatedHandler = createMiniGameHandler({
    createContext: () => context([]),
    calculateEquities: () => noEquities,
  });
  const unauthenticatedHandler = createMiniGameHandler({
    createContext: () => context([], { user: null }),
    calculateEquities: () => noEquities,
  });

  const missingToken = await authenticatedHandler(
    request({ action: "join", gameId: GAME_ID }, ""),
  );
  assert.equal(missingToken.status, 401);
  assert.deepEqual(await responseBody(missingToken), {
    ok: false,
    error: "Authentication required.",
  });

  const invalidToken = await unauthenticatedHandler(
    request({ action: "join", gameId: GAME_ID }),
  );
  assert.equal(invalidToken.status, 401);
  assert.deepEqual(await responseBody(invalidToken), {
    ok: false,
    error: "Authentication required.",
  });

  const malformed = await authenticatedHandler(
    request({ action: "join", gameId: "bad-id" }),
  );
  assert.equal(malformed.status, 400);
  assert.equal((await responseBody(malformed)).ok, false);
});

Deno.test("handler maps authorization failures without exposing unexpected details", async () => {
  const forbiddenHandler = createMiniGameHandler({
    createContext: () =>
      context([], {
        mutation: result(null, {
          message: "Only the creator host can manage this mini-game.",
        }),
      }),
    calculateEquities: () => noEquities,
  });
  const brokenHandler = createMiniGameHandler({
    createContext: () => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY=secret");
    },
    calculateEquities: () => noEquities,
  });

  const forbidden = await forbiddenHandler(
    request({ action: "start", gameId: GAME_ID }),
  );
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await responseBody(forbidden), {
    ok: false,
    error: "Only the creator host can manage this mini-game.",
  });

  const broken = await brokenHandler(
    request({ action: "start", gameId: GAME_ID }),
  );
  const brokenBody = await responseBody(broken);
  assert.equal(broken.status, 500);
  assert.deepEqual(brokenBody, {
    ok: false,
    error: "Unexpected server error.",
  });
  assert.doesNotMatch(
    JSON.stringify(brokenBody),
    /secret|SUPABASE_SERVICE_ROLE_KEY/,
  );
});

Deno.test("handler supports CORS preflight and rejects unsupported methods", async () => {
  const handler = createMiniGameHandler({
    createContext: () => context([]),
    calculateEquities: () => noEquities,
  });
  const url = "http://localhost/functions/v1/mini-game-action";

  const options = await handler(new Request(url, { method: "OPTIONS" }));
  assert.equal(options.status, 200);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "*");

  const get = await handler(new Request(url, { method: "GET" }));
  assert.equal(get.status, 405);
  assert.deepEqual(await responseBody(get), {
    ok: false,
    error: "Method not allowed.",
  });
});
