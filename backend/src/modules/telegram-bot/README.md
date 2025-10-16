# 🤖 Bot de Telegram para Acciones Solana

Bot de Telegram que permite ejecutar acciones de Solana usando comandos naturales en español e inglés.

## 🚀 Características

- **Comandos Naturales**: "envía 5 SOL a [wallet]", "pide 10 USDC por pizza"
- **Sistema de Fees**: Monetización automática con fees configurables
- **Estructura Modular**: Fácil añadir nuevas acciones
- **Integración Completa**: Usa tu sistema existente de blinks y acciones

## 📋 Comandos Soportados

### 💰 Envíos
- `envía 5 SOL a [wallet]`
- `manda 10 USDC a [wallet]`
- `send 2 SOL to [wallet]`

### 📝 Solicitudes
- `pide 5 SOL por pizza`
- `mándame 10 USDC`
- `request 2 SOL for dinner`

### 🛒 Compras
- `buy 1 JUP`
- `compra 5 BONK`
- `/tokens` para ver el catálogo soportado

## ⚙️ Configuración

### 1. Variables de Entorno

Añade estas variables a tu `.env`:

```bash
# Bot de Telegram
TELEGRAM_BOT_TOKEN=tu_bot_token_aqui

# Sistema de Fees (Opcional)
FEE_WALLET=tu_wallet_para_recibir_fees

# Compras (configurar cuando se sirvan nuestros blinks)
TELEGRAM_BUY_BLINK_BASE_URL=https://tu-dominio/api/v1/blinks/buy
# Opcional: personalizar el enlace compartible (default: https://dial.to/buy)
# TELEGRAM_BUY_SHARE_BASE_URL=https://tu-dominio/buy

# Catálogo adicional de tokens (opcional, formato SYMBOL:Nombre)
# TELEGRAM_TOKEN_LIST=JUP:Jupiter,BONK:Bonk
```

### 2. Obtener Token de Bot

