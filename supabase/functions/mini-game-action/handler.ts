import {
  calculateExactEquities,
  type MiniGameSnapshot,
  type PersistedEquity,
} from "./equity.ts";

export type MiniGameAction =
  | { action: "create"; name: string; minPlayers: number; maxPlayers: number }
  | {
    action: "update";
    gameId: string;
    name: string;
    minPlayers: number;
    maxPlayers: number;
  }
  | { action: "join"; gameId: string }
  | { action: "remove"; gameId: string; participantId: string }
  | { action: "reshuffle"; gameId: string }
  | { action: "start"; gameId: string }
  | { action: "reveal-turn"; gameId: string }
  | { action: "reveal-river"; gameId: string }
  | { action: "delete"; gameId: string }
  | { action: "recalculate"; gameId: string };

export interface RpcError {
  message: string;
  code?: string;
}

export interface RpcResult {
  data: unknown;
  error: RpcError | null;
}

export interface MiniGameRequestContext {
  getUser(): Promise<{ id: string } | null>;
  userRpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
  serviceRpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
}

export interface MiniGameHandlerDependencies {
  createContext(authorization: string): MiniGameRequestContext;
  calculateEquities?: (snapshot: MiniGameSnapshot) => PersistedEquity[];
}

export interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

interface MutationState {
  gameId: string;
  stateVersion: number;
  equityStatus: string;
}

class RequestValidationError extends Error {}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bearerPattern = /^Bearer\s+\S+$/i;
const statuses = new Set(["OPEN", "FLOP", "TURN", "COMPLETE"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const errorResponse = (error: string, status: number) =>
  json({ ok: false, error }, status);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestValidationError("Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
};

const requireUuid = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new RequestValidationError(`${field} must be a valid UUID.`);
  }

  return value;
};

const requireName = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new RequestValidationError("name must be a string.");
  }

  const name = value.trim();

  if (name.length < 2 || name.length > 40) {
    throw new RequestValidationError(
      "name must be between 2 and 40 characters.",
    );
  }

  return name;
};

const requirePlayerCount = (value: unknown, field: string): number => {
  if (
    !Number.isInteger(value) || (value as number) < 2 || (value as number) > 10
  ) {
    throw new RequestValidationError(
      `${field} must be an integer between 2 and 10.`,
    );
  }

  return value as number;
};

const parseSettings = (input: Record<string, unknown>) => {
  const name = requireName(input.name);
  const minPlayers = requirePlayerCount(input.minPlayers, "minPlayers");
  const maxPlayers = requirePlayerCount(input.maxPlayers, "maxPlayers");

  if (minPlayers > maxPlayers) {
    throw new RequestValidationError(
      "minPlayers cannot be greater than maxPlayers.",
    );
  }

  return { name, minPlayers, maxPlayers };
};

export const parseMiniGameAction = (value: unknown): MiniGameAction => {
  const input = asRecord(value);

  switch (input.action) {
    case "create":
      return { action: "create", ...parseSettings(input) };
    case "update":
      return {
        action: "update",
        gameId: requireUuid(input.gameId, "gameId"),
        ...parseSettings(input),
      };
    case "join":
    case "reshuffle":
    case "start":
    case "reveal-turn":
    case "reveal-river":
    case "delete":
    case "recalculate":
      return {
        action: input.action,
        gameId: requireUuid(input.gameId, "gameId"),
      };
    case "remove":
      return {
        action: "remove",
        gameId: requireUuid(input.gameId, "gameId"),
        participantId: requireUuid(input.participantId, "participantId"),
      };
    default:
      throw new RequestValidationError("action is not supported.");
  }
};

export const rpcCallForAction = (request: MiniGameAction): RpcCall | null => {
  switch (request.action) {
    case "create":
      return {
        name: "create_mini_game",
        args: {
          p_name: request.name,
          p_min_players: request.minPlayers,
          p_max_players: request.maxPlayers,
        },
      };
    case "update":
      return {
        name: "update_mini_game",
        args: {
          p_game_id: request.gameId,
          p_name: request.name,
          p_min_players: request.minPlayers,
          p_max_players: request.maxPlayers,
        },
      };
    case "join":
      return { name: "join_mini_game", args: { p_game_id: request.gameId } };
    case "remove":
      return {
        name: "remove_mini_game_participant",
        args: {
          p_game_id: request.gameId,
          p_participant_id: request.participantId,
        },
      };
    case "reshuffle":
      return {
        name: "reshuffle_mini_game",
        args: { p_game_id: request.gameId },
      };
    case "start":
      return { name: "start_mini_game", args: { p_game_id: request.gameId } };
    case "reveal-turn":
      return {
        name: "reveal_mini_game_turn",
        args: { p_game_id: request.gameId },
      };
    case "reveal-river":
      return {
        name: "reveal_mini_game_river",
        args: { p_game_id: request.gameId },
      };
    case "delete":
      return { name: "delete_mini_game", args: { p_game_id: request.gameId } };
    case "recalculate":
      return null;
  }
};

