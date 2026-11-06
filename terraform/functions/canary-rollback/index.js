const functions = require("@google-cloud/functions-framework");

const { PROJECT_ID, REGION, SERVICE } = process.env;
const SERVICE_URL = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/${SERVICE}`;
const TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

function log(severity, message, extra = {}) {
  console.log(JSON.stringify({ severity, message, event: "canary_rollback", ...extra }));
}

async function accessToken() {
  const res = await fetch(TOKEN_URL, { headers: { "Metadata-Flavor": "Google" } });
  return (await res.json()).access_token;
}

// Cloud Monitoring publica el incidente en Pub/Sub; solo actuamos al abrirse.
functions.cloudEvent("rollback", async (event) => {
  const payload = JSON.parse(Buffer.from(event.data.message.data, "base64").toString());
  const incident = payload.incident ?? {};
  if (incident.state !== "open") {
    log("INFO", "incident not open, nothing to do", { state: incident.state });
    return;
  }

  const headers = {
    authorization: `Bearer ${await accessToken()}`,
    "content-type": "application/json"
  };
  const service = await (await fetch(SERVICE_URL, { headers })).json();
  const stable = service.traffic?.find((target) => target.tag === "stable");
  const canary = service.traffic?.find((target) => target.tag === "canary");

  if (!stable || !canary) {
    log("INFO", "no canary tagged, nothing to roll back");
    return;
  }

  if ((canary.percent ?? 0) === 0) {
    log("INFO", "canary already at 0%", { canary: canary.revision });
    return;
  }

  service.traffic = [
    { ...stable, percent: 100 },
    { ...canary, percent: 0 }
  ];
  const res = await fetch(`${SERVICE_URL}?updateMask=traffic`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(service)
  });
  if (!res.ok) {
    throw new Error(`Cloud Run PATCH ${res.status}: ${await res.text()}`);
  }

  log("WARNING", "canary rolled back: stable 100%, canary 0%", {
    policy: incident.policy_name,
    condition: incident.condition_name,
    stable: stable.revision,
    canary: canary.revision,
    previous_canary_percent: canary.percent
  });
});
