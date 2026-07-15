import type { SafeErrorMetadata } from "./contracts.js";

const REDACTED_VALUE = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_OBJECT_KEYS = 32;
const MAX_ARRAY_ITEMS = 32;
const MAX_STRING_LENGTH = 512;
const MAX_DIAGNOSTIC_CODE_LENGTH = 128;
const MAX_BREADCRUMBS = 32;
const MAX_EXCEPTION_VALUES = 8;
const MAX_STACK_FRAMES = 64;

const ALLOWED_BREADCRUMB_MESSAGES = new Set([
  "web.request.started",
  "web.request.completed",
  "web.request.failed",
  "api.request.started",
  "api.request.completed",
  "api.request.failed",
  "queue.enqueue",
  "worker.process.started",
  "worker.process.completed",
  "worker.process.failed",
  "trace_context.rejected",
  "request_id.rejected",
  "observability.initialized",
  "observability.shutdown_failed",
  "error.captured",
]);

const ALLOWED_BREADCRUMB_LEVELS = new Set([
  "debug",
  "info",
  "warning",
  "error",
  "fatal",
]);

const ALLOWED_EXCEPTION_TYPES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "RuntimeConfigurationError",
  "ObservabilityConfigurationError",
]);

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "passwd",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "dsn",
  "sentrydsn",
  "body",
  "request",
  "requestbody",
  "response",
  "responsebody",
  "prompt",
  "rawprompt",
  "narration",
  "output",
  "aioutput",
  "rawoutput",
  "tool",
  "toolpayload",
  "toolrawpayload",
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

interface SanitizedSentryFrame {
  readonly filename?: string;
  readonly function?: string;
  readonly lineno?: number;
  readonly colno?: number;
  readonly in_app?: boolean;
}

interface SanitizedSentryException {
  readonly type: string;
  readonly value: string;
  readonly stacktrace?: {
    readonly frames: readonly SanitizedSentryFrame[];
  };
}

interface SanitizedSentryBreadcrumb {
  readonly timestamp?: number;
  readonly level?: string;
  readonly category?: string;
  readonly message: string;
}

export interface SanitizedSentryEvent {
  readonly breadcrumbs?: readonly SanitizedSentryBreadcrumb[];
  readonly contexts?: {
    readonly trace: {
      readonly requestId: string;
      readonly traceId: string;
    };
  };
  readonly environment?: "local" | "staging" | "production";
  readonly exception?: {
    readonly values: readonly SanitizedSentryException[];
  };
  readonly fingerprint: readonly string[];
  readonly release?: string;
  readonly tags: {
    readonly errorCode: string;
    readonly event: string;
  };
}

export function sanitizeTelemetryValue(input: unknown): JsonSafeValue {
  return sanitizeValue(input, 0, new WeakSet<object>());
}

