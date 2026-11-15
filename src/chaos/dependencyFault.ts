import { CacheClient } from "../cache/cacheClient";

export type PeerName = "biblio-express" | "pokenetes";
export type FaultTarget = PeerName | "all";

export type DependencyFault = {
  fault: "dependency-5xx";
  target: FaultTarget;
  rate: number;
  status: number;
  source: "env" | "api";
  expiresAt?: string;
};

export type FaultRequest = {
  target: FaultTarget;
  rate: number;
  durationSeconds: number;
};

export const FAULT_KEY = "hospitaline:chaos:dependency-5xx";
export const FAULT_STATUS = 503;

// Las dos réplicas leen Redis como mucho una vez por segundo.
const REFRESH_MS = 1000;

const TARGETS: FaultTarget[] = ["biblio-express", "pokenetes", "all"];

export function parseTarget(value: string): FaultTarget {
  return (TARGETS as string[]).includes(value) ? (value as FaultTarget) : "biblio-express";
}

export function parseRate(value: string | undefined): number {
  const rate = Number(value ?? 1);
  return Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 1;
}

export function faultFromEnv(env: NodeJS.ProcessEnv = process.env): DependencyFault | null {
  const target = env.CHAOS_DEPENDENCY_5XX?.trim();
  if (!target || target === "off") {
    return null;
  }

  return {
    fault: "dependency-5xx",
    target: parseTarget(target),
    rate: parseRate(env.CHAOS_DEPENDENCY_5XX_RATE),
    status: FAULT_STATUS,
    source: "env"
  };
}

export class DependencyFaultSwitch {
  private snapshot = { value: null as DependencyFault | null, readAt: -Infinity };

  constructor(
    private readonly store?: CacheClient,
    private readonly envFault: DependencyFault | null = faultFromEnv(),
    private readonly now: () => number = Date.now
  ) {}

  async current(): Promise<DependencyFault | null> {
    if (this.envFault || !this.store) {
      return this.envFault;
    }
    if (this.now() - this.snapshot.readAt < REFRESH_MS) {
      return this.snapshot.value;
    }

    const lookup = await this.store.get<DependencyFault>(FAULT_KEY);
    this.remember(lookup.hit ? lookup.value : null);
    return this.snapshot.value;
  }

  async enable(request: FaultRequest): Promise<DependencyFault> {
    const fault: DependencyFault = {
      fault: "dependency-5xx",
      target: request.target,
      rate: request.rate,
      status: FAULT_STATUS,
      source: "api",
      expiresAt: new Date(this.now() + request.durationSeconds * 1000).toISOString()
    };
    await this.store?.set(FAULT_KEY, fault, request.durationSeconds);
    this.remember(fault);
    return fault;
  }

  async disable(): Promise<void> {
    await this.store?.del([FAULT_KEY]);
    this.remember(null);
  }

  private remember(value: DependencyFault | null): void {
    this.snapshot = { value, readAt: this.now() };
  }
}
