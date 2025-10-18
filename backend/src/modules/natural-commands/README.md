# 🤖 Natural Commands Module

Sistema modular para procesar comandos naturales en español y convertirlos en acciones de Blink ejecutables.

## 🎯 Características

- **Parser modular**: Fácil añadir nuevas acciones
- **Regex puro**: Sin consumo de IA (0% coste)
- **Validación en tiempo real**: Preview de comandos
- **Extensible**: Registrar nuevas acciones dinámicamente
- **Seguro**: Validación completa de parámetros

## 🚀 Comandos Soportados

### 💳 Envío (Send)
```
"mándame 5 SOL"
"envía 2 USDC a @usuario"
"te envío 0.1 SOL por favor"
"quiero enviar 10 USDT"
```

### 📋 Solicitud (Request)
```
"pídeme 3 SOL"
"necesito 5 USDC"
"quiero recibir 2 USDT"
"solicita 1 SOL"
```

### 🛒 Compra (Buy)
```
"compra 0.5 SOL"
"quiero comprar 2 USDC"
"buy 1 USDT"
```

### 🔄 Intercambio (Swap)
```
"cambia 1 SOL a USDC"
"convierte 10 USDC en SOL"
"swap 5 USDT to SOL"
```

## 📁 Estructura

```
natural-commands/
├── actions-registry.js    # Registry de acciones disponibles
├── parser.js             # Parser principal
├── handlers/
│   └── index.js          # Handlers de ejecución
├── controllers/
│   └── naturalCommands.controller.js  # Controlador API
├── routes/
│   └── index.js          # Rutas del módulo
└── README.md             # Esta documentación
```

## 🔌 API Endpoints

### POST `/api/v1/natural-commands/parse`
Parsear y ejecutar comando natural.

**Request:**
```json
{
  "message": "mándame 5 SOL"
}
```

**Response:**
```json
{
  "success": true,
  "command": {
    "action": "send",
    "type": "send",
    "message": "Send 5 SOL"
  },
  "result": {
    "blinkUrl": "https://dial.to/?blink=...",
    "actionUrl": "https://solana.dial.to/api/actions/transfer?..."
  }
}
```

### POST `/api/v1/natural-commands/validate`
Validar comando sin ejecutarlo.

### GET `/api/v1/natural-commands/actions`
Obtener acciones disponibles.

### POST `/api/v1/natural-commands/register` (Admin)
Registrar nueva acción dinámicamente.

## 🛠️ Añadir Nueva Acción

### 1. Registrar en el Registry
```javascript
// En actions-registry.js
export const ACTION_REGISTRY = {
  // ... acciones existentes
  
  nuevaAccion: {
    patterns: [
      /comando\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
    ],
    handler: 'createNuevaAccionAction',
    requiredParams: ['amount', 'token'],
    optionalParams: ['memo'],
    description: 'Descripción de la nueva acción'
  }
};
```

### 2. Crear Handler
```javascript
// En handlers/index.js
export async function createNuevaAccionAction(params, userId) {
  const { amount, token } = params;
  
  // Lógica de la acción
  const actionUrl = `https://ejemplo.com/action?amount=${amount}&token=${token}`;
  
  return {
    success: true,
    action: { actionUrl },
    type: 'nuevaAccion',
    message: `Nueva acción: ${amount} ${token}`,
    blinkUrl: `https://dial.to/?blink=${encodeURIComponent(actionUrl)}`
  };
}

// Añadir al registry de handlers
export const ACTION_HANDLERS = {
  // ... handlers existentes
  createNuevaAccionAction
};
```

### 3. ¡Listo!
El comando `"comando 5 SOL"` ahora funcionará automáticamente.

## 🎨 Frontend Integration

### Servicio
```javascript
import { executeNaturalCommand } from '@features/messaging/services/naturalCommandsService.js';

// Ejecutar comando
const result = await executeNaturalCommand('mándame 5 SOL');
```

### WritingPanel
El `WritingPanel.jsx` ya está integrado y:
- Detecta comandos en tiempo real
- Muestra preview del comando
- Ejecuta automáticamente al enviar
- Fallback a mensaje normal si no es comando

## 🔧 Configuración

### Rate Limiting
- **Comandos**: 30 por minuto por usuario
- **Admin**: 10 por 5 minutos

### Validaciones
- Tokens permitidos: SOL, USDC, USDT
- Cantidades: > 0, formato numérico
- Parámetros requeridos según acción

## 🚀 Futuras Mejoras

### IA Opcional
```javascript
// Cuando tengas >500 usuarios
const aiParser = new AIParser(process.env.OPENAI_API_KEY);
aiParser.enable(); // Activar IA para casos ambiguos
```

### Nuevas Acciones
- **Stake**: "stakea 10 SOL"
- **NFT**: "mint NFT"
- **DeFi**: "deposita 100 USDC en pool"

### Mejoras UX
- Autocompletado de comandos
- Historial de comandos
- Comandos favoritos

## 🐛 Debugging

### Logs
```bash
# Ver logs de comandos
grep "natural-commands" logs/app.log

# Ver errores
grep "❌.*natural-commands" logs/app.log
```

### Testing
```javascript
// Test manual
const parser = new NaturalCommandParser();
const command = parser.parse('mándame 5 SOL');
console.log(command);
```

## 📊 Métricas

El sistema registra:
- Comandos procesados por tipo
- Tiempo de respuesta
- Errores por acción
- Usuarios activos

## 🔒 Seguridad

- **Validación completa**: Todos los parámetros se validan
- **Rate limiting**: Previene abuso
- **Sanitización**: Limpieza de inputs
- **Logs de auditoría**: Trazabilidad completa

---

**¿Necesitas ayuda?** Revisa los logs o contacta al equipo de desarrollo.












