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
  };
}
