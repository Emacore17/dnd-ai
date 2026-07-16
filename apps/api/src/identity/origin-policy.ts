import type { FastifyRequest } from "fastify";

function singleHeader(
  request: FastifyRequest,
  name:
    | "idempotency-key"
    | "origin"
    | "sec-fetch-site"
    | "x-correlation-id"
    | "x-dnd-ai-client-issued-at"
    | "x-dnd-ai-client-signature"
    | "x-dnd-ai-client-subject"
    | "x-request-id",
): string | undefined {
  const value = (() => {
    switch (name) {
      case "idempotency-key":
        return request.headers["idempotency-key"];
      case "origin":
        return request.headers.origin;
      case "sec-fetch-site":
        return request.headers["sec-fetch-site"];
      case "x-correlation-id":
        return request.headers["x-correlation-id"];
      case "x-dnd-ai-client-issued-at":
        return request.headers["x-dnd-ai-client-issued-at"];
      case "x-dnd-ai-client-signature":
        return request.headers["x-dnd-ai-client-signature"];
      case "x-dnd-ai-client-subject":
        return request.headers["x-dnd-ai-client-subject"];
      case "x-request-id":
        return request.headers["x-request-id"];
    }
  })();
  return typeof value === "string" ? value : undefined;
}

export function isIdentityOriginAllowed(
  request: FastifyRequest,
  publicOrigin: string,
): boolean {
  let expectedOrigin: string;
  try {
    const parsed = new URL(publicOrigin);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.origin !== publicOrigin
    ) {
      return false;
    }
    expectedOrigin = parsed.origin;
  } catch {
    return false;
  }
  const origin = singleHeader(request, "origin");
  const fetchSite = singleHeader(request, "sec-fetch-site");
  return (
    origin === expectedOrigin &&
    (fetchSite === undefined || fetchSite === "same-origin")
  );
}

export function readSingleIdentityHeader(
  request: FastifyRequest,
  name:
    | "idempotency-key"
    | "origin"
    | "sec-fetch-site"
    | "x-correlation-id"
    | "x-dnd-ai-client-issued-at"
    | "x-dnd-ai-client-signature"
    | "x-dnd-ai-client-subject"
    | "x-request-id",
): string | undefined {
  return singleHeader(request, name);
}
