type JsonRecord = Record<string, unknown>;

const identityErrorContent = {
  "application/json": {
    schema: { $ref: "#/components/schemas/IdentityErrorResponse" },
  },
};

function errorResponse(description: string, retryAfter = false): JsonRecord {
  return {
    description,
    content: identityErrorContent,
    ...(retryAfter
      ? {
          headers: {
            "Retry-After": {
              description: "Secondi prima del prossimo tentativo consentito.",
              schema: { type: "integer", minimum: 1 },
            },
          },
        }
      : {}),
  };
}

function requestBody(schemaName: string): JsonRecord {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  };
}

function successResponse(
  description: string,
  schemaName: string,
  setCookie = false,
): JsonRecord {
  return {
    description,
    ...(setCookie
      ? {
          headers: {
            "Set-Cookie": {
              description: "Cookie di sessione __Host- sicuro.",
              schema: { type: "string" },
            },
          },
        }
      : {}),
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  };
}

function noContentResponse(description: string, setCookie = false): JsonRecord {
  return {
    description,
    ...(setCookie
      ? {
          headers: {
            "Set-Cookie": {
              description: "Cookie di sessione eliminato.",
              schema: { type: "string" },
            },
          },
        }
      : {}),
  };
}

function idempotencyHeader(): JsonRecord {
  return {
    name: "Idempotency-Key",
    in: "header",
    required: true,
    schema: { $ref: "#/components/schemas/IdempotencyKey" },
  };
}

const commonResponses = {
  "400": errorResponse("Richiesta non valida."),
  "403": errorResponse("Origine della richiesta rifiutata."),
  "409": errorResponse("Chiave di idempotenza in conflitto."),
  "429": errorResponse("Limite richieste raggiunto.", true),
  "503": errorResponse("Accettazione della delivery non disponibile."),
};

export function createIdentityOpenApiPaths(): JsonRecord {
  return {
    "/api/auth/sign-up": {
      post: {
        operationId: "signUp",
        summary: "Crea o aggiorna una registrazione in attesa di verifica.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("SignUpRequest"),
        responses: {
          "202": successResponse(
            "Registrazione accettata senza rivelare lo stato dell'indirizzo.",
            "VerificationRequiredResponse",
          ),
          ...commonResponses,
        },
      },
    },
    "/api/auth/verify-email": {
      post: {
        operationId: "verifyEmail",
        summary: "Verifica il codice email e crea la sessione iniziale.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("VerifyEmailRequest"),
        responses: {
          "200": successResponse(
            "Email verificata e sessione iniziale creata.",
            "VerifiedResponse",
            true,
          ),
          ...commonResponses,
          "410": errorResponse("Challenge scaduta."),
          "422": errorResponse("Codice di verifica non valido."),
        },
      },
    },
    "/api/auth/resend-verification": {
      post: {
        operationId: "resendVerification",
        summary: "Richiede un nuovo codice di verifica.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("ResendVerificationRequest"),
        responses: {
          "202": successResponse(
            "Richiesta accettata senza rivelare lo stato dell'indirizzo.",
            "VerificationRequiredResponse",
          ),
          ...commonResponses,
        },
      },
    },
    "/api/auth/sign-in": {
      post: {
        operationId: "signIn",
        summary: "Autentica credenziali e crea una nuova sessione.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("SignInRequest"),
        responses: {
          "200": successResponse(
            "Credenziali valide e nuova sessione creata.",
            "AuthenticatedResponse",
            true,
          ),
          ...commonResponses,
          "401": errorResponse("Credenziali non valide."),
        },
      },
    },
    "/api/auth/session/refresh": {
      post: {
        operationId: "refreshSession",
        summary: "Ruota esplicitamente la sessione corrente.",
        parameters: [idempotencyHeader()],
        responses: {
          "200": successResponse(
            "Sessione ruotata.",
            "AuthenticatedResponse",
            true,
          ),
          ...commonResponses,
          "401": errorResponse("Sessione non valida."),
        },
      },
    },
    "/api/auth/sign-out": {
      post: {
        operationId: "signOut",
        summary: "Revoca, se presente, la sessione corrente.",
        parameters: [idempotencyHeader()],
        responses: {
          "204": noContentResponse("Sessione terminata.", true),
          ...commonResponses,
        },
      },
    },
    "/api/auth/sessions/revoke-all": {
      post: {
        operationId: "revokeAllSessions",
        summary: "Revoca tutte le sessioni dell'account autenticato.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("RevokeAllSessionsRequest"),
        responses: {
          "204": noContentResponse(
            "Tutte le sessioni sono state revocate.",
            true,
          ),
          ...commonResponses,
          "401": errorResponse("Sessione non valida."),
        },
      },
    },
    "/api/auth/password-reset/request": {
      post: {
        operationId: "requestPasswordReset",
        summary: "Richiede un codice one-time senza rivelare lo stato account.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("PasswordResetRequest"),
        responses: {
          "202": successResponse(
            "Richiesta accettata con risposta generica.",
            "PasswordResetRequestedResponse",
          ),
          ...commonResponses,
        },
      },
    },
    "/api/auth/password-reset/confirm": {
      post: {
        operationId: "confirmPasswordReset",
        summary: "Conferma il codice one-time e sostituisce la password.",
        parameters: [idempotencyHeader()],
        requestBody: requestBody("PasswordResetConfirm"),
        responses: {
          "200": successResponse(
            "Password sostituita e sessioni revocate.",
            "PasswordResetCompletedResponse",
            true,
          ),
          ...commonResponses,
          "422": errorResponse("Codice di recupero non valido."),
        },
      },
    },
  };
}