const parseMutationState = (data: unknown): MutationState | null => {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }

  const record = row as Record<string, unknown>;
  const gameId = record.game_id;
  const stateVersion = record.state_version;
  const equityStatus = record.equity_status;

  if (
    typeof gameId !== "string" ||
    !uuidPattern.test(gameId) ||
    !Number.isSafeInteger(stateVersion) ||
    (stateVersion as number) < 1 ||
    typeof equityStatus !== "string"
  ) {
    return null;
  }

  return {
    gameId,
    stateVersion: stateVersion as number,
    equityStatus,
  };
};

const parseSnapshot = (data: unknown): MiniGameSnapshot | null => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const snapshot = data as Record<string, unknown>;

  if (
    typeof snapshot.id !== "string" ||
    !uuidPattern.test(snapshot.id) ||
    !Number.isSafeInteger(snapshot.stateVersion) ||
    (snapshot.stateVersion as number) < 1 ||
    typeof snapshot.status !== "string" ||
    !statuses.has(snapshot.status) ||
    !Array.isArray(snapshot.board) ||
    !Array.isArray(snapshot.participants)
  ) {
    return null;
  }

  return snapshot as unknown as MiniGameSnapshot;
};

const rpcErrorStatus = (error: RpcError): number => {
  const message = error.message.toLowerCase();

  if (message.includes("authentication required")) {
    return 401;
  }

  if (
    message.includes("host privileges") ||
    message.includes("creator host") ||
    message.includes("not authorized") ||
    message.includes("permission denied")
  ) {
    return 403;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (
    error.code === "23505" ||
    message.includes("already") ||
    message.includes("current mini-game") ||
    message.includes("mini-game is full") ||
    message.includes("joining is closed") ||
    message.includes("only an open mini-game") ||
    message.includes("can only be") ||
    message.includes("cannot be") ||
    message.includes("not enough players")
  ) {
    return 409;
  }

  if (
    error.code === "P0001" || error.code === "23514" ||
    error.code?.startsWith("22")
  ) {
    return 400;
  }

  return 500;
};

const responseForRpcError = (error: RpcError): Response => {
  const status = rpcErrorStatus(error);
  return errorResponse(
    status === 500 ? "Unexpected server error." : error.message,
    status,
  );
};

const pendingResponse = (
  state: MutationState,
  warning: string,
  snapshot?: MiniGameSnapshot,
) =>
  json({
    ok: true,
    gameId: state.gameId,
    stateVersion: state.stateVersion,
    equityStatus: "PENDING",
    ...(snapshot ? { snapshot } : {}),
    warning,
  });

const attemptEquity = async (
  context: MiniGameRequestContext,
  state: MutationState,
  calculateEquities: (snapshot: MiniGameSnapshot) => PersistedEquity[],
  suppliedSnapshot?: MiniGameSnapshot,
): Promise<Response> => {
  let snapshot = suppliedSnapshot;

  if (!snapshot) {
    try {
      const snapshotResult = await context.userRpc("get_mini_game_detail", {
        p_game_id: state.gameId,
      });

      if (snapshotResult.error) {
        return pendingResponse(
          state,
          "Equity calculation is pending and can be retried.",
        );
      }

      snapshot = parseSnapshot(snapshotResult.data) ?? undefined;
    } catch {
      return pendingResponse(
        state,
        "Equity calculation is pending and can be retried.",
      );
    }
  }

  if (!snapshot) {
    return pendingResponse(
      state,
      "Equity calculation is pending and can be retried.",
    );
  }

  if (
    snapshot.id !== state.gameId || snapshot.stateVersion !== state.stateVersion
  ) {
    return pendingResponse(
      state,
      "Equity calculation was superseded by a newer game state.",
    );
  }

  let equities: PersistedEquity[];

  try {
    equities = calculateEquities(snapshot);
  } catch {
    return pendingResponse(
      state,
      "Equity calculation is pending and can be retried.",
      snapshot,
    );
  }

  let storeResult: RpcResult;

  try {
    storeResult = await context.serviceRpc("store_mini_game_equities", {
      p_game_id: state.gameId,
      p_expected_state_version: state.stateVersion,
      p_equities: equities,
    });
  } catch {
    return pendingResponse(
      state,
      "Equity calculation is pending and can be retried.",
      snapshot,
    );
  }

  if (storeResult.error) {
    return pendingResponse(
      state,
      "Equity calculation is pending and can be retried.",
      snapshot,
    );
  }

  if (storeResult.data !== true) {
    return pendingResponse(
      state,
      storeResult.data === false
        ? "Equity calculation was superseded by a newer game state."
        : "Equity calculation is pending and can be retried.",
      snapshot,
    );
  }

  try {
    const refreshResult = await context.userRpc("get_mini_game_detail", {
      p_game_id: state.gameId,
    });
    const refreshedSnapshot = refreshResult.error
      ? null
      : parseSnapshot(refreshResult.data);

    if (
      refreshedSnapshot &&
      refreshedSnapshot.id === state.gameId &&
      refreshedSnapshot.stateVersion === state.stateVersion
    ) {
      return json({
        ok: true,
        gameId: state.gameId,
        stateVersion: state.stateVersion,
        equityStatus: "READY",
        snapshot: refreshedSnapshot,
      });
    }

    if (
      refreshedSnapshot && refreshedSnapshot.stateVersion !== state.stateVersion
    ) {
      return pendingResponse(
        state,
        "Equity calculation was superseded by a newer game state.",
      );
    }
  } catch {
    // Storage succeeded; the response can omit its optional snapshot.
  }

  return json({
    ok: true,
    gameId: state.gameId,
    stateVersion: state.stateVersion,
    equityStatus: "READY",
    warning: "Equities were stored, but the refreshed snapshot is unavailable.",
  });
};

export const createMiniGameHandler = (
  dependencies: MiniGameHandlerDependencies,
): (request: Request) => Promise<Response> => {
  const calculateEquities = dependencies.calculateEquities ??
    calculateExactEquities;

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return errorResponse("Method not allowed.", 405);
    }

    const authorization = request.headers.get("Authorization");

    if (!authorization || !bearerPattern.test(authorization)) {
      return errorResponse("Authentication required.", 401);
    }

    let context: MiniGameRequestContext;

    try {
      context = dependencies.createContext(authorization);
    } catch {
      return errorResponse("Unexpected server error.", 500);
    }

    try {
      const user = await context.getUser();

      if (!user) {
        return errorResponse("Authentication required.", 401);
      }
    } catch {
      return errorResponse("Authentication required.", 401);
    }

    let action: MiniGameAction;

    try {
      action = parseMiniGameAction(await request.json());
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return errorResponse(error.message, 400);
      }

      return errorResponse("Invalid JSON request body.", 400);
    }

    if (action.action === "recalculate") {
      let detailResult: RpcResult;

      try {
        detailResult = await context.userRpc("get_mini_game_detail", {
          p_game_id: action.gameId,
        });
      } catch {
        return errorResponse("Unexpected server error.", 500);
      }

      if (detailResult.error) {
        return responseForRpcError(detailResult.error);
      }

      const snapshot = parseSnapshot(detailResult.data);

      if (!snapshot || snapshot.id !== action.gameId) {
        return errorResponse("Unexpected server error.", 500);
      }

      return attemptEquity(
        context,
        {
          gameId: snapshot.id,
          stateVersion: snapshot.stateVersion,
          equityStatus: typeof snapshot.equityStatus === "string"
            ? snapshot.equityStatus
            : "PENDING",
        },
        calculateEquities,
        snapshot,
      );
    }

    const rpcCall = rpcCallForAction(action);

    if (!rpcCall) {
      return errorResponse("Unexpected server error.", 500);
    }

    let mutationResult: RpcResult;

    try {
      mutationResult = await context.userRpc(rpcCall.name, rpcCall.args);
    } catch {
      return errorResponse("Unexpected server error.", 500);
    }

    if (mutationResult.error) {
      return responseForRpcError(mutationResult.error);
    }

    const state = parseMutationState(mutationResult.data);

    if (!state) {
      return errorResponse("Unexpected server error.", 500);
    }

    if (action.action === "delete") {
      return json({
        ok: true,
        gameId: state.gameId,
        stateVersion: state.stateVersion,
        equityStatus: state.equityStatus,
      });
    }

    return attemptEquity(context, state, calculateEquities);
  };
};
