export interface VerificationEmailMessage {
  readonly kind: "verification";
  readonly recipient: string;
  readonly displayName: string;
  readonly code: string;
  readonly expiresInMinutes: 10;
}

export interface PasswordResetEmailMessage {
  readonly kind: "password_reset";
  readonly recipient: string;
  readonly code: string;
  readonly expiresInMinutes: 10;
}

export type IdentityEmailMessage =
  VerificationEmailMessage | PasswordResetEmailMessage;

export interface VerificationEmailSender {
  send(message: IdentityEmailMessage): Promise<void>;
  close?(): Promise<void>;
}

export class EmailDeliveryError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmailDeliveryError";
    this.retryable = retryable;
  }
}

export interface FakeVerificationEmailSender extends VerificationEmailSender {
  readonly messages: readonly IdentityEmailMessage[];
}

export function createFakeVerificationEmailSender(): FakeVerificationEmailSender {
  const messages: IdentityEmailMessage[] = [];

  return Object.freeze({
    get messages(): readonly IdentityEmailMessage[] {
      return Object.freeze([...messages]);
    },
    async send(message: IdentityEmailMessage): Promise<void> {
      messages.push(Object.freeze({ ...message }));
    },
  });
}
