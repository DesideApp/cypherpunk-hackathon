---
title: Integración de Blinks con Dial.to
description: Guía para servir acciones Blink desde nuestro backend y consumirlas desde el bot de Telegram.
---

# Integración de Blinks con Dial.to

Esta guía explica cómo llevar los enlaces del bot de Telegram a un flujo completamente gestionado por nuestro backend, sirviendo acciones Blink compatibles con Dialect y dial.to.

## Situación actual

- El bot de Telegram (archivo `backend/src/modules/telegram-bot`) genera enlaces usando `https://solana.dial.to/api/actions/transfer`.
- Estos enlaces ya funcionan con la UI pública de dial.to (`https://dial.to/transfer` y `https://dial.to/request`).
- Para la experiencia Blink (`solana-action:`) seguimos apuntando al endpoint de Dialect, por lo que no controlamos la definición ni la ejecución de la acción.

## Objetivos

1. Servir nuestra **propia acción Blink** desde el backend.
2. Hacer que el bot apunte a nuestro dominio (`actionUrl` propio).
3. Poder ejecutar y personalizar el flujo de la transacción (pagos, fees, seguimiento).

## Pasos pendientes

### 1. Crear endpoint Blink en el backend

- Lugar sugerido: `backend/src/modules/blinks/controllers/customTransfer.controller.js`.
- Debe exponer un endpoint público (ej: `GET /api/v1/blinks/transfer`) que responda con el JSON de definición Blink.
- Estructura base (ver [docs de Dialect](https://docs.dial.to) para campos opcionales):

  ```json
  {
    "title": "Enviar SOL",
    "icon": "https://tu-dominio/icon.png",
    "description": "Envía SOL usando Deside",
    "links": {
      "actions": [
        {
          "label": "Enviar",
          "href": "https://tu-dominio/api/v1/blinks/transfer/run",
          "type": "transaction"
        }
      ]
    }
  }
  ```

- Este JSON describe la acción (UI, botones, etc.). El `href` debe apuntar a otro endpoint nuestro que devuelva la transacción.

### 2. Exponer endpoint de ejecución

- Endpoint sugerido: `POST /api/v1/blinks/transfer/run`.
- Entrada: los parámetros que decidamos (wallet destino, monto, memo). dial.to los enviará según defina la acción.
- Salida: transacción(es) en base64 lista(s) para firmar:

  ```json
  {
    "type": "transaction",
    "transaction": "<BASE64>"
  }
  ```

- Para construir la transacción, podemos reutilizar helpers de `@solana/web3.js` y la configuración en `backend/src/shared/solana`.

### 3. Validación y seguridad

- Asegurarse de validar los parámetros (direcciones base58, montos > 0, tokens soportados).
- Opcional: firmar las transacciones o incluir referencias para controlar el flujo cuando el usuario la firma.
- Registrar logs usando `logger` (`backend/src/config/logger.js`) para auditoría.

### 4. Actualizar `dialTo.service`

- Ajustar `backend/src/modules/telegram-bot/services/dialTo.service.js`:
  - Reemplazar `https://solana.dial.to/api/actions/transfer` por nuestro endpoint (`https://tu-dominio/api/v1/blinks/transfer`).
  - Actualizar `DIAL_TO_TRANSFER_BASE` / `DIAL_TO_REQUEST_BASE` si queremos personalizar la UI; si mantenemos los de dial.to, seguirán funcionando.

### 5. Configuración de dominio

- El `actionUrl` debe ser accesible por dial.to, así que:
  - Servirlo sobre HTTPS.
  - Usar un dominio público (puede ser subdominio de Deside).
  - No se requiere “registro” en dial.to; sólo que la URL devuelva un JSON válido.

### 6. Pruebas

1. Abrir en navegador: `https://dial.to/?action=solana-action:https://tu-dominio/api/v1/blinks/transfer?to=...`.
2. Verificar que la UI cargue, muestre la acción y llame correctamente al endpoint `/run`.
3. Probar desde el bot: ejecutar comando natural y comprobar que el enlace generado abre la misma experiencia.

### 7. Extendiendo al flujo de compras

- El bot espera `TELEGRAM_BUY_BLINK_BASE_URL` para generar blinks de compra (`buy 1 JUP`).
- Debes servir un endpoint análogo a `transfer`, por ejemplo `GET /api/v1/blinks/buy` + `POST /api/v1/blinks/buy/run`, que construya la transacción de compra (puedes apoyarte en Jupiter o en pools propios).
- Opcionalmente, define `TELEGRAM_BUY_SHARE_BASE_URL` si quieres que el enlace de compartir apunte a tu UI en lugar de `https://dial.to/buy`.
- Amplía el catálogo que muestra `/tokens` ajustando la variable `TELEGRAM_TOKEN_LIST` (`SYMBOL:Nombre` separados por comas) o modificando `tokenCatalog.service.js`.
- El endpoint público `GET /api/v1/telegram-bot/tokens` expone la lista actual de tokens (reutiliza `config/tokens.json`). El bot usa este mismo servicio para `/tokens` y para validar comandos de compra.

### 8. Opcionales

- Integrar `executeBlinkAction` con nuestro endpoint para manejar los casos programáticos (por ejemplo, desde scripts o tests).
- Guardar estadísticas de uso en base de datos.
- Añadir soporte a acciones adicionales (swap, stake, NFT) siguiendo la misma estructura de definición + ejecución.

## Referencias

- `backend/src/modules/telegram-bot/services/dialTo.service.js` — Generación de URLs actuales.
- `backend/src/shared/services/dialectBlinkService.js` — Ejecución de blinks mediante Dialect.
- Documentación oficial de Dialect: <https://docs.dial.to>

Con estos pasos, el flujo quedará completamente bajo nuestro control y podremos personalizar tanto la definición del blink como su ejecución y métricas.
