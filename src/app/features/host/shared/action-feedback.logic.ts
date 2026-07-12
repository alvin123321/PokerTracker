interface MessageCarrier {
  message?: unknown;
  error?: unknown;
  msg?: unknown;
}

interface FunctionErrorContext {
  clone?: () => FunctionErrorContext;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

interface FunctionErrorCarrier {
  context?: FunctionErrorContext;
}

export function messageFromUnknownError(
  error: unknown,
  fallback = 'Unable to save changes.'
): string {
  if (typeof error === 'string') {
    return cleanMessage(error) ?? fallback;
  }

  if (error instanceof Error) {
    return cleanMessage(error.message) ?? fallback;
  }

  const structuredMessage = messageFromPayload(error);

  return structuredMessage ?? fallback;
}

export async function messageFromSupabaseFunctionError(
  error: unknown,
  fallback = 'Unable to save changes.'
): Promise<string> {
  const context = functionErrorContext(error);

  if (context) {
    const bodyMessage = await messageFromFunctionContext(context);

    if (bodyMessage) {
      return bodyMessage;
    }
  }

  return messageFromUnknownError(error, fallback);
}

function functionErrorContext(error: unknown): FunctionErrorContext | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('context' in error)
  ) {
    return null;
  }

  const context = (error as FunctionErrorCarrier).context;

  if (!context || typeof context !== 'object') {
    return null;
  }

  return context;
}

async function messageFromFunctionContext(context: FunctionErrorContext): Promise<string | null> {
  const readableContext = typeof context.clone === 'function' ? context.clone() : context;

  if (typeof readableContext.json === 'function') {
    try {
      return messageFromPayload(await readableContext.json());
    } catch {
      // Fall through to text parsing.
    }
  }

  if (typeof readableContext.text === 'function') {
    try {
      return cleanMessage(await readableContext.text());
    } catch {
      return null;
    }
  }

  return null;
}

function messageFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return cleanMessage(payload);
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const carrier = payload as MessageCarrier;

  return (
    cleanMessage(carrier.error) ??
    cleanMessage(carrier.message) ??
    cleanMessage(carrier.msg)
  );
}

function cleanMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const message = value.trim();

  return message.length > 0 ? message : null;
}