export function sanitizeSentryEvent(
  event: unknown,
  metadata: SafeErrorMetadata,
): SanitizedSentryEvent {
  const errorCode = sanitizeDiagnosticCode(
    getOwnDataValue(metadata, "errorCode"),
    "UNEXPECTED_ERROR",
  );
  const eventName = sanitizeDiagnosticCode(
    getOwnDataValue(metadata, "event"),
    "error.captured",
  );
  const breadcrumbs = sanitizeBreadcrumbs(
    getOwnDataValue(event, "breadcrumbs"),
  );
  const traceContext = sanitizeTraceContext(
    getOwnDataValue(getOwnDataValue(event, "contexts"), "trace"),
  );
  const environment = sanitizeEnvironment(
    getOwnDataValue(event, "environment"),
  );
  const exceptionValues = sanitizeExceptionValues(
    getOwnDataValue(getOwnDataValue(event, "exception"), "values"),
    errorCode,
  );
  const release = sanitizeRelease(getOwnDataValue(event, "release"));

  return deepFreeze({
    ...(breadcrumbs.length > 0 ? { breadcrumbs } : {}),
    ...(traceContext === undefined
      ? {}
      : { contexts: { trace: traceContext } }),
    ...(environment === undefined ? {} : { environment }),
    ...(exceptionValues.length > 0
      ? { exception: { values: exceptionValues } }
      : {}),
    fingerprint: [errorCode],
    ...(release === undefined ? {} : { release }),
    tags: { errorCode, event: eventName },
  });
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

  const arrayInput = isArray(input);

  if (arrayInput === undefined) {
    return REDACTED_VALUE;
  }

  if (arrayInput) {
    return sanitizeArray(input as unknown[], depth, ancestors);
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
      const value = SENSITIVE_KEYS.has(normalizeKey(key))
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

function getOwnDataValue(input: unknown, key: string): unknown {
  if (input === null || typeof input !== "object") {
    return undefined;
  }

  let descriptor: PropertyDescriptor | undefined;

  try {
    descriptor = Object.getOwnPropertyDescriptor(input, key);
  } catch {
    return undefined;
  }

  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function getBoundedArrayItems(input: unknown, limit: number): unknown[] {
  if (input === null || typeof input !== "object" || isArray(input) !== true) {
    return [];
  }

  const descriptors = getDescriptors(input);

  if (descriptors === undefined) {
    return [];
  }

  const lengthDescriptor = descriptors.length;
  const length =
    typeof lengthDescriptor?.value === "number" &&
    Number.isSafeInteger(lengthDescriptor.value) &&
    lengthDescriptor.value >= 0
      ? Math.min(lengthDescriptor.value, limit)
      : 0;
  const items: unknown[] = [];

  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];

    if (descriptor?.enumerable === true && "value" in descriptor) {
      items.push(descriptor.value);
    }
  }

  return items;
}

function sanitizeBreadcrumbs(input: unknown): SanitizedSentryBreadcrumb[] {
  const breadcrumbs: SanitizedSentryBreadcrumb[] = [];

  for (const candidate of getBoundedArrayItems(input, MAX_BREADCRUMBS)) {
    const message = getOwnDataValue(candidate, "message");

    if (
      typeof message !== "string" ||
      !ALLOWED_BREADCRUMB_MESSAGES.has(message)
    ) {
      continue;
    }

    const timestamp = sanitizeFiniteNumber(
      getOwnDataValue(candidate, "timestamp"),
    );
    const levelCandidate = getOwnDataValue(candidate, "level");
    const level =
      typeof levelCandidate === "string" &&
      ALLOWED_BREADCRUMB_LEVELS.has(levelCandidate)
        ? levelCandidate
        : undefined;
    const categoryCandidate = getOwnDataValue(candidate, "category");
    const category = isSafeDiagnosticCode(categoryCandidate)
      ? categoryCandidate
      : undefined;

    breadcrumbs.push({
      ...(category === undefined ? {} : { category }),
      ...(level === undefined ? {} : { level }),
      message,
      ...(timestamp === undefined ? {} : { timestamp }),
    });
  }

  return breadcrumbs;
}

function sanitizeTraceContext(
  input: unknown,
): { requestId: string; traceId: string } | undefined {
  const requestId = getOwnDataValue(input, "requestId");
  const traceId = getOwnDataValue(input, "traceId");

  return isCanonicalRequestId(requestId) && isCanonicalTraceId(traceId)
    ? { requestId, traceId }
    : undefined;
}

function sanitizeEnvironment(
  input: unknown,
): "local" | "staging" | "production" | undefined {
  return input === "local" || input === "staging" || input === "production"
    ? input
    : undefined;
}

function sanitizeRelease(input: unknown): string | undefined {
  return typeof input === "string" &&
    input.length > 0 &&
    input.length <= MAX_DIAGNOSTIC_CODE_LENGTH &&
    hasOnlyReleaseCharacters(input)
    ? input
    : undefined;
}

function sanitizeExceptionValues(
  input: unknown,
  errorCode: string,
): SanitizedSentryException[] {
  const values: SanitizedSentryException[] = [];

  for (const candidate of getBoundedArrayItems(input, MAX_EXCEPTION_VALUES)) {
    const typeCandidate = getOwnDataValue(candidate, "type");
    const type =
      typeof typeCandidate === "string" &&
      ALLOWED_EXCEPTION_TYPES.has(typeCandidate)
        ? typeCandidate
        : "Error";
    const frames = sanitizeStackFrames(
      getOwnDataValue(getOwnDataValue(candidate, "stacktrace"), "frames"),
    );

    values.push({
      ...(frames.length > 0 ? { stacktrace: { frames } } : {}),
      type,
      value: errorCode,
    });
  }

  return values;
}

function sanitizeStackFrames(input: unknown): SanitizedSentryFrame[] {
  const frames: SanitizedSentryFrame[] = [];

  for (const candidate of getBoundedArrayItems(input, MAX_STACK_FRAMES)) {
    const filename = sanitizeFilename(getOwnDataValue(candidate, "filename"));
    const functionName = sanitizeFunctionName(
      getOwnDataValue(candidate, "function"),
    );
    const lineno = sanitizePositiveInteger(
      getOwnDataValue(candidate, "lineno"),
    );
    const colno = sanitizePositiveInteger(getOwnDataValue(candidate, "colno"));
    const inAppCandidate = getOwnDataValue(candidate, "in_app");
    const inApp =
      typeof inAppCandidate === "boolean" ? inAppCandidate : undefined;
    const frame: SanitizedSentryFrame = {
      ...(colno === undefined ? {} : { colno }),
      ...(filename === undefined ? {} : { filename }),
      ...(functionName === undefined ? {} : { function: functionName }),
      ...(inApp === undefined ? {} : { in_app: inApp }),
      ...(lineno === undefined ? {} : { lineno }),
    };

    if (Object.keys(frame).length > 0) {
      frames.push(frame);
    }
  }

  return frames;
}

function sanitizeDiagnosticCode(input: unknown, fallback: string): string {
  return isSafeDiagnosticCode(input) ? input : fallback;
}

function isSafeDiagnosticCode(input: unknown): input is string {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_DIAGNOSTIC_CODE_LENGTH
  ) {
    return false;
  }

  for (const character of input) {
    const code = character.charCodeAt(0);
    const isUppercase = code >= 65 && code <= 90;
    const isLowercase = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isPunctuation =
      character === "." ||
      character === "_" ||
      character === ":" ||
      character === "-";

    if (!isUppercase && !isLowercase && !isDigit && !isPunctuation) {
      return false;
    }
  }

  return true;
}

