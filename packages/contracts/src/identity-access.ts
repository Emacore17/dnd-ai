import { z } from "zod";

import { IdentityEmailSchema, IdentityPasswordSchema } from "./identity.js";

export const SignInRequestSchema = z.strictObject({
  email: IdentityEmailSchema,
  password: IdentityPasswordSchema,
});

export const PasswordResetRequestSchema = z.strictObject({
  email: IdentityEmailSchema,
});

export const PasswordResetConfirmSchema = z.strictObject({
  email: IdentityEmailSchema,
  code: z.string().regex(/^[0-9]{6}$/u),
  newPassword: IdentityPasswordSchema,
});

export const RevokeAllSessionsRequestSchema = z.strictObject({
  confirmation: z.literal("revoke_all"),
});

export const AuthenticatedResponseSchema = z.strictObject({
  status: z.literal("authenticated"),
});

export const PasswordResetRequestedResponseSchema = z.strictObject({
  status: z.literal("password_reset_requested"),
});

export const PasswordResetCompletedResponseSchema = z.strictObject({
  status: z.literal("password_reset"),
});

export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type RevokeAllSessionsRequest = z.infer<
  typeof RevokeAllSessionsRequestSchema
>;
export type AuthenticatedResponse = z.infer<typeof AuthenticatedResponseSchema>;
export type PasswordResetRequestedResponse = z.infer<
  typeof PasswordResetRequestedResponseSchema
>;
export type PasswordResetCompletedResponse = z.infer<
  typeof PasswordResetCompletedResponseSchema
>;
