#!/usr/bin/env node
// Hornea una etapa: genera carga contra la URL pública, separa los resultados
// por el track de X-App-Version y aplica canary/slo.json.
// Códigos de salida: 0 promover, 2 pausar, 1 abortar.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { evaluate, summarize, trackOf } from "./gate.mjs";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    seconds: { type: "string", default: "120" },
    rps: { type: "string", default: "8" },
    fault: { type: "string", default: "none" },
    slo: { type: "string", default: new URL("../../canary/slo.json", import.meta.url).pathname },
    out: { type: "string", default: "bake-summary.json" }
  }
});

if (!values.url) {
  console.error("Uso: bake.mjs --url https://... [--seconds 120] [--rps 8] [--fault none|errors|latency]");
  process.exit(64);
}

const baseUrl = values.url.replace(/\/$/, "");
const slo = JSON.parse(readFileSync(values.slo, "utf8"));
const seconds = Number(values.seconds);
const rps = Number(values.rps);
const faultHeaders = values.fault === "none" ? {} : { "x-fault-mode": values.fault };

async function hit(index) {
  const isWrite = index % 10 === 0;
  const started = performance.now();
  try {
    const res = await fetch(`${baseUrl}/api/hospitals${isWrite ? "" : "/last"}`, {
      method: isWrite ? "POST" : "GET",
      headers: { "content-type": "application/json", ...faultHeaders },
      body: isWrite
        ? JSON.stringify({
            name: `Canary load ${index}`,
            address: "Calle 10",
            city: "Medellin",
            phone: "6041234567",
            bed_capacity: 50 + (index % 600)
          })
        : undefined,
      signal: AbortSignal.timeout(10_000)
    });
    await res.arrayBuffer();
    return { track: trackOf(res.headers.get("x-app-version")), status: res.status, ms: performance.now() - started };
  } catch {
    return { track: "unknown", status: 0, ms: performance.now() - started };
  }
}

const pending = [];
const total = Math.round(seconds * rps);
for (let i = 0; i < total; i += 1) {
  pending.push(hit(i));
  await new Promise((resolve) => setTimeout(resolve, 1000 / rps));
}
const samples = await Promise.all(pending);

const summary = summarize(samples);
const verdict = evaluate(summary, slo);
writeFileSync(values.out, JSON.stringify({ summary, verdict }, null, 2));

const rows = Object.entries(summary).map(
  ([track, s]) =>
    `| ${track} | ${s.count} | ${(s.errorRate * 100).toFixed(2)}% | ${(s.clientErrorRate * 100).toFixed(2)}% | ` +
    `${s.p50.toFixed(0)} | ${s.p95.toFixed(0)} | ${s.p99.toFixed(0)} |`
);
const report = [
  `### Bake ${seconds}s @ ${rps} rps (fault: ${values.fault}) -> **${verdict.decision}**`,
  `${verdict.reason}`,
  "",
  "| track | peticiones | 5xx | 4xx | p50 ms | p95 ms | p99 ms |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...rows,
  ""
].join("\n");

console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
}

process.exit({ promote: 0, pause: 2, abort: 1 }[verdict.decision]);
