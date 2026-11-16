import { AsyncLocalStorage } from "node:async_hooks";

export const FAULT_HEADER = "x-fault-mode";
export const RESILIENCE_HEADER = "x-peer-resilience";
export const DEPENDENCY_DOWN = "dependency-down";

type ChaosStore = {
  fault: boolean;
  resilience: boolean;
  degraded: string | null;
};

const storage = new AsyncLocalStorage<ChaosStore>();

function headerValue(headers: Record<string, unknown>, name: string): string {
  const value = headers[name];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

export function enterChaosHeaders(headers: Record<string, unknown>): void {
  storage.enterWith({
    fault: headerValue(headers, FAULT_HEADER) === DEPENDENCY_DOWN,
    resilience: headerValue(headers, RESILIENCE_HEADER) === "true",
    degraded: null
  });
}

export function dependencyFaultRequested(): boolean {
  return storage.getStore()?.fault ?? false;
}

export function resilienceEnabled(): boolean {
  return storage.getStore()?.resilience ?? false;
}

export function markDegraded(peer: string): void {
  const store = storage.getStore();
  if (store) {
    store.degraded = peer;
  }
}

export function degradedPeer(): string | null {
  return storage.getStore()?.degraded ?? null;
}
