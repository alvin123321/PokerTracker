import { createMiniGameHandler } from "./handler.ts";
import { createSupabaseRequestContext } from "./supabase_context.ts";

const handler = createMiniGameHandler({
  createContext: (authorization) => createSupabaseRequestContext(authorization),
});

export default {
  fetch: handler,
};
