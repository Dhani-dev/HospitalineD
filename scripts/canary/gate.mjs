export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}

export function trackOf(header) {
  return /track=(stable|canary)/.exec(header ?? "")?.[1] ?? "unknown";
}

export function summarize(samples) {
  const byTrack = {};
  for (const sample of samples) {
    (byTrack[sample.track] ??= []).push(sample);
  }

  return Object.fromEntries(
    Object.entries(byTrack).map(([track, rows]) => {
      const latencies = rows.map((row) => row.ms).sort((a, b) => a - b);
      const errors5xx = rows.filter((row) => row.status >= 500 || row.status === 0).length;
      const errors4xx = rows.filter((row) => row.status >= 400 && row.status < 500).length;
      return [
        track,
        {
          count: rows.length,
          errorRate: errors5xx / rows.length,
          clientErrorRate: errors4xx / rows.length,
          p50: percentile(latencies, 50),
          p95: percentile(latencies, 95),
          p99: percentile(latencies, 99)
        }
      ];
    })
  );
}

export function evaluate(summary, slo) {
  const canary = summary.canary;
  const stable = summary.stable;

  if (!canary || canary.count < slo.minRequestsPerTrack) {
    return { decision: "pause", reason: `muestra canary ${canary?.count ?? 0} < ${slo.minRequestsPerTrack}` };
  }

  if (canary.errorRate > slo.abort.maxErrorRate) {
    return { decision: "abort", reason: `5xx canary ${pct(canary.errorRate)} > ${pct(slo.abort.maxErrorRate)}` };
  }

  if (canary.p95 > slo.abort.maxP95Ms) {
    return { decision: "abort", reason: `p95 canary ${canary.p95} ms > ${slo.abort.maxP95Ms} ms` };
  }

  if (canary.errorRate > slo.promote.maxErrorRate) {
    return { decision: "pause", reason: `5xx canary ${pct(canary.errorRate)} entre promover y abortar` };
  }

  if (canary.p95 > slo.promote.maxP95Ms) {
    return { decision: "pause", reason: `p95 canary ${canary.p95} ms > ${slo.promote.maxP95Ms} ms` };
  }

  if (stable && stable.count >= slo.minRequestsPerTrack) {
    const baseline = Math.max(stable.p95, slo.baselineFloorMs);
    const limit = baseline * slo.promote.maxP95RatioToBaseline;
    if (canary.p95 > limit) {
      return {
        decision: "pause",
        reason: `p95 canary ${canary.p95} ms > ${limit} ms (${slo.promote.maxP95RatioToBaseline}x baseline)`
      };
    }
  }

  return { decision: "promote", reason: "canary dentro del SLO" };
}

function pct(rate) {
  return `${(rate * 100).toFixed(2)}%`;
}
