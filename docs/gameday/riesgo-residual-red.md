# Riesgos residuales de red y datos

Fecha: 17 nov 2026.

- El egreso de la API queda abierto a TCP 80, 443 y 3307 públicos. No hay filtro por nombre de dominio.
- La integración continua usa la llave JSON `GCP_SA_KEY`.
- La denegación por defecto del namespace todavía no está aplicada. Las políticas de permiso de la API y de Redis sí.
- Una sobrescritura de comprobantes que no borre objetos no dispara `gd4-mass-object-destruction`.
- La retención del bucket dura 86400 segundos y no está bloqueada.
