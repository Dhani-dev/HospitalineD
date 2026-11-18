import { Storage } from "@google-cloud/storage";
import { APP_VERSION } from "../http/release";

const FLOW_RECEIPT_TRACE = /^gd4-[A-Za-z0-9-]{1,80}$/;

export type FlowReceipt = {
  trace_id: string;
  written_at: string;
  api: "hospitaline";
  version: string;
  entity: "hospital";
};

export type ReceiptWriter = {
  write(receipt: FlowReceipt): Promise<void>;
};

export function isFlowReceiptTrace(traceId: string): boolean {
  return FLOW_RECEIPT_TRACE.test(traceId);
}

export function createReceiptWriter(env: NodeJS.ProcessEnv = process.env): ReceiptWriter | null {
  if (env.FLOW_RECEIPTS_ENABLED !== "true") {
    return null;
  }
  const bucketName = env.FLOW_RECEIPTS_BUCKET?.trim();
  if (!bucketName) {
    return null;
  }
  const bucket = new Storage().bucket(bucketName);
  return {
    write(receipt) {
      return bucket.file(`receipts/${receipt.trace_id}.json`).save(JSON.stringify(receipt), {
        contentType: "application/json",
        resumable: false
      });
    }
  };
}

export function scheduleFlowReceipt(
  traceId: string,
  writer: ReceiptWriter | null,
  onError: (error: unknown) => void = () => undefined
): void {
  if (!writer || !isFlowReceiptTrace(traceId)) {
    return;
  }
  const receipt: FlowReceipt = {
    trace_id: traceId,
    written_at: new Date().toISOString(),
    api: "hospitaline",
    version: APP_VERSION,
    entity: "hospital"
  };
  void writer.write(receipt).catch(onError);
}
