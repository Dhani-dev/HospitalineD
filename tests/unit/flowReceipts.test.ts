import { describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "../../src/http/release";
import {
  isFlowReceiptTrace,
  scheduleFlowReceipt,
  type ReceiptWriter
} from "../../src/receipts/flowReceipts";

describe("flow receipts", () => {
  it("accepts only gd4 trace ids", () => {
    expect(isFlowReceiptTrace("gd4-prueba-1")).toBe(true);
    expect(isFlowReceiptTrace("gd4-r0-abc")).toBe(true);
    expect(isFlowReceiptTrace("11111111-1111-1111-1111-111111111111")).toBe(false);
    expect(isFlowReceiptTrace("gd4-")).toBe(false);
    expect(isFlowReceiptTrace("gd4-con/barra")).toBe(false);
  });

  it("writes a receipt without waiting, and skips the normal flow", async () => {
    const writes: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writer: ReceiptWriter = {
      write: async (receipt) => {
        await gate;
        writes.push(receipt.trace_id);
        expect(receipt.api).toBe("hospitaline");
        expect(receipt.version).toBe(APP_VERSION);
        expect(receipt.entity).toBe("hospital");
      }
    };

    scheduleFlowReceipt("gd4-prueba-1", writer);
    scheduleFlowReceipt("trafico-normal", writer);
    expect(writes).toEqual([]);
    release();

    await vi.waitFor(() => expect(writes).toEqual(["gd4-prueba-1"]));
  });

  it("keeps going when the write fails", async () => {
    const errors: unknown[] = [];
    const writer: ReceiptWriter = {
      write: async () => {
        throw new Error("bucket down");
      }
    };

    scheduleFlowReceipt("gd4-prueba-1", writer, (error) => errors.push(error));
    await vi.waitFor(() => expect(errors).toHaveLength(1));
  });
});