function hasOnlyReleaseCharacters(input: string): boolean {
  for (const character of input) {
    const code = character.charCodeAt(0);
    const isUppercase = code >= 65 && code <= 90;
    const isLowercase = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isPunctuation =
      character === "." ||
      character === "_" ||
      character === "+" ||
      character === "-";

    if (!isUppercase && !isLowercase && !isDigit && !isPunctuation) {
      return false;
    }
  }

  return true;
}

function sanitizeFilename(input: unknown): string | undefined {
  if (typeof input !== "string" || input.length === 0) {
    return undefined;
  }

  const bounded = input.slice(-1_024);
  const slashIndex = Math.max(
    bounded.lastIndexOf("/"),
    bounded.lastIndexOf("\\"),
  );
  const basename = bounded.slice(slashIndex + 1);

  return basename.length > 0 &&
    basename.length <= MAX_DIAGNOSTIC_CODE_LENGTH &&
    hasOnlyFilenameCharacters(basename)
    ? basename
    : undefined;
}

function hasOnlyFilenameCharacters(input: string): boolean {
  for (const character of input) {
    const code = character.charCodeAt(0);
    const isUppercase = code >= 65 && code <= 90;
    const isLowercase = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isPunctuation =
      character === "." || character === "_" || character === "-";

    if (!isUppercase && !isLowercase && !isDigit && !isPunctuation) {
      return false;
    }
  }

  return true;
}

