# Stats / Product Insights (Hackathon Backend)

> Nota rápida: este archivo es interno (no público). Resume cómo dejamos montadas las métricas reales que se exponen en `/api/v1/stats/overview`, pensando en extenderlas a producción después del concurso.

## 1. Infraestructura común

- **Modelo `Stats`** (`backend/src/modules/stats/models/stats.model.js`) replica la base del backend original:
  - Campos legacy: `messagesSent`, `messagesReceived`, `web3Connections`, `backupsCreated`, `storageUsed`, `lastActive`.
  - Eventos embebidos (`events[]`) con timestamp indexado.
  - Historial de conexiones (`connectionHistory[]`) opcional.
  - Campos nuevos ya pensados para producto: `tokensAdded`, `blinkMetadataHits`, `blinkExecutes`, `blinkVolume`, `naturalCommands*`, `dmStarted/dmAccepted`, `relayMessages`.
- **Logger** (`backend/src/modules/stats/services/eventLogger.service.js`):
  - `logEvent(userId, eventType, data, country)` → upsert + incrementos según `eventType`.
  - Envuelto en `try/catch` para no romper los controladores en caso de error.
- **Overview** (`backend/src/modules/stats/services/metrics.service.js`):
  - Calcula métricas existentes + bloque `productInsights` (antes “hackathon”).
  - Devuelve contadores totales y ventana rolling 24h.
  - Success rate de blinks y volumen (suma de `data.volume` cuando existe).

## 2. Instrumentación actual

| Dominio | Endpoint / handler | Evento (`logEvent`) | Datos extra |
|---------|-------------------|---------------------|-------------|
| Tokens  | `POST /api/v1/tokens/add` (`addTokenToConfig`) | `token_added`, `token_add_failed` | `code`, `mint` |
| Blinks  | `GET /api/v1/blinks/buy` metadata | `blink_metadata_hit` | `token`, `amount` |
|         | `POST /api/v1/blinks/buy` execute | `blink_execute`, `blink_execute_failed` | `token`, `amountInSol`, `expectedOut`, `volume` |
| Commands| `POST /api/v1/natural-commands/parse` | `natural_command_parsed`, `natural_command_executed`, `natural_command_rejected`, `natural_command_failed`, `natural_command_registered`, `natural_command_register_failed` | `action`, `resultType`, `error` |
| DM      | `POST /api/v1/dm/me/start` | `dm_started` | `to` |
|         | `POST /api/v1/dm/me/accept` | `dm_accepted` | `with` |
|         | `POST /api/v1/dm/me/reject/cancel/block` | `dm_rejected`, `dm_canceled`, `dm_blocked` | `with` |
| Relay   | `POST /relay/enqueue` | `relay_message` | `to`, `bytes` |
|         | `POST /relay/fetch` | `relay_fetch` | `count` |
|         | `POST /relay/ack` | `relay_ack` | `count`, `freedBytes` |

> Todos estos puntos usan helpers `safeLog` para evitar que una falla en métricas devuelva 500 al cliente.

## 3. Respuesta actual (`/api/v1/stats/overview`)

```json
{
  "messages": { ... },
  "connections": { ... },
  "productInsights": {
    "tokens": {
      "total": 0,
      "last24h": 0
    },
    "blinks": {
      "metadataHits": 0,
      "metadataHits24h": 0,
      "executes": 0,
      "executes24h": 0,
      "successRate24h": null,
      "volumeTotal": 0,
      "volume24h": 0
    },
    "naturalCommands": {
      "parsed": 0,
      "executed": 0,
      "rejected": 0,
      "failed": 0,
      "parsed24h": 0,
      "executed24h": 0,
      "rejected24h": 0,
      "failed24h": 0
    },
    "messaging": {
      "dmStarted": 0,
      "dmAccepted": 0,
      "relayMessages": 0,
      "dmStarted24h": 0,
      "dmAccepted24h": 0,
      "relayMessages24h": 0
    }
  }
}
```

> A futuro podemos renombrar `productInsights` por otro alias (ej. `engagement`) sin más que actualizar el key en `metrics.service.js` y en el dashboard.

## 4. Dashboard (admin-panel)

- `admin-panel/src/pages/AdminDashboard.jsx` ya consume `/stats/overview`. Pendiente:
  - Añadir nueva fila de `StatCard`s con los valores `productInsights`.
  - Crear panel “Product Insights” con tabla/resumen de tokens, blinks, comandos, DM/relay.
  - Posible reaprovechamiento en `TrafficControl.jsx` y `UserManagement.jsx` si queremos mostrar KPIs adicionales.
- No hay referencias públicas al término “hackathon” en UI ni en la API.

## 5. Estado del flujo DM

- El módulo DM funciona como “solicitud con intro” que desemboca en la misma colección de contactos.
- Flag `DM_LEGACY_EVENTS_ENABLED` permanece `false` (por defecto). Con esto:
  - Se evita duplicar eventos legacy websockets.
  - Podemos mantener el flujo interno sin mostrarlo aún en UI oficial.
- Médicas capturan `dm_*` pero, si la feature se mantiene oculta, los contadores permanecerán en 0 (no afecta al contacto tradicional).

## 6. Checklist futuro

1. **Backend original:** cuando se porten los controladores (churn, revenue, etc.) sólo hay que mover los archivos a `backend/src/modules/stats/controllers` y montarlos en `routes/v1/admin.js`. El modelo/logger ya coinciden.
2. **UI:** actualizar AdminDashboard con los nuevos cards + panel; opcional crear página de insights detallada.
3. **Scripts:** `npm run endpoints -- --module stats` para inspeccionar rutas, y un script de “seed métricas” si queremos demos reproducibles.
4. **Flags:** decidir cuándo exponer nuevamente el flujo DM “intro”; mientras tanto, flujo tradicional (módulo `contacts`) sigue vigente.
