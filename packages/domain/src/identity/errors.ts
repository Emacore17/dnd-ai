export type IdentityPolicyErrorCode =
  | "identity.display_name_control"
  | "identity.display_name_length"
  | "identity.email_invalid"
  | "identity.password_common"
  | "identity.password_length";

export class IdentityPolicyError extends Error {
  readonly code: IdentityPolicyErrorCode;

  constructor(code: IdentityPolicyErrorCode) {
    super(code);
    this.name = "IdentityPolicyError";
    this.code = code;
  }
}