1. Habla con [@BotFather](https://t.me/botfather) en Telegram
2. Usa `/newbot` para crear un nuevo bot
3. Sigue las instrucciones y copia el token
4. Añádelo a tu `.env` como `TELEGRAM_BOT_TOKEN`

### 3. Instalar Dependencias

```bash
npm install telegraf
```

## 🚀 Uso

### Iniciar el Bot

```bash
# Desarrollo (con auto-reload)
npm run telegram:dev

# Producción
npm run telegram:bot
```

### Comandos del Bot

- `/start` - Iniciar bot y ver bienvenida
- `/help` - Mostrar ayuda y comandos disponibles
- `/wallet [address]` - Configurar tu wallet para requests
- `/tokens` - Listar tokens soportados por el bot

### Uso en Grupos

- Telegram solo envía mensajes al bot cuando:
  - Lo mencionas (`@TuBot envíame 5 SOL por pizza`)
  - Respondes a un mensaje del bot
  - Usas un comando con `/` (ej: `/envíame 5 SOL por pizza`)
- Para recibir todo el texto en grupos sin mencionar al bot, desactiva **Privacy Mode** desde [@BotFather](https://t.me/botfather) con `/setprivacy`.
- Si además quieres que el bot procese cualquier mensaje de grupo sin mención, define `TELEGRAM_ALLOW_GROUP_MESSAGES=true` en el entorno (requiere tener el Privacy Mode desactivado).

### Notas sobre Blinks y dial.to

- Actualmente el bot genera enlaces que consumen la acción oficial de Dialect (`https://solana.dial.to/api/actions/transfer`), por lo que el flujo se renderiza en la UI de dial.to.
- Para comandos de compra, el bot necesita que `TELEGRAM_BUY_BLINK_BASE_URL` apunte a tu acción Blink (cuando no está configurada, devolverá un mensaje indicando cómo habilitarla).
- Para alojar nuestras propias definiciones Blink (control total del flujo), lee `docs/dial-to-blinks.md` donde se detalla cómo servir el JSON Blink y actualizar el bot para apuntar a nuestro endpoint.
- El catálogo que muestra `/tokens` proviene de `config/tokens.json` (el mismo que gestiona `/api/v1/tokens/allowed` y la consola de *Add Token*). Puedes añadir tokens extra temporalmente con `TELEGRAM_TOKEN_LIST=SYMBOL:Nombre`.

## 💸 Sistema de Fees

### Configuración Actual
- **Fee Base**: 0.001 SOL (~$0.20)
- **Fee Porcentual**: 1% del monto
- **Fee Mínimo**: 0.0005 SOL (~$0.10)
- **Fee Máximo**: 0.01 SOL (~$2.00)

### Personalizar Fees

```javascript
import { updateFeeConfig } from './feeSystem.js';

// Actualizar configuración
updateFeeConfig({
  baseFee: 0.002,        // 0.002 SOL fee base
  percentageFee: 0.015,  // 1.5% del monto
  minFee: 0.001,         // Mínimo 0.001 SOL
  maxFee: 0.02           // Máximo 0.02 SOL
});
```

## 🔧 API Endpoints

### GET `/api/v1/telegram-bot/stats`
Obtiene estadísticas del bot

```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "activeUsers": 42,
    "totalSessions": 42
  }
}
```

### POST `/api/v1/telegram-bot/start`
Inicia el bot

### POST `/api/v1/telegram-bot/stop`
Detiene el bot

### GET `/api/v1/telegram-bot/tokens`
Lista los tokens disponibles para el bot (se alimenta de `config/tokens.json` + `TELEGRAM_TOKEN_LIST`)

## 🏗️ Arquitectura

### Estructura de Archivos

```
backend/src/modules/telegram-bot/
├── controllers/
│   └── telegramBot.controller.js   # Lógica principal del bot (Telegraf, handlers, i18n)
├── services/
│   └── feeSystem.service.js        # Sistema de fees y monetización
├── config/
│   └── testConfig.js               # Configuración y utilidades para testing
├── routes/
│   └── index.js                    # Endpoints REST para controlar el bot
├── utils/
│   └── examples/addNewAction.js    # Ejemplos para extender el bot
├── index.js                        # Punto de entrada y exports del módulo
├── startBot.js                     # Script CLI para levantar el bot solo
└── README.md                       # Esta documentación
```

### Flujo de Comandos

1. **Usuario envía mensaje** → Telegraf recibe en `telegramBot.controller.js`
2. **Parser interno detecta acción** → RegEx de solicitudes/transferencias multilenguaje
3. **Procesa acción** → Construye URLs de `dial.to` (`buildRequest` / `buildTransfer`)
4. **Calcula fee** → `feeSystem.service.js` añade parámetros de monetización
5. **Responde al usuario** → Devuelve enlace listo para compartir o ejecutar

## 🔌 Añadir Nuevas Acciones

### 1. Actualizar Registry

```javascript
// En actions-registry.js
export const ACTIONS_REGISTRY = {
  // ... acciones existentes ...
  
  swap: {
    key: 'swap',
    patterns: [
      /^(?:cambia|swap|intercambia)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:por|to)\s+(sol|usdc|usdt)/i,
    ],
    handler: async (matches, context) => {
      const [, amount, fromToken = 'SOL', toToken] = matches;
      // Implementar lógica de swap
      return buildSwap({ fromToken, toToken, amount });
    },
    description: 'Intercambia tokens: "cambia 5 SOL por USDC"'
  }
};
```

### 2. Añadir Handler en Bot

```javascript
// En telegramBot.js
async handleSwapAction(ctx, actionResult, feeInfo) {
  // Implementar respuesta para swap
}
```

### 3. Registrar en handleActionResult

```javascript
// En telegramBot.js
case 'swap':
  await this.handleSwapAction(ctx, actionWithFee, feeInfo);
  break;
```

## 🧪 Testing

### Comandos de Prueba

```bash
# Iniciar bot en desarrollo
npm run telegram:dev

# Ver logs en tiempo real
tail -f logs/telegram-bot.log

# Verificar estadísticas
curl http://localhost:3001/api/v1/telegram-bot/stats
```

### Ejemplos de Uso

1. **Configurar wallet**: `/wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`
2. **Enviar tokens**: `envía 0.1 SOL a 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`
3. **Solicitar pago**: `pide 5 USDC por el almuerzo`

## 🚨 Troubleshooting

### Bot no responde
- Verificar que `TELEGRAM_BOT_TOKEN` esté configurado
- Comprobar logs: `tail -f logs/telegram-bot.log`
- Verificar que el bot esté iniciado: `GET /api/v1/telegram-bot/stats`

### Error "Token no soportado"
- Verificar que el token esté en la lista de soportados
- Añadir nuevo token en `tokens.js` si es necesario

### Fees no se calculan
- Verificar configuración en `feeSystem.js`
- Comprobar que `FEE_WALLET` esté configurado

## 📈 Próximas Mejoras

- [ ] **Acción Buy**: Integrar con tu sistema de compra existente
- [ ] **Alertas Whale**: Notificaciones de movimientos grandes
- [ ] **Bridge Bot**: Enlaces a otras redes sociales
- [ ] **IA Opcional**: Parser más inteligente para comandos complejos
- [ ] **Webhooks**: En lugar de polling para mejor rendimiento
- [ ] **Multi-idioma**: Soporte para más idiomas

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Implementa los cambios
4. Añade tests si es necesario
5. Envía un pull request

## 📄 Licencia

MIT License - ver LICENSE file para detalles.

