import type {
  NodeObservability,
  ObservabilityContext,
  TraceCarrier,
} from "@dnd-ai/observability/node";

export interface ObservedWorkerEnvelope<Payload> {
  readonly observability: TraceCarrier;
  readonly payload: Payload;
}

export type ObservedWorkerProcessor<Payload, Result> = (
  payload: Payload,
  context: ObservabilityContext,
) => Promise<Result> | Result;

export function createObservedWorkerProcessor<Payload, Result>(
  observability: NodeObservability,
  processor: ObservedWorkerProcessor<Payload, Result>,
): (envelope: ObservedWorkerEnvelope<Payload>) => Promise<Result> {
  return async (envelope: ObservedWorkerEnvelope<Payload>): Promise<Result> => {
    const operation = observability.startOperation({
      carrier: envelope.observability,
      kind: "consumer",
      name: "worker.process",
    });

    return operation.run(async () => {
      operation.log("info", { event: "worker.process.started" });

      try {
        const result = await processor(envelope.payload, operation.context);
        operation.log("info", { event: "worker.process.completed" });
        operation.end();
        return result;
      } catch (error) {
        operation.log("error", {
          errorCode: "WORKER_PROCESS_FAILED",
          event: "worker.process.failed",
        });
        operation.capture(error, {
          errorCode: "WORKER_PROCESS_FAILED",
          event: "error.captured",
        });
        operation.end({ errorCode: "WORKER_PROCESS_FAILED" });
        throw error;
      }
    });
  };
}
