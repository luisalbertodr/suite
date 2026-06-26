# STYLE ↔ SUITE — Arquitectura v2 (cola + agente Docker)

## Reglas de oro

1. **VFP nunca habla con Supabase.**
2. **Node nunca escribe DBF.**
3. **Todo cambio pasa por una cola.**
4. **Las operaciones son idempotentes.**
5. **Se acepta entrega al menos una vez (at-least-once).**
6. **El sistema debe recuperarse automáticamente.**
7. **El heartbeat debe estar siempre vivo.**
8. **Nunca ejecutar v1 (HTTP) y v2 simultáneamente** — kill switch en `control_sincro.dbf` (`modo_activo`: `1`=v1, `2`=v2). Agente y worker comprueban antes de cada ciclo.

---

## Garantías del sistema

### Style → Suite

| Garantía | Mecanismo |
|----------|-----------|
| At-least-once | Cola persiste hasta que el agente confirma RPC |
| Idempotente | RPC `style_reservas_apply_from_style` por `idplan` |
| Nunca se pierde una cita | `last_cola_id` **no avanza** si el RPC falla |
| Sin reprocesados infinitos | `last_cola_id` solo avanza tras éxito |

### Suite → Style

| Garantía | Mecanismo |
|----------|-----------|
| At-least-once | `style_reservas_queue` hasta `style_reservas_ack` |
| JSON + ACK | Separación escritura (Node) / aplicación (VFP) |
| Last-write-wins | LWW en Postgres + worker VFP (`sync_version` en `plan2009`) |
| ACK siempre | Worker genera `.ok` aunque Style pierda el conflicto (evita reintentos infinitos) |

---

## Ownership

| Elemento | Dueño | Escritura |
|----------|-------|-----------|
| `plan2009.dbf` | VFP | Solo worker / Style POS |
| `planart.dbf` | VFP | Solo worker / Style POS |
| `cola_sincro.dbf` | VFP | `SuiteEnqueuePlan2009` |
| `control_sincro.dbf` | VFP | Kill switch `modo_activo` |
| `sync/inbound/` | Node | JSON desde queue Postgres |
| `sync/inbound_ack/` | VFP | Worker tras aplicar DBF |
| `sync/deadletter/` | Node | Tras N fallos → revisión manual |
| `sync/archive/` | Node | Tras ack OK |
| `style_reservas_queue` | Supabase | Dual-write Suite |
| `agenda_appointments` | Supabase | Suite |
| `last_cola_id` | Node | `style_sync_agent_state` |

**Node nunca modifica DBF.**

---

## Máquina de estados

### Outbound (Style → Suite)

```mermaid
stateDiagram-v2
  [*] --> NEW: Usuario guarda cita
  NEW --> Cola: SuiteEnqueuePlan2009
  Cola --> Agent: poll cola_sincro
  Agent --> RPC: style_reservas_apply_from_style
  RPC --> Done: OK
  RPC --> Cola: fallo (reintento)
  RPC --> DeadLetter: N fallos
  Done --> [*]: last_cola_id++
```

```
NEW → cola_sincro.dbf → Agent → RPC apply → last_cola_id → DONE
                              ↘ (N fallos) → sync/deadletter/outbound/
```

### Inbound (Suite → Style)

```mermaid
stateDiagram-v2
  [*] --> Queue: Suite crea cita
  Queue --> JSON: Agent poll
  JSON --> Worker: suite_inbound_worker
  Worker --> ACK: plan2009 OK
  ACK --> Archive: Agent + RPC ack
  Archive --> Done: delivered_at
  Worker --> DeadLetter: JSON corrupto / N ack fallos
```

```
Queue → JSON → Worker VFP → ACK → Archive → DONE
```

---

## Diagrama de componentes

```mermaid
flowchart TB
  subgraph styleVM [VM Style 192.168.99.16]
    exe[Duna.exe ExportZ]
    cola[(cola_sincro.dbf)]
    plan[(plan2009 / planart)]
    inboundDir[sync/inbound]
    ackDir[sync/inbound_ack]
    dl[sync/deadletter]
    hb[heartbeat.txt]
    worker[suite_inbound_worker.prg]
    exe --> cola
    worker --> plan
    inboundDir --> worker
    worker --> ackDir
    worker --> hb
  end
  subgraph portainer [Docker / Portainer]
    agent[style-sync-agent]
  end
  subgraph supabase [Supabase]
    queue[style_reservas_queue]
    state[style_sync_agent_state]
    rpcApply[style_reservas_apply_from_style]
    rpcAck[style_reservas_ack]
  end
  cola -->|read CIFS| agent
  agent --> rpcApply
  agent --> queue
  agent --> inboundDir
  ackDir --> agent
  agent --> rpcAck
  agent --> state
  agent --> dl
  agent --> hb
```

---

## v1 vs v2

| | v1 (legacy) | v2 (actual) |
|---|-------------|-------------|
| Outbound | HTTP MSXML en exe | `cola_sincro.dbf` |
| Inbound | HTTP pull XML | JSON + worker VFP |
| Agente | Timer embebido / Python | Node Docker |
| Riesgo 1732 | Alto (unlock embebido) | Bajo (exe thin) |

