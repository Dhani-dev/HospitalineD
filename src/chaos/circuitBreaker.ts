export class CircuitBreaker {
  private readonly failures = new Map<string, number>();
  private readonly openUntil = new Map<string, number>();

  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now
  ) {}

  isOpen(name: string): boolean {
    const until = this.openUntil.get(name) ?? 0;
    if (until === 0) {
      return false;
    }
    if (this.now() >= until) {
      this.openUntil.delete(name);
      this.failures.set(name, 0);
      return false;
    }
    return true;
  }

  recordFailure(name: string): void {
    const failures = (this.failures.get(name) ?? 0) + 1;
    this.failures.set(name, failures);
    if (failures >= this.threshold) {
      this.openUntil.set(name, this.now() + this.cooldownMs);
    }
  }

  reset(): void {
    this.failures.clear();
    this.openUntil.clear();
  }
}

export const peerBreaker = new CircuitBreaker();
