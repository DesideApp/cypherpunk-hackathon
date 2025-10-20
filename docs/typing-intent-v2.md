# 🚀 Typing Intent v2 - Sistema de Comandos Naturales

## 📋 Descripción

Sistema mejorado de comandos naturales que permite a los usuarios escribir acciones en lenguaje natural y el sistema las ejecuta correctamente con confirmación previa.

## ✨ Acciones Soportadas

### 💳 P2P Payments
- **send** - Enviar tokens a otro usuario
- **request** - Solicitar tokens de otro usuario

### 🔄 Trading
- **buy** - Comprar tokens con SOL
- **swap** - Intercambiar tokens

### 🏦 DeFi Operations
- **deposit** - Depositar tokens en protocolo DeFi
- **withdraw** - Retirar tokens de protocolo DeFi
- **borrow** - Tomar préstamo de protocolo DeFi
- **repay** - Pagar préstamo en protocolo DeFi
- **claim** - Reclamar recompensas de protocolo DeFi

## 🎯 Protocolos Soportados

- **Kamino** - Protocolo de préstamos y liquidez
- **MarginFi** - Protocolo de préstamos descentralizados
- **Jupiter** - Agregador de swaps

## 📝 Ejemplos de Comandos

### Español
\`\`\`
envía 5 SOL
pídeme 10 USDC
compra 0.5 SOL
cambia 1 SOL a USDC
deposita 5 SOL en kamino
retira 10 USDC de marginfi
pide prestado 5 SOL de marginfi
paga 2 USDT en kamino
reclama rewards de kamino
\`\`\`

### English
\`\`\`
send 5 SOL
request 10 USDC
buy 0.5 SOL
swap 1 SOL to USDC
deposit 5 SOL in kamino
withdraw 10 USDC from marginfi
borrow 5 SOL from marginfi
repay 2 USDT to kamino
claim rewards from kamino
\`\`\`

## 🏗️ Arquitectura

\`\`\`
src/shared/natural-commands/
├── ActionDefinitions.mjs     # ← ÚNICA FUENTE DE VERDAD
├── NaturalCommandParser.js   # Parser compartido
├── ActionRegistry.js         # Registry compartido
└── index.js                  # Exportaciones

backend/src/modules/natural-commands/
├── parser.js                 # Re-exporta parser compartido
├── actions-registry.js       # Re-exporta registry compartido
└── handlers/                 # Handlers específicos del backend

frontend/src/utils/
├── naturalCommandsParser.js  # Re-exporta parser compartido
└── naturalCommandsExecutor.js # Ejecutor del frontend
\`\`\`

## 🔧 Agregar Nueva Acción

1. Edita \`src/shared/natural-commands/ActionDefinitions.mjs\`:

\`\`\`javascript
{
  key: 'nueva_accion',
  verbs: ['verbo1', 'verbo2', 'verbo3'],
  patterns: ['amount', 'token', 'protocol'],
  protocols: ['kamino', 'marginfi'],
  handler: 'createNuevaAccionAction',
  description: 'Descripción de la acción',
  examples: [
    'ejemplo 1',
    'ejemplo 2'
  ]
}
\`\`\`

2. Regenera los intents:

\`\`\`bash
npm run generate-intents
\`\`\`

3. Crea el handler en \`backend/src/modules/natural-commands/handlers/index.js\`

4. ¡Listo! El parser detectará automáticamente la nueva acción.

## 🧪 Testing

\`\`\`bash
npm test -- src/natural-commands.test.js
\`\`\`

## 📊 Métricas

- **Acciones totales**: 9
- **Protocolos soportados**: 3
- **Idiomas**: Español, Inglés
- **Success rate objetivo**: ≥ 90%

## 🎯 Próximos Pasos

1. Sistema de confirmación previa
2. Normalizador avanzado (sinónimos, porcentajes)
3. Watch mode para desarrollo
4. CLI para agregar acciones
5. Validación de balances
6. Soporte para más protocolos (Orca, Raydium)

## 📚 Documentación Adicional

- [Natural Commands Backend](backend/src/modules/natural-commands/README.md)
- [Natural Commands Frontend](frontend/src/utils/README-natural-commands.md)
- [Blink Integration](docs/dial-to-blinks.md)


