const REDACTED_VALUE = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_OBJECT_KEYS = 32;
const MAX_ARRAY_ITEMS = 32;
const MAX_STRING_LENGTH = 512;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwd",
  "token",
  "apikey",
  "api_key",
  "dsn",
  "body",
  "request",
  "response",
  "prompt",
  "narration",
  "output",
  "tool",
  "chainofthought",
  "user",
  "headers",
  "extra",
]);

type JsonSafeValue =
  | null
  | boolean
  | number
  | string
  | JsonSafeValue[]
  | { [key: string]: JsonSafeValue };

export function sanitizeTelemetryValue(input: unknown): JsonSafeValue {
  return sanitizeValue(input, 0, new WeakSet<object>());
}

function sanitizeValue(
  input: unknown,
  depth: number,
  ancestors: WeakSet<object>,
): JsonSafeValue {
  if (input === null || typeof input === "boolean") {
    return input;
  }

  if (typeof input === "number") {
    return Number.isFinite(input) ? input : REDACTED_VALUE;
  }

  if (typeof input === "string") {
    if (hasEmailAddress(input) || hasUrlUserInfo(input)) {
      return REDACTED_VALUE;
    }

    return input.slice(0, MAX_STRING_LENGTH);
  }

  if (typeof input !== "object") {
    return REDACTED_VALUE;
  }

  if (depth >= MAX_DEPTH || ancestors.has(input)) {
    return REDACTED_VALUE;
  }

  if (Array.isArray(input)) {
    return sanitizeArray(input, depth, ancestors);
  }

  if (!isPlainObject(input)) {
    return REDACTED_VALUE;
  }

  return sanitizeObject(input, depth, ancestors);
}

function sanitizeArray(
  input: unknown[],
  depth: number,
  ancestors: WeakSet<object>,
): JsonSafeValue[] | string {
  const descriptors = getDescriptors(input);

  if (descriptors === undefined) {
    return REDACTED_VALUE;
  }

  const lengthDescriptor = descriptors.length;
  const length =
    typeof lengthDescriptor?.value === "number"
      ? Math.min(lengthDescriptor.value, MAX_ARRAY_ITEMS)
      : 0;
  const itemDescriptors = new Map(Object.entries(descriptors));
  const sanitized: JsonSafeValue[] = [];
  ancestors.add(input);

  try {
    for (let index = 0; index < length; index += 1) {
      const descriptor = itemDescriptors.get(String(index));
      sanitized.push(
        descriptor?.enumerable === true && "value" in descriptor
          ? sanitizeValue(descriptor.value, depth + 1, ancestors)
          : REDACTED_VALUE,
      );
    }
  } finally {
    ancestors.delete(input);
  }

  return sanitized;
}

function sanitizeObject(
  input: object,
  depth: number,
  ancestors: WeakSet<object>,
): { [key: string]: JsonSafeValue } | string {
  const descriptors = getDescriptors(input);

  if (descriptors === undefined) {
    return REDACTED_VALUE;
  }

  const entries = Object.entries(descriptors)
    .filter(
      (entry): entry is [string, PropertyDescriptor & { value: unknown }] =>
        entry[1].enumerable === true && "value" in entry[1],
    )
    .sort(([leftKey], [rightKey]) =>
      leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0,
    )
    .slice(0, MAX_OBJECT_KEYS);
  const sanitized: { [key: string]: JsonSafeValue } = {};
  ancestors.add(input);

  try {
    for (const [key, descriptor] of entries) {
      const value = SENSITIVE_KEYS.has(key.toLowerCase())
        ? REDACTED_VALUE
        : sanitizeValue(descriptor.value, depth + 1, ancestors);

      Object.defineProperty(sanitized, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    }
  } finally {
    ancestors.delete(input);
  }

  return sanitized;
}

function getDescriptors(
  input: object,
): Record<PropertyKey, PropertyDescriptor> | undefined {
  try {
    return Object.getOwnPropertyDescriptors(input);
  } catch {
    return undefined;
  }
}

function isPlainObject(input: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(input);
    return prototype === null || prototype === Object.prototype;
  } catch {
    return false;
  }
}

function hasUrlUserInfo(input: string): boolean {
  const schemeSeparatorIndex = input.indexOf("://");
  const authorityStart =
    schemeSeparatorIndex > 0
      ? schemeSeparatorIndex + 3
      : input.startsWith("//")
        ? 2
        : -1;

  if (authorityStart < 0) {
    return false;
  }

  const authorityEndCandidates = ["/", "?", "#"]
    .map((separator) => input.indexOf(separator, authorityStart))
    .filter((index) => index >= 0);
  const authorityEnd =
    authorityEndCandidates.length > 0
      ? Math.min(...authorityEndCandidates)
      : input.length;

  return input.slice(authorityStart, authorityEnd).includes("@");
}

function hasEmailAddress(input: string): boolean {
  const atIndex = input.indexOf("@");

  if (atIndex <= 0) {
    return false;
  }

  const domainStart = atIndex + 1;
  const dotIndex = input.indexOf(".", domainStart + 1);

  return dotIndex > domainStart && dotIndex < input.length - 1;
}
