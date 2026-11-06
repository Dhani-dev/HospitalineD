import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script shared with the pipeline
import { evaluate, summarize, trackOf } from "../../scripts/canary/gate.mjs";

const slo = JSON.parse(readFileSync("canary/slo.json", "utf8"));

function samples(track: string, count: number, ms: number, failures = 0) {
  return Array.from({ length: count }, (_, i) => ({
    track,
    ms,
    status: i < failures ? 500 : 200
  }));
}

describe("canary quality gate", () => {
  it("reads the track from X-App-Version", () => {
    expect(trackOf("4.0.0; track=canary")).toBe("canary");
    expect(trackOf("3.1.0; track=stable")).toBe("stable");
    expect(trackOf(null)).toBe("unknown");
  });

  it("uses a 2 minute bake on the progressive stages", () => {
    expect(slo.stages.map((s: { canaryPercent: number }) => s.canaryPercent)).toEqual([0, 10, 50, 100]);
    expect(slo.stages[1].bakeSeconds).toBe(120);
    expect(slo.stages[2].bakeSeconds).toBe(120);
  });

  it("promotes a healthy canary", () => {
    const summary = summarize([...samples("stable", 400, 40), ...samples("canary", 60, 45)]);
    expect(evaluate(summary, slo).decision).toBe("promote");
  });

  it("pauses while the canary sample is too small", () => {
    const summary = summarize([...samples("stable", 400, 40), ...samples("canary", 20, 45)]);
    expect(evaluate(summary, slo).decision).toBe("pause");
  });

  it("aborts when injected errors break the 2% threshold", () => {
    const summary = summarize([...samples("stable", 400, 40), ...samples("canary", 60, 45, 60)]);
    const verdict = evaluate(summary, slo);
    expect(verdict.decision).toBe("abort");
    expect(verdict.reason).toContain("5xx");
  });

  it("aborts when injected latency breaks p95 2 s", () => {
    const summary = summarize([...samples("stable", 400, 40), ...samples("canary", 60, 2100)]);
    expect(evaluate(summary, slo).decision).toBe("abort");
  });

  it("pauses when canary p95 is over 1.5x the baseline", () => {
    const summary = summarize([...samples("stable", 400, 300), ...samples("canary", 60, 600)]);
    expect(evaluate(summary, slo).decision).toBe("pause");
  });

  it("counts network failures as 5xx", () => {
    const summary = summarize([{ track: "canary", ms: 10, status: 0 }]);
    expect(summary.canary.errorRate).toBe(1);
  });
});
