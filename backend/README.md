# Deside Backend

API REST (Express) y tiempo real (Socket.IO) para mensajería segura. Arquitectura modular con separaciones por dominio y adaptadores para HTTP/WS; los workers están preparados para tareas en segundo plano.

- Cómo arrancar el proyecto y los modos (demo/dev): ver el [README de la raíz](../README.md).
- Diferencias y flags de ejecución: ver [docs/modes.md](../docs/modes.md).

## Estructura de código

```
src/
  apps/
    api/         # Adaptador HTTP (Express). Middlewares, versionado y montaje de rutas.
      v1/        # Versión actual de la API
    ws/          # Adaptador WebSocket (Socket.IO): handshake, presencia, eventos.
    worker/      # Punto de entrada para trabajos/tareas (planificado)
  modules/       # Módulos de dominio (routers/controladores/modelos)
    auth/
    users/
    contacts/
    dm/
    relay/
    signal/
    rtc/
  middleware/    # Seguridad, protección de rutas, rate limiting, etc.
  config/        # Configuración central y toggles
  jobs/          # Tareas programadas (cleanup, TTL, índices)
  shared/        # Servicios/utilidades comunes (claves, logging, helpers)
  utils/         # Utilidades generales
```

Además, en `scripts/` hay herramientas operativas (listar endpoints, sincronizar/verificar índices, actualizar TTLs).

## Patrones y convenciones

- Versionado de API bajo `apps/api/v1` para aislar cambios contractuales.
- Controladores delgados; validación/parsing en el borde (middlewares/rutas).
- Respuestas y errores consistentes; logging estructurado con rotación diaria.
- Alias de imports definidos en `package.json` para rutas cortas a `src/*`.
- Índices/expiraciones gestionables mediante scripts en `scripts/ops/*`.

## Flujos principales

- HTTP: solicitud → middlewares (seguridad, CORS, límites) → router versionado → controlador del módulo → respuesta.
- WebSocket: handshake reutiliza la sesión del navegador; presencia y heartbeats para disponibilidad; canales para señalización RTC y eventos de mensajería.
- Mensajería:
  - Relay: endpoints para enqueue/fetch/ack y métricas/configuración.
  - RTC: el cliente obtiene credenciales ICE y negocia data channels cuando es elegible; si no, se mantiene el relay.

## Persistencia y operaciones

- Almacenamiento en memoria para evaluación rápida, base local (Docker) o clúster externo, según configuración.
- Modelos por módulo (Mongoose) cuando aplica. Índices/TTL sincronizables con scripts.
- Logging con Winston y rotación por día; métricas/exportaciones CSV en puntos operativos cuando procede.

## Modos (referencia breve)

- Demo: pensado para evaluación sin secretos. Datos en memoria con seed y políticas conservadoras (por ejemplo, priorizar relay). Detalles en el [README de la raíz](../README.md) y en [docs/modes.md](../docs/modes.md).
- Dev: usa tu configuración local y mantiene los mismos contratos/rutas.

## Uso básico

- Desarrollo desde la raíz: `npm run dev:backend`.
- Comandos útiles (ver `backend/package.json`): `endpoints`/`docs` para listar rutas, `indexes:sync`/`indexes:verify` para índices, `ttl:update` para expiraciones.
- Variables de entorno y ejemplos: consulta los `.env.example` del repositorio (no se duplican aquí).

### Métricas y stats

- `GET /api/v1/stats/overview` ahora requiere JWT (`protectRoute`) y ofrece el resumen dinámico para el dashboard del hackathon.
- El subrouter `/api/v1/stats/admin` queda reservado para futuras exportaciones y métricas avanzadas; por ahora responde `501` hasta que definamos los nuevos KPIs específicos del concurso (ideas: adopción de blinks, tokens añadidos vía AI agent, uso de natural commands).
- Cuando decidas qué métricas exponer, añade los controladores correspondientes en `src/modules/stats/controllers` y móntalos dentro de `routes/v1/admin.js` o nuevas audiencias (`/me`, `/public`).

### Administración del bot de Telegram

- Las rutas de control (`/api/v1/telegram-bot/stats|start|stop|tokens`) utilizan un guard machine-to-machine. Envía el header `X-Telegram-Admin-Token` con el valor de `TELEGRAM_BOT_ADMIN_TOKEN` definido en tu `.env`.
- El webhook (`/api/v1/telegram-bot/webhook`) permanece sin autenticación porque aún no se usa en producción; si más adelante sirve para callbacks reales, aplica el mismo guard u otro esquema basado en firma/HMAC.
- Genera y rota la clave cuando sea necesario; puedes consultar el valor actual en `.env` y compartirlo de forma segura con el bot o scripts operativos.

## Extender con nuevos módulos

- Crea `src/modules/<tu-modulo>/{controllers,routes,models?,services?}`.
- Monta el router en `apps/api/v1`; si necesitas eventos en tiempo real, añade handlers en `apps/ws`.
- Define índices/modelos si procede y sincronízalos con los scripts de `scripts/ops/*`.
- Mantén validación en el borde, controladores delgados y logging consistente.

## Troubleshooting

- Sesión/handshake de WS: comprueba orígenes permitidos y que el cliente haya establecido sesión antes del handshake.
- Caídas a relay: revisa presencia/heartbeats y el endpoint ICE.
- Límites de payload: el relay aplica límites por seguridad.
- Para topología y consejos de desarrollo, ver [docs/dev-setup.md](../docs/dev-setup.md).

## Referencias

- Topología de desarrollo: [docs/dev-setup.md](../docs/dev-setup.md)
- Modos y flags: [docs/modes.md](../docs/modes.md)

## MongoDB: modelos y operativa

- Colecciones gestionadas por este backend (Mongoose):
  - `users` (User), `contacts` (Contact), `notifications` (Notification), `stats` (Stats), `activityevents` (ActivityEvent), `agreements` (Agreement), `relaymessages` (RelayMessage).
  - Índices clave: `users.wallet` único; `contacts.owner+contact` único; TTL en `relaymessages.createdAt`.

- Purga segura de colecciones no gestionadas:
  - Dry‑run: `cd backend && npm run db:purge:dryrun`
  - Aplicar: `PURGE_CONFIRM=I_UNDERSTAND npm run db:purge:apply`
  - Mantiene las colecciones de arriba; elimina las no usadas por este backend.

- Índices (prod: autoIndex desactivado por defecto):
  - Crear/actualizar: `npm run indexes:sync`
  - Verificar: `npm run indexes:verify`
  - Nota: se eliminó un índice redundante en `Stats` para evitar conflictos (`user:1` ya es único).

- TTL del relay:
  - Variables: `RELAY_MESSAGE_TTL` o `RELAY_TTL_SECONDS` (segundos).
  - Actualizar índice TTL: `npm run ttl:update`
  - Estado actual (con .env del repo): 90 días (7776000s). Para 30 días: exporta `RELAY_TTL_SECONDS=2592000` y ejecuta `ttl:update`.

- AutoIndex (opcional):
  - `MONGO_AUTO_INDEX=true|false` anula el comportamiento por entorno (por defecto: dev=on, prod=off).
  - Úsalo solo puntualmente en bases grandes; preferible `indexes:sync` en despliegues.

- Checks rápidos:
  - `indexes:verify` lista colecciones/índices y el TTL efectivo.
  - Conteo básico (mongosh): `db.users.countDocuments()`, `db.contacts.countDocuments()`.

Para una guía extendida (backups, migraciones y resolución de conflictos de índices), ver `docs/mongo-ops.private.md` (no versionado).
