export interface VerificationEmailMessage {
  readonly recipient: string;
  readonly displayName: string;
  readonly code: string;
  readonly expiresInMinutes: 10;
}

export interface VerificationEmailSender {
  send(message: VerificationEmailMessage): Promise<void>;
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
  readonly messages: readonly VerificationEmailMessage[];
}

export function createFakeVerificationEmailSender(): FakeVerificationEmailSender {
  const messages: VerificationEmailMessage[] = [];

  return Object.freeze({
    get messages(): readonly VerificationEmailMessage[] {
      return Object.freeze([...messages]);
    },
    async send(message: VerificationEmailMessage): Promise<void> {
      messages.push(Object.freeze({ ...message }));
    },
  });
}
