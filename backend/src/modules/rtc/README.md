# RTC (WebRTC) — Guía de Integración

Este módulo expone un endpoint privado para emitir credenciales ICE (STUN/TURN) y habilitar conexiones WebRTC entre clientes. Soporta dos proveedores:

- Twilio Network Traversal (recomendado en producción)
- coturn autogestionado (opcional)

La entrega de mensajes se completa con fallback a Relay cuando RTC falla, cumpliendo “RTC si ambos online; si falla, Relay SIEMPRE”.

## Endpoints

- `GET /api/v1/rtc/ice`
  - Devuelve: `{ iceServers, ttl, provider, serverTime, expiresAt }`
  - Auth: requerida (JWT por cookie + CSRF o Bearer si está habilitado)
  - Feature flag: `rtc.ice` debe estar activado; si no, `403 feature_disabled`
  - Rate limit: 10 req/min por usuario (o IP fallback)
  - Cache: por defecto `Cache-Control: private, no-store`. Si se define `ICE_CACHE_MAX_AGE>0`, entonces `private, max-age=<n>`

Rutas equivalentes por compat: también está montado en `/api/rtc/*` y `/api/rtc/v1/*`. El uso recomendado en clientes es `/api/v1/rtc/ice`.

## Proveedores soportados

### 1) Twilio Network Traversal (US por defecto)

- Ventajas: listo para producción sin operar coturn ni TLS, alto éxito en NATs estrictos.
- Activación: establece `RTC_PROVIDER=twilio` y credenciales en el `.env` del backend.
- Variables requeridas:
  - `TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - `TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - `TWILIO_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - `TURN_CRED_TTL=600` (segundos, recomendado 600)
  - Región opcional UE (no usar si operas en US): `TWILIO_REGION=ie1`
- Funcionamiento: el backend pide `Tokens.json` a Twilio y devuelve `iceServers` efímeros al cliente. Nunca se expone nada de Twilio al front.
- Red: el backend debe poder salir a `https://api.twilio.com` (o `https://ie1.api.twilio.com` si usas IE1).

### 2) coturn autogestionado (opcional)

- Requiere montar una VM con IP pública y configurar `/etc/turnserver.conf` con `static-auth-secret` (HMAC) y `realm`.
- Variables requeridas en backend:
  - `TURN_SECRET=<static-auth-secret>` (mismo valor que en coturn)
  - `TURN_URIS=turn:host:3478?transport=udp,turn:host:3478?transport=tcp,turns:host:5349?transport=tcp` (CSV)
  - `TURN_CRED_TTL=600` (segundos, recomendado 600)
- Variables opcionales:
  - `TURN_STUN_FALLBACK=stun:stun.l.google.com:19302`
- Funcionamiento: el backend genera credenciales efímeras con HMAC-SHA1 (`username = <exp_unix>:<wallet|anon>`, `password = base64(hmac(secret, username))`) y devuelve `iceServers` con tus `TURN_URIS` y las credenciales generadas.
- Notas de red (coturn):
  - Abrir puertos: `3478/udp`, `3478/tcp`, `5349/tcp` y rango `49152–49999/udp`.
  - NAT: configurar `external-ip=IP_PUBLICA/IP_PRIVADA` (o `listening-ip` + `external-ip`).
  - TLS: necesario para `turns:` (Let’s Encrypt recomendado). 
  - NTP: reloj sincronizado (las credenciales dependen del tiempo).

## Variables de entorno (resumen)

- Proveedor:
  - `RTC_PROVIDER=twilio` | `coturn` (default `twilio` si no se define)
- Twilio:
  - `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_REGION?`, `TURN_CRED_TTL`
- coturn:
  - `TURN_SECRET`, `TURN_URIS`, `TURN_STUN_FALLBACK?`, `TURN_CRED_TTL`
- Auth (si usas Bearer desde apps nativas/SDKs):
  - `ALLOW_BEARER_AUTH=true`
  - `BEARER_ROUTE_WHITELIST=^/api/(?:v1/)?(?:relay|signal|rtc)(?:/.*)?$`

## Feature Flags

