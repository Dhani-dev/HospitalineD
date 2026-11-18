# Trazabilidad — filas de Daniela

ATT&CK Enterprise vigente al consultar: **v20.1** (13 oct 2026 – actual). Fecha de consulta: **2026-11-17**. D3FEND: fichas oficiales abiertas el mismo día; no se afirma una versión de ontología. ISO 27001:2022 Anexo A, NIST SP 800-53 r5 y NIST SP 800-207 son el mapeo del plan. La búsqueda inversa de D3FEND para T1610 y T1046 no devuelve estas contramedidas; se citan porque su ficha existe.

## ATT&CK verificados en la v20.1

| ID | Nombre en la ficha | URL |
|---|---|---|
| T1610 | Deploy Container | https://attack.mitre.org/techniques/T1610/ |
| T1046 | Network Service Discovery | https://attack.mitre.org/techniques/T1046/ |
| T1071.001 | Application Layer Protocol: Web Protocols | https://attack.mitre.org/techniques/T1071/001/ |
| T1485 | Data Destruction | https://attack.mitre.org/techniques/T1485/ |

T1485.001 Lifecycle-Triggered Deletion existe y **no** se emuló.

## D3FEND verificados

| ID | Nombre en la ficha | URL |
|---|---|---|
| D3-NI | Network Isolation | https://d3fend.mitre.org/technique/d3f:NetworkIsolation/ |
| D3-ITF | Inbound Traffic Filtering | https://d3fend.mitre.org/technique/d3f:InboundTrafficFiltering/ |
| D3-OTF | Outbound Traffic Filtering | https://d3fend.mitre.org/technique/d3f:OutboundTrafficFiltering/ |
| D3-NTA | Network Traffic Analysis | https://d3fend.mitre.org/technique/d3f:NetworkTrafficAnalysis/ |
| D3-RF | Restore File | https://d3fend.mitre.org/technique/d3f:RestoreFile/ |
| D3-FIM | File Integrity Monitoring | https://d3fend.mitre.org/technique/d3f:FileIntegrityMonitoring/ |

## Control, experimento y marco

| Exp | Control | ATT&CK | D3FEND | ISO 27001:2022 A | NIST 800-53 r5 | NIST 800-207 | R0 | R1 |
|---|---|---|---|---|---|---|---|---|
| 2 | NetworkPolicy y denegación por defecto en `hospitaline-prod` | T1610, T1046, T1071.001 | D3-NI, D3-ITF, D3-OTF, D3-NTA | A.8.20, A.8.21, A.8.22, A.8.23 | AC-4, SC-7, SC-7(5), CM-7 | Microsegmentación | Refutada. Redis y salida abiertos. Sin alerta. Cobertura 0/3. t0 `2026-11-17T19:13:41Z` | Confirmada. `gd2-netpol-deny` a los 22 s. Cobertura 3/3. t0 `2026-11-18T01:17:08Z` |
| 4 | Retención del bucket de comprobantes, auditoría DATA_WRITE y copia aislada | T1485 | D3-RF, D3-FIM | A.8.13, A.5.29, A.5.30, A.8.10 | CP-9, CP-10, SI-7, SC-28 | Protección del recurso; mínimo privilegio | Refutada. 23 sobrescrituras y 25 borrados abiertos. Sin alerta. RTO 2075 s, por encima de 30 min. RPO 1233 s. t0 `2026-11-17T21:14:04Z` | Confirmada. 25 sobrescrituras y 25 borrados denegados. Alerta a los 444 s. RPO y RTO del principal 0. Copia: RTO parcial 1279 s, RTO 1369 s, RPO 1512 s. t0 `2026-11-18T02:22:22Z` |
