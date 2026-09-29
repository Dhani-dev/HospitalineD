/**
 * Hueco para el orquestador de Pokenetes (AWS).
 *
 * Hospitaline no llama al orquestador: el orquestador llama a esta API.
 * Cuando el compañero entregue la URL, basta con rellenar ORCHESTRATOR_API_URL
 * y respetar los headers de entrada. El span `flujo.hospitaline` lo abre él.
 */
export function getOrchestratorPlaceholder() {
  return {
    apiUrl: process.env.ORCHESTRATOR_API_URL ?? "",
    inboundHeaders: ["traceparent", "x-trace-id"] as const,
    expectedSpanName: "flujo.hospitaline",
    lastPath: "/api/v2/hospitals/last",
    listPath: "/api/v1/hospitals"
  };
}

export function isOrchestratorConfigured(): boolean {
  return Boolean(getOrchestratorPlaceholder().apiUrl.trim());
}