- Flag requerido para habilitar el endpoint:
  - Documento en Mongo: `{ key: 'rtc.ice', enabled: true }`
  - Si no está activo → `403 feature_disabled`

## Señalización RTC (Socket.IO)

- Eventos soportados (único método): `rtc:offer`, `rtc:answer`, `rtc:candidate`.
- Convenciones clave:
  - `convId = [walletA, walletB].sort().join(':')` (canónico)
  - `signalId` recomendado (único por señal) para deduplicación/telemetría
- Payloads de ejemplo:
  - `rtc:offer` (emisor → servidor → receptor)
    - `{ convId, to, sdp: { type: 'offer', sdp }, signalId }`
  - `rtc:answer` (receptor → servidor → emisor)
    - `{ convId, to, sdp: { type: 'answer', sdp }, signalId }`
  - `rtc:candidate`
    - `{ convId, to, candidate: { candidate, sdpMid: '0' | null, sdpMLineIndex: 0 | null }, signalId }`
- Errores comunes:
  - `invalid_payload` si faltan campos o formas no válidas
  - `sender_not_rtc_eligible` | `target_not_rtc_eligible` según elegibilidad
  - `forbidden` si no son contactos mutuos

## Eventos Legacy (deprecados)

- Señalización `signal` (antiguo): no recomendado. El servidor emite advertencias; puede desactivarse con `RTC_SIGNAL_LEGACY_ENABLED=false`.
- Presencia legacy: `presence`, `user_connected`, `user_disconnected` siguen emitiéndose por compatibilidad con aviso de deprecación. El evento actual es `presence:update`.

## Consumo desde el frontend

- Flujo recomendado:
  - Tras login, pedir `GET /api/v1/rtc/ice` (cookies+CSRF en web; Bearer en apps nativas si procede).
  - Construir `RTCPeerConnection({ iceServers })` con lo recibido.
  - Establecer ventana corta de confirmación (ACK) para RTC; si no hay confirmación, usar Relay con `force: true` en el último intento.
  - Refrescar ICE si la sesión es larga: re-solicitar a ~70% de `ttl` y renegociar si hace falta.
- UI y telemetría:
  - Distinguir transporte localmente: RTC si hay ACK; Relay si se usó `/relay/enqueue`.
  - `forced: true` (en respuesta de enqueue) es para analytics/tooltip, no etiqueta visible principal.

## Seguridad

- Nunca exponer claves de Twilio al frontend.
- Evitar loguear listas `iceServers` con credenciales.
- CORS: mantener `ALLOWED_ORIGINS` restrictivo.
- Rate limiting ya aplicado (10/min) para evitar abuso.

## Pruebas rápidas

- API: autenticado, `GET /api/v1/rtc/ice` → debe devolver `{ iceServers, ttl, provider }`.
  - `401/403`: revisar auth/CSRF o flag `rtc.ice`.
  - `503 ice_unavailable`: revisar env (Twilio: SID/API Key/Secret/host; coturn: TURN_HOST/REALM/SECRET).
- Cliente: `chrome://webrtc-internals` o la demo de trickle-ice (pegar `iceServers`). Forzando red estricta deben aparecer candidatos `typ=relay`.

## Solución de problemas

- Twilio 503/401: credenciales o región incorrectas; en US omitir `TWILIO_REGION`.
- Coturn sin candidatos `relay`: falta `external-ip` (NAT), firewall bloqueando rango UDP, o reloj del servidor desincronizado.
- Muchos “relay” (coste alto): revisar conectividad directa y el orden STUN→TURN; limitar sesiones largas sin necesidad.

## Costes y monitoreo (Twilio)

- Monitorear nº de llamadas a `/rtc/ice` y porcentaje de candidatos `relay` vs `srflx/host`.
- Alertas si la tasa de `relay` se dispara (impacto de costes) o si el endpoint devuelve `503` sostenido.

## Notas

- El endpoint devuelve también `provider: 'twilio' | 'coturn'` para trazabilidad.
- Mantener `TURN_STUN_FALLBACK` como primer servidor reduce uso de TURN cuando no es necesario.
- El fallback Relay del backend asegura entrega aun cuando RTC falle.
