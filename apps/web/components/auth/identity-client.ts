interface IdempotencyState {
  readonly fingerprint: string;
  readonly key: string;
}

export interface IdentityIdempotencyRef {
  current: IdempotencyState | null;
}

export function idempotencyKeyFor(
  state: IdentityIdempotencyRef,
  operation:
    | "refresh"
    | "resend"
    | "reset-confirm"
    | "reset-request"
    | "revoke-all"
    | "sign-in"
    | "sign-out"
    | "sign-up"
    | "verify",
  payload: unknown,
): string {
  const fingerprint = `${operation}:${JSON.stringify(payload)}`;
  if (state.current?.fingerprint !== fingerprint) {
    state.current = { fingerprint, key: crypto.randomUUID() };
  }
  return state.current.key;
}

export function normalizeVerificationCode(value: string): string {
  return value.replaceAll(/[^0-9]/gu, "").slice(0, 6);
}

function identityErrorCode(payload: unknown): string | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload) ||
    typeof payload.error !== "object" ||
    payload.error === null ||
    !("code" in payload.error) ||
    typeof payload.error.code !== "string"
  ) {
    return null;
  }
  return payload.error.code;
}

export async function identityErrorMessage(
  response: Response,
  messages: Readonly<Record<string, string>>,
): Promise<string> {
  try {
    const code = identityErrorCode((await response.json()) as unknown);
    if (code !== null) {
      for (const [candidate, message] of Object.entries(messages)) {
        if (candidate === code) return message;
      }
    }
  } catch {
    // The BFF normally guarantees JSON; this is the browser-safe fallback.
  }
  return "Non è stato possibile completare la richiesta. Riprova.";
}
