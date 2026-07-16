import { z } from "zod";

import { RequestIdSchema } from "./identifiers.js";

const EMAIL_MAX_BYTES = 254;
const DISPLAY_NAME_MIN_CHARACTERS = 2;
const DISPLAY_NAME_MAX_CHARACTERS = 40;
const PASSWORD_MIN_CHARACTERS = 15;
const PASSWORD_MAX_CHARACTERS = 128;

function characterCount(value: string): number {
  return [...value].length;
}

function utf8ByteCount(value: string): number {
  return [...value].reduce((total, character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) return total + 1;
    if (codePoint <= 0x7ff) return total + 2;
    if (codePoint <= 0xffff) return total + 3;
    return total + 4;
  }, 0);
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    );
  });
}

export const IdentityEmailSchema = z
  .string()
  .min(1)
  .refine((value) => !hasControlCharacter(value))
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .email()
      .refine((value) => utf8ByteCount(value) <= EMAIL_MAX_BYTES),
  );

export const DisplayNameSchema = z
  .string()
  .refine((value) => !hasControlCharacter(value))
  .transform((value) => value.normalize("NFC").trim())
  .pipe(
    z.string().refine((value) => {
      const length = characterCount(value);
      return (
        length >= DISPLAY_NAME_MIN_CHARACTERS &&
        length <= DISPLAY_NAME_MAX_CHARACTERS
      );
    }),
  );

export const IdentityPasswordSchema = z
  .string()
  .transform((value) => value.normalize("NFC"))
  .pipe(
    z.string().refine((value) => {
      const length = characterCount(value);
      return (
        length >= PASSWORD_MIN_CHARACTERS && length <= PASSWORD_MAX_CHARACTERS
      );
    }),
  );

export const IdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export const SignUpRequestSchema = z.strictObject({
  email: IdentityEmailSchema,
  password: IdentityPasswordSchema,
  displayName: DisplayNameSchema,
});

export const VerifyEmailRequestSchema = z.strictObject({
  email: IdentityEmailSchema,
  code: z.string().regex(/^[0-9]{6}$/u),
});

export const ResendVerificationRequestSchema = z.strictObject({
  email: IdentityEmailSchema,
});

export const VerificationRequiredResponseSchema = z.strictObject({
  status: z.literal("verification_required"),
  challengeExpiresInSeconds: z.literal(600),
  resendAfterSeconds: z.literal(60),
});

export const VerifiedResponseSchema = z.strictObject({
  status: z.literal("verified"),
});

export const IdentityErrorCodeSchema = z.enum([
  "identity.request_invalid",
  "identity.origin_rejected",
  "identity.idempotency_conflict",
  "identity.verification_expired",
  "identity.verification_invalid",
  "identity.verification_rate_limited",
  "identity.rate_limited",
  "identity.delivery_unavailable",
]);

export const IdentityErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: IdentityErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
    retryable: z.boolean(),
  }),
});

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;
export type ResendVerificationRequest = z.infer<
  typeof ResendVerificationRequestSchema
>;
export type VerificationRequiredResponse = z.infer<
  typeof VerificationRequiredResponseSchema
>;
export type VerifiedResponse = z.infer<typeof VerifiedResponseSchema>;
export type IdentityErrorResponse = z.infer<typeof IdentityErrorResponseSchema>;