function sanitizeFunctionName(input: unknown): string | undefined {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > MAX_DIAGNOSTIC_CODE_LENGTH
  ) {
    return undefined;
  }

  for (const character of input) {
    const code = character.charCodeAt(0);
    const isUppercase = code >= 65 && code <= 90;
    const isLowercase = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isPunctuation =
      character === "." ||
      character === "_" ||
      character === ":" ||
      character === "$" ||
      character === "<" ||
      character === ">" ||
      character === "-";

    if (!isUppercase && !isLowercase && !isDigit && !isPunctuation) {
      return undefined;
    }
  }

  return input;
}

function sanitizeFiniteNumber(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) && input >= 0
    ? input
    : undefined;
}

function sanitizePositiveInteger(input: unknown): number | undefined {
  return typeof input === "number" && Number.isSafeInteger(input) && input > 0
    ? input
    : undefined;
}

function isCanonicalRequestId(input: unknown): input is string {
  if (typeof input !== "string" || input.length !== 36) {
    return false;
  }

  for (let index = 0; index < input.length; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      if (input.charAt(index) !== "-") {
        return false;
      }

      continue;
    }

    if (!isLowercaseHex(input.charAt(index))) {
      return false;
    }
  }

  return (
    input.charAt(14) === "4" &&
    (input.charAt(19) === "8" ||
      input.charAt(19) === "9" ||
      input.charAt(19) === "a" ||
      input.charAt(19) === "b")
  );
}

function isCanonicalTraceId(input: unknown): input is string {
  if (typeof input !== "string" || input.length !== 32) {
    return false;
  }

  let hasNonZeroCharacter = false;

  for (const character of input) {
    if (!isLowercaseHex(character)) {
      return false;
    }

    hasNonZeroCharacter ||= character !== "0";
  }

  return hasNonZeroCharacter;
}

function isLowercaseHex(input: string | undefined): boolean {
  if (input === undefined || input.length !== 1) {
    return false;
  }

  const code = input.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 102);
}

function deepFreeze<T>(input: T): T {
  if (input === null || typeof input !== "object") {
    return input;
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);

  for (const descriptor of Object.values(descriptors)) {
    if ("value" in descriptor) {
      deepFreeze(descriptor.value);
    }
  }

  return Object.freeze(input);
}

function isPlainObject(input: object): boolean {
  try {
    const prototype = Object.getPrototypeOf(input);
    return prototype === null || prototype === Object.prototype;
  } catch {
    return false;
  }
}

function isArray(input: object): boolean | undefined {
  try {
    return Array.isArray(input);
  } catch {
    return undefined;
  }
}

function normalizeKey(key: string): string {
  let normalized = "";

  for (const character of key.toLowerCase()) {
    const code = character.charCodeAt(0);
    const isAsciiLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;

    if (isAsciiLetter || isDigit) {
      normalized += character;
    }
  }

  return normalized;
}

function hasUrlUserInfo(input: string): boolean {
  let searchFrom = 0;

  while (searchFrom < input.length) {
    const schemeSeparatorIndex = input.indexOf("://", searchFrom);
    const authorityStart =
      schemeSeparatorIndex >= 0
        ? schemeSeparatorIndex + 3
        : searchFrom === 0 && input.startsWith("//")
          ? 2
          : -1;

    if (authorityStart < 0) {
      return false;
    }

    const authorityEndCandidates = ["/", "?", "#", " ", "\t", "\r", "\n"]
      .map((separator) => input.indexOf(separator, authorityStart))
      .filter((index) => index >= 0);
    const authorityEnd =
      authorityEndCandidates.length > 0
        ? Math.min(...authorityEndCandidates)
        : input.length;

    if (input.slice(authorityStart, authorityEnd).includes("@")) {
      return true;
    }

    searchFrom = Math.max(authorityStart, authorityEnd);
  }

  return false;
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
