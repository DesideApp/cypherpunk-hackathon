# 🤖 Natural Commands - Cliente Only

Sistema de comandos naturales implementado completamente en el cliente para máxima velocidad y 0 costes.

## 🎯 Características

- ✅ **0 latencia** - Detección instantánea
- ✅ **0 costes** - Sin APIs, sin servidor
- ✅ **0 complejidad** - Código simple
- ✅ **Funciona offline** - Sin dependencias
- ✅ **Preview en tiempo real** - Muestra qué comando se detectó

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

## 📁 Archivos

```
frontend/src/utils/
├── naturalCommandsParser.js    # Parser de comandos
├── naturalCommandsExecutor.js  # Ejecutor de comandos
└── README-natural-commands.md  # Esta documentación

frontend/src/features/messaging/ui/
├── WritingPanel.jsx           # Integración principal
└── WritingPanel.css           # Estilos del preview
```

## 🔄 Flujo de Funcionamiento

### 1. **Detección en Tiempo Real**
```javascript
// Mientras el usuario escribe
const command = parser.parse(message);
if (command) {
  setCommandPreview({
    action: command.action,
    message: parser.generatePreview(command)
  });
}
```

### 2. **Al Enviar Mensaje**
```javascript
const handleSend = async () => {
  // Parsear comando
  const command = parser.parse(message);
  
  if (command) {
    // Ejecutar comando
    const result = await executor.execute(command, context);
    if (result.success) {
      resetInput();
      return; // No enviar como mensaje normal
    }
  }
  
  // Si no es comando, enviar mensaje normal
  await onSendText(message);
};
```

### 3. **Ejecución de Comandos**
```javascript
// Send: Abre Blink directamente
window.open(action.dialToUrl, '_blank');

// Request: Envía payment request
await sendPaymentRequest({ token, amount, actionUrl });

// Buy: Abre endpoint de compra
window.open(buyBlinkUrl, '_blank');

// Swap: Abre Jupiter
window.open(jupiterUrl, '_blank');
```

## 🛠️ Añadir Nueva Acción

### 1. **Registrar en el Parser**
```javascript
// En naturalCommandsParser.js
export const ACTION_REGISTRY = {
  // ... acciones existentes
  
  nuevaAccion: {
    patterns: [
      /comando\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
    ],
    handler: 'nuevaAccion',
    requiredParams: ['amount', 'token'],
    description: 'Descripción de la nueva acción'
  }
};
```

### 2. **Crear Ejecutor**
```javascript
// En naturalCommandsExecutor.js
async executeNuevaAccion(params, context) {
  const { amount, token } = params;
  
  // Lógica de la acción
  const actionUrl = `https://ejemplo.com/action?amount=${amount}&token=${token}`;
  
  // Abrir o ejecutar
  window.open(actionUrl, '_blank');
  
  return {
    success: true,
    type: 'nuevaAccion',
    message: `Nueva acción: ${amount} ${token}`
  };
}
```

### 3. **¡Listo!**
El comando `"comando 5 SOL"` ahora funcionará automáticamente.

## 🎨 Integración en WritingPanel

### **Props Necesarias**
```javascript
<WritingPanel
  onSendText={onSendText}
  sendPaymentRequest={sendPaymentRequest} // Para requests
  // ... otras props
/>
```

### **Estados del Preview**
```javascript
const [commandPreview, setCommandPreview] = useState(null);

// Preview se muestra automáticamente cuando se detecta un comando
{commandPreview && (
  <div className="command-preview">
    <Zap size={16} />
    <span>{commandPreview.message}</span>
  </div>
)}
```

## 🔧 Configuración

### **Tokens Soportados**
```javascript
const validTokens = ['SOL', 'USDC', 'USDT'];
```

### **Validaciones**
- Cantidades: > 0, formato numérico
- Tokens: Solo los permitidos
- Parámetros requeridos según acción

## 🐛 Debugging

### **Logs en Consola**
```javascript
// Ver comandos detectados
console.log('Command detected:', command);

// Ver ejecución
console.log('Command executed:', result);
```

### **Testing Manual**
```javascript
// En consola del navegador
const parser = new NaturalCommandParser();
const command = parser.parse('mándame 5 SOL');
console.log(command);
```

## 🚀 Ventajas vs Backend

| Aspecto | Cliente Only | Con Backend |
|---------|-------------|-------------|
| **Latencia** | 0ms | 100-300ms |
| **Costes** | $0 | $20-50/mes |
| **Complejidad** | Baja | Media |
| **Offline** | ✅ Funciona | ❌ No funciona |
| **Analytics** | ❌ No | ✅ Sí |
| **Mantenimiento** | Bajo | Medio |

## 📊 Métricas (Futuro)

Cuando tengas >500 usuarios, puedes añadir:
- Analytics de comandos más usados
- Personalización por usuario
- Nuevas acciones dinámicas

## 🔒 Seguridad

- **Validación local**: Todos los parámetros se validan
- **Sanitización**: Limpieza de inputs
- **Rate limiting**: Previene abuso (futuro)

---

**¿Necesitas ayuda?** Revisa los logs de consola o contacta al equipo de desarrollo.

