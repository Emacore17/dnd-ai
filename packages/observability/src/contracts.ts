export type ObservabilityService = "web" | "api" | "worker";

export interface TraceCarrier {
  readonly requestId: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
}

export interface ObservabilityContext {
  readonly service: ObservabilityService;
  readonly environment: "local" | "staging" | "production";
  readonly requestId: string;
  readonly traceId: string;
  readonly spanId: string;
}

export interface SafeLogEvent {
  readonly event: string;
  readonly durationMs?: number;
  readonly errorCode?: string;
  readonly turnId?: string;
  readonly campaignHash?: string;
}

export interface SafeErrorMetadata {
  readonly event: string;
  readonly errorCode: string;
}

export interface ErrorReporter {
  capture(
    error: unknown,
    context: ObservabilityContext,
    metadata: SafeErrorMetadata,
  ): void;
  flush(timeoutMs: number): Promise<boolean>;
}
