# STYLE ↔ SUITE — Historial

Cronología y lecciones aprendidas. Documento detallado: [STYLE-SUITE-HISTORIAL-Y-EXPORTZ.md](STYLE-SUITE-HISTORIAL-Y-EXPORTZ.md).

---

## Línea temporal

| Fecha / fase | Evento |
|--------------|--------|
| Legacy | Style ↔ Suite vía HTTP (`stylegetreservas` / `stylereservas`) |
| 2026-06 | Esquema Postgres: `style_reservas_queue`, RPCs LWW |
| 2026-06 | Intento rebuild `C:\Duna\Export` → **error 1732**, exe ~35 MB |
| 2026-06 | **ExportZ**: decompile de `Z:\Style-Dunasoft\Duna.exe` (~30 MB OK) |
| 2026-06 | Decisión arquitectura **v2**: cola + agente Docker (sin HTTP en exe) |
| 2026-06 | Implementación: `suite_cola_sync`, `style-sync-agent`, `suite_inbound_worker` |

---

## Lecciones críticas

| Trampa | Consecuencia | Solución |
|--------|--------------|----------|
| `suite_full_unlock.fxp` en build | Error 1732 | Solo `.prg` o no embeber en v2 |
| Mezclar Export y ExportZ | Proyecto roto | Solo `mscomctlOk.pjx` en ExportZ |
| Node escribe `plan2009.dbf` | Corrupción / locks | JSON + worker VFP |
| Sin heartbeat worker | Inbound caído sin aviso | Task Scheduler 30–60 s |
| Miles de JSON en `inbound/` | ADIR lento en VFP | Archivo + dead-letter |
| v1 + v2 paralelos | Duplicados y conflictos | Un solo canal |

---

## Entornos

| Ruta | Uso |
|------|-----|
| `Z:\Style-Dunasoft` | Producción referencia (no tocar para pruebas destructivas) |
| `C:\Duna\ExportZ` | Build parcheado |
| `C:\Duna\Export` | **Descartado** |
| `C:\Duna\Style-Suite-Test` | E2E local |

---

## Referencia v1 (archivo)

Parches HTTP detallados: [STYLE-SUITE-PARCHES-EXPORT.md](STYLE-SUITE-PARCHES-EXPORT.md).

Edge Function legacy: `supabase/functions/style-reservas-sync/`.

Mantener desactivada en producción cuando v2 esté activo.
