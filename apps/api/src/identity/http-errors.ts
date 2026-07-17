import type { IdentityErrorResponse } from "@dnd-ai/contracts";

import {
  IdentityApplicationError,
  type IdentityApplicationErrorCode,
} from "./identity-service.js";

export interface IdentityHttpError {
  readonly body: IdentityErrorResponse;
  readonly retryAfterSeconds?: number;
  readonly statusCode: number;
}

const ERROR_MAP = Object.freeze({
  CREDENTIALS_INVALID: Object.freeze({
    code: "identity.credentials_invalid" as const,
    message: "Email o password non corretti.",
    retryable: false,
    statusCode: 401,
  }),
  DELIVERY_UNAVAILABLE: Object.freeze({
    code: "identity.delivery_unavailable" as const,
    message: "Servizio di verifica temporaneamente non disponibile.",
    retryable: true,
    statusCode: 503,
  }),
  IDEMPOTENCY_CONFLICT: Object.freeze({
    code: "identity.idempotency_conflict" as const,
    message: "La chiave della richiesta è già associata a dati diversi.",
    retryable: false,
    statusCode: 409,
  }),
  PASSWORD_REJECTED: Object.freeze({
    code: "identity.request_invalid" as const,
    message: "La password non rispetta i requisiti richiesti.",
    retryable: false,
    statusCode: 422,
  }),
  PASSWORD_RESET_INVALID: Object.freeze({
    code: "identity.password_reset_code_invalid" as const,
    message: "Il codice di recupero non è valido.",
    retryable: false,
    statusCode: 422,
  }),
  RATE_LIMITED: Object.freeze({
    code: "identity.rate_limited" as const,
    message: "Troppe richieste. Riprova più tardi.",
    retryable: false,
    statusCode: 429,
  }),
  REQUEST_INVALID: Object.freeze({
    code: "identity.request_invalid" as const,
    message: "Richiesta non valida.",
    retryable: false,
    statusCode: 400,
  }),
  SESSION_INVALID: Object.freeze({
    code: "identity.session_invalid" as const,
    message: "La sessione non è valida.",
    retryable: false,
    statusCode: 401,
  }),
  VERIFICATION_EXPIRED: Object.freeze({
    code: "identity.verification_expired" as const,
    message: "Il codice di verifica è scaduto.",
    retryable: false,
    statusCode: 410,
  }),
  VERIFICATION_INVALID: Object.freeze({
    code: "identity.verification_invalid" as const,
    message: "Il codice di verifica non è valido.",
    retryable: false,
    statusCode: 422,
  }),
  VERIFICATION_RATE_LIMITED: Object.freeze({
    code: "identity.verification_rate_limited" as const,
    message: "Troppi tentativi di verifica. Riprova più tardi.",
    retryable: false,
    statusCode: 429,
  }),
}) satisfies Readonly<
  Record<
    IdentityApplicationErrorCode,
    Readonly<{
      code: IdentityErrorResponse["error"]["code"];
      message: string;
      retryable: boolean;
      statusCode: number;
    }>
  >
>;

export function toIdentityHttpError(
  error: unknown,
  requestId: string,
): IdentityHttpError {
  const applicationError =
    error instanceof IdentityApplicationError
      ? error
      : new IdentityApplicationError(
          "DELIVERY_UNAVAILABLE",
          "Identity request failed.",
        );
  const definition = ERROR_MAP[applicationError.code];
  return Object.freeze({
    body: Object.freeze({
      error: Object.freeze({
        code: definition.code,
        message: definition.message,
        requestId,
        retryable: definition.retryable,
      }),
    }),
    ...(applicationError.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: applicationError.retryAfterSeconds }),
    statusCode: definition.statusCode,
  });
}

export function identityRequestError(
  requestId: string,
  originRejected = false,
): IdentityHttpError {
  return Object.freeze({
    body: Object.freeze({
      error: Object.freeze({
        code: originRejected
          ? "identity.origin_rejected"
          : "identity.request_invalid",
        message: originRejected
          ? "Origine della richiesta non consentita."
          : "Richiesta non valida.",
        requestId,
        retryable: false,
      }),
    }),
    statusCode: originRejected ? 403 : 400,
  });
}
