const CANONICAL_UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const INVALID_GENERATED_REQUEST_ID_MESSAGE =
  "Unable to generate a valid request ID.";

function isCanonicalUuidV4(value: string): boolean {
  return CANONICAL_UUID_V4_PATTERN.test(value);
}

function defaultRequestIdGenerator(): string {
  const runtimeCrypto: unknown = Reflect.get(globalThis, "crypto");

  if (typeof runtimeCrypto !== "object" || runtimeCrypto === null) {
    throw new Error(INVALID_GENERATED_REQUEST_ID_MESSAGE);
  }

  const randomUUID: unknown = Reflect.get(runtimeCrypto, "randomUUID");

  if (typeof randomUUID !== "function") {
    throw new Error(INVALID_GENERATED_REQUEST_ID_MESSAGE);
  }

  const generated: unknown = Reflect.apply(randomUUID, runtimeCrypto, []);

  if (typeof generated !== "string") {
    throw new Error(INVALID_GENERATED_REQUEST_ID_MESSAGE);
  }

  return generated;
}

export function createRequestId(
  candidate?: string,
  generate: () => string = defaultRequestIdGenerator,
): string {
  if (candidate !== undefined && isCanonicalUuidV4(candidate)) {
    return candidate;
  }

  let generated: string;

  try {
    generated = generate();
  } catch {
    throw new Error(INVALID_GENERATED_REQUEST_ID_MESSAGE);
  }

  if (!isCanonicalUuidV4(generated)) {
    throw new Error(INVALID_GENERATED_REQUEST_ID_MESSAGE);
  }

  return generated;
}