**No ejecutar v1 y v2 en paralelo.** Usar `control_sincro.modo_activo = '2'` solo cuando v2 está desplegado; volver a `'1'` en rollback.

### Contrato `cola_sincro.servicios` (Memo)

JSON array (mismo formato en cola, agente Node y worker VFP):

```json
[{"servicio":"corte","hora":"10:00"},{"servicio":"tinte","hora":"11:00"}]
```

El agente convierte a texto legacy para el RPC Postgres (`codart+hora` por línea). El worker inbound parsea JSON con `SuiteJsonParse` o cae al formato legacy si no empieza por `[`.

### LWW inbound (worker VFP)

1. Resolver `version` del JSON (campo `version` o `modificado`).
2. Comparar con `plan2009.sync_version` local.
3. Si entrante ≤ local → ignorar escritura, **pero generar ACK** (`applied=0`).
4. Si entrante > local o INS nuevo → aplicar y `REPLACE sync_version`.

---

## Canal ampliado (maestros + transacciones)

A partir del plan de integración Style ↔ Suite, el canal v2 se extiende más allá de las citas
(`plan2009`) para cubrir clientes, artículos, bonos, ventas, facturas y cierres de caja. La
infraestructura es **transversal** y reutiliza la misma cola, agente y worker.

### Componentes transversales

| Componente | Rol |
|-----------|-----|
| `dunasoft.style_sync_entity_map` | Mapeo idempotente `style_key` ↔ `suite_id` por entidad + `sync_version` (LWW) |
| `dunasoft.style_sync_cursor` | High-water mark por tabla de `cola_sincro` (`enabled=false` ⇒ tabla ignorada) |
| `dunasoft.style_sync_outbox` | Cola Suite→Style genérica para payloads grandes (bonos, facturas) |
| `style-sync-agent/src/entitySync.ts` | Motor genérico (router por `tabla`, lee DBF origen, llama RPC) |
| `style-sync-agent/src/handlers.ts` | Registro declarativo de entidades → RPC |

### Flujo Style → Suite (maestros)

1. VFP encola en `cola_sincro` solo `(tabla, id_reg, accion)` vía `SuiteEnqueueCola`.
2. El agente lee el **registro completo** del DBF origen (`clientes.dbf`, `articulos.dbf`, …),
   evitando el límite de 254 chars de la cola.
3. Llama al RPC `dunasoft.style_<entidad>_apply_from_style`, que upserta en `public.*` y
   actualiza `style_sync_entity_map`.
4. Avanza `style_sync_cursor.last_id` (por tabla) solo tras éxito.

### Flujo Suite → Style

1. Trigger en `public.*` → `dunasoft.enqueue_style_entity` → fila en `style_sync_outbox`.
2. El agente escribe `sync/inbound/e<id>.json` con `entity_type`.
3. El worker VFP enruta por `entity_type` y aplica al DBF correspondiente, genera `e<id>.ok`.
4. El agente confirma con `dunasoft.style_entity_ack` (fija `style_key` si Style asignó código).

### Reglas de conflicto (doble operación)

| Entidad | Style → Suite | Suite → Style | Notas |
|---------|---------------|---------------|-------|
| Clientes | Upsert por `codcli`/`legacy_codcli` | Alta/edición en `clientes.dbf` | LWW por `sync_version` |
| Artículos | Style gana precio/stock | Solo altas Suite con `legacy_codart` | No sobrescribir catálogo POS |
| Bonos | Style gana saldo/consumo | Notifica consumo manual | Mapeo `legacy_codboncli` |
| Ventas TPV | `albcab`→`sales` si no hay mapeo | `TPV-*`→`albcab` | Nunca doble facturación |
| Facturas | `faccab`→`invoices` por `(serie,numfac,codcli)` | Solo tickets Suite sin par | Idempotencia estricta |
| Cierres | `ciecab`→sesión por `numcie` | Opcional | Validar totales vs ventas del día |

### Activación incremental

Una entidad solo se sincroniza cuando existe su fila en `style_sync_cursor` con `enabled=true`.
Esto permite probar fase a fase sin tocar el canal de citas. Estado y lag por entidad se exponen
en `public.style_sync_agent_status` (`entity_cursors`). La auditoría previa de baseline está en
`public.style_sync_baseline_audit`.

---

## Documentos relacionados

- [STYLE-SUITE-DEPLOY.md](STYLE-SUITE-DEPLOY.md)
- [STYLE-SUITE-OPERATIONS.md](STYLE-SUITE-OPERATIONS.md)
- [STYLE-SUITE-TROUBLESHOOTING.md](STYLE-SUITE-TROUBLESHOOTING.md)
- [STYLE-SUITE-HISTORY.md](STYLE-SUITE-HISTORY.md)
- [STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md](STYLE-SUITE-SYNC-V2-IMPLEMENTACION.md)
