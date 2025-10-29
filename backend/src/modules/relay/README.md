# Relay Module Overview

Este módulo implementa la bandeja Relay que actúa como fallback de mensajería
cuando el canal P2P/RTC no está disponible. La arquitectura está siendo
refactorizada para que el almacenamiento sea intercambiable (Mongo hoy,
backends gestionados mañana) y para soportar flujos como acuerdos y acciones
Solana sin tocar el contenido cifrado.

## Piezas actuales

- `controllers/relay.controller.js`: endpoints `/enqueue`, `/fetch`, `/ack`,
  `/usage`, `/policy`, `/purge`. Próximamente delegarán en `QuotaService` +
  `RelayStore`.
- `services/actionMessaging.service.js`: productores internos (ej. acuerdos)
  que también se moverán al helper de cuotas.
- `models/relayMessage.model.js`: esquema Mongoose actual (se mantendrá hasta
  migrar de backend).
- `services/relayStore.interface.js`: contrato que define las operaciones que
  cualquier store debe implementar.
- `services/quota.service.js`: resuelve cuotas y coordina la reserva de bytes.
- `services/relayStoreProvider.js`: expone `getRelayStore()/setRelayStore()` para
  inyectar la implementación activa (Mongo hoy, otras en el futuro).
- `services/mongoRelayStore.js`: implementación actual sobre Mongo con soporte
  para transacciones y agregaciones usadas por métricas/admin.
- `services/relayMetrics.js`: registra contadores/histogramas (`relay_store_*`)
  consumidos por Prometheus y por los paneles admin.

## Documentación extendida

- `docs/relay/README.md`: diseño modular, roadmap de la fase 1 y plan de
  migración a otros servicios.
- `docs/relay/module.md`: contrato detallado de metadatos (`meta`) y códigos de
  error estandarizados.
- `docs/relay/vault.md` (pendiente): describirá la arquitectura del Attachment
  Vault una vez desplegado.

## Próximos pasos (fase 1)

1. Refactor de `enqueue`/`sendAgreementUpdate` para usar `QuotaService` +
   `RelayStore` con transacciones Mongo.
2. Adaptar `/ack`, `/purge`, `cleanupRelayByTier` y WebSocket `relay:flush` a
   la interfaz común.
3. Instrumentar métricas/alertas de cuota y actualizar la UX del front. ✅

## Planes y cuotas

- B2C: `free`, `plus`, `pro` (ver `config.tiers`) con quotas diferenciadas,
  TTL extensible y `overflowGracePct` para evitar cortes bruscos.
- B2B: `config.orgTiers` (`free`, `growth`, `business`, `enterprise`) permite
  asignar cuotas mayores por organización sin mezclar con los planes B2C.
- El cron `cleanupRelayByTier` solo ejecuta purge si el buzón supera el
  `warningRatio`, respetando la experiencia de clientes que permanecen dentro de
  su cuota.

Todo el código nuevo debe depender del `RelayStore` en lugar de acceder directo
a Mongoose para que la futura migración sea transparente.
