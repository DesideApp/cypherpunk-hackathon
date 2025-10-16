# 🤖 AI Token Agent - Automatizador de Tokens SPL

> **Agente de IA que automatiza la gestión de tokens SPL de Solana en tu sistema de blinks**

Sistema inteligente que descubre, valida y añade tokens SPL automáticamente a tu plataforma, validando contra Jupiter API para asegurar liquidez y compatibilidad.

---

## 🎯 Problema que Resuelve

Añadir tokens manualmente es tedioso y propenso a errores:

- ❌ Copiar/pegar contract addresses manualmente
- ❌ Buscar decimales en exploradores
- ❌ Verificar liquidez en DEXs
- ❌ Descargar logos uno por uno
- ❌ Modificar múltiples archivos (backend + frontend)
- ❌ Calcular maxAmount según precio
- ❌ Tokens sin liquidez que rompen los swaps

**Este agente automatiza todo el proceso.**

---

## ✨ Características

### 🔍 Validación Automática con Jupiter
- ✅ Verifica que el token existe en Jupiter Token List
- ✅ Valida liquidez real mediante quote de prueba (0.1 SOL)
- ✅ Obtiene precio actual y métricas 24h
- ✅ Extrae metadatos automáticamente (symbol, name, decimals)
- ✅ Descarga logos desde Jupiter CDN

### 🧠 Inteligencia Automatizada
- ✅ Calcula `maxAmount` dinámicamente según precio USD
- ✅ Genera código para backend y frontend automáticamente
- ✅ Aplica cambios a los archivos correctos
- ✅ Sistema de memoria (tokens añadidos/rechazados)
- ✅ Discovery de tokens trending

### 🚀 Modos de Uso
1. **Manual**: Añadir token por contract address
2. **Discovery**: Descubrir tokens trending (interactivo)
3. **Watch**: Modo observador 24/7 (WIP)

---

## 🚀 Quick Start

### Instalación

```bash
cd ai-token-agent
npm install
```

### Uso Básico

```bash
# Desde la RAÍZ del proyecto:

# Añadir token por contract address
npm run token:add DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263

# Descubrir tokens trending
npm run token:discover

# Descubrir en modo interactivo
npm run token:discover -- -i

# Listar tokens añadidos
npm run token:list

# Ver estadísticas
npm run token:insights

# Remover token
npm run token:remove BONK
```

---

## 📋 Flujo de Trabajo

### 1. Añadir Token Manualmente

```bash
npm run token:add <CONTRACT_ADDRESS>
```

**El agente automáticamente:**

1. ✅ Valida que existe en Jupiter Token List
2. ✅ Extrae `symbol`, `name`, `decimals`
3. ✅ Verifica liquidez con quote de prueba (SOL → Token)
4. ✅ Obtiene precio actual desde Jupiter Price API
5. ✅ Calcula `maxAmount` (target: ~$5000 USD)
6. ✅ Genera código para backend y frontend
7. ✅ Descarga logo desde Jupiter CDN
8. ✅ Aplica cambios a los archivos
9. ✅ Guarda en memoria

**Output:**

```
🤖 AI TOKEN AGENT
═══════════════════════════════════════════════════
📍 Mint: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263

✔ Token encontrado en Jupiter
   Symbol:   BONK
   Name:     Bonk
   Decimals: 5
   Verified: ✓

✔ Liquidez confirmada
   Price Impact: 0.15%
   Rutas:        3

✔ Precio obtenido
   Precio USD:   $0.000024
   Cambio 24h:   +12.45%
   Volumen 24h:  $2.4M

✔ Token no existe (OK para añadir)

📊 Resumen del Token:
──────────────────────────────────────────────────
   Code:       BONK
   Label:      Bonk
   Max Amount: 200,000,000
   Min Amount: 0.001

✔ Cambios aplicados exitosamente
   ✓ Backend actualizado
   ✓ Frontend actualizado
   ✓ Logo descargado (png)

✅ ¡Token añadido exitosamente!
═══════════════════════════════════════════════════

💡 Próximos pasos:
   1. Reinicia el backend para cargar el token
   2. Añade MINT_BONK al .env (opcional)
   3. Prueba el blink de compra desde el frontend
```

### 2. Discovery de Tokens Trending

```bash
npm run token:discover -- -i
```

Muestra tokens populares en Solana con opción interactiva de añadirlos:

```
🔥 Tokens Trending en Solana:
═══════════════════════════════════════════════════════════════════

1. BONK ✓ [NUEVO]
   Bonk
   CA: DezXAZ8z...pPB263
   💰 $0.000024
   📈 +12.45% 24h
   📊 Vol: $2.4M
   💧 Impact: 0.15%

2. JUP ✓ [AÑADIDO]
   Jupiter
   CA: JUPyiwr...NsDvCN
   💰 $0.8234
   📈 -3.21% 24h
   📊 Vol: $45.2M
   💧 Impact: 0.08%

¿Qué hacer con BONK (Bonk)?
❯ ✅ Añadir
  ❌ Rechazar
  ⏭️  Siguiente
  🚪 Salir
```

### 3. Opciones Avanzadas

```bash
# Preview sin aplicar cambios
npm run token:add <CA> -- --preview

# Dry run (simular)
npm run token:add <CA> -- --dry-run

# Sobrescribir token existente
npm run token:add <CA> -- --force

# Custom symbol/label
npm run token:add <CA> -- --code PENG --label "Penguin Token"

# Custom maxAmount
npm run token:add <CA> -- --max-amount 50000

# Sin descargar logo
npm run token:add <CA> -- --no-download-logo
```

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│              AI TOKEN AGENT                      │
└───────────────┬─────────────────────────────────┘
                │
    ┌───────────┴────────────┐
    │                        │
    ▼                        ▼
┌────────────┐       ┌──────────────┐
│  Jupiter   │       │  Code        │
│  Validator │──────▶│  Generator   │
└────────────┘       └──────────────┘
    │                        │
    │ Token List API         │ Modifica archivos
    │ Quote API              │
    │ Price API              │
    ▼                        ▼
┌────────────┐       ┌──────────────┐
│  Memory    │       │  Backend     │
│  Manager   │       │  Frontend    │
└────────────┘       └──────────────┘
```

### Componentes

- **jupiterValidator.js**: Validación contra Jupiter APIs
- **codeGenerator.js**: Genera y aplica código automáticamente
- **tokenAgent.js**: Motor principal (orquestador)
- **tokenDiscovery.js**: Descubre tokens trending
- **memoryManager.js**: Sistema de memoria persistente
- **index.js**: CLI principal

---

## 📊 APIs Utilizadas

### Jupiter Token List
```
GET https://token.jup.ag/all
```
- Lista completa de tokens soportados por Jupiter
- Incluye: address, symbol, name, decimals, logoURI

### Jupiter Quote API
```
GET https://quote-api.jup.ag/v6/quote
```
- Valida liquidez con quote de prueba (0.1 SOL)
- Retorna: outAmount, priceImpact, routePlan

### Jupiter Price API
```
GET https://api.jup.ag/price/v2?ids=<mint>
```
- Precio actual en USD
- Cambio 24h, volumen, market cap

---

## 📝 Archivos Modificados

El agente modifica automáticamente:

### 1. Backend: `blinkValidationService.js`

```javascript
// ANTES
const ALLOWED_TOKENS = {
  BONK: { ... },
  JUP: { ... },
};

// DESPUÉS (agente añade)
const ALLOWED_TOKENS = {
  BONK: { ... },
  JUP: { ... },
  PENG: {
    mint: env.MINT_PENG || 'So1a1a...',
    code: 'PENG',
    label: 'Penguin',
    decimals: 6,
    maxAmount: 50000,
    minAmount: 0.001,
  },
};
```

### 2. Frontend: `BuyTokenModal.jsx`

```javascript
// ANTES
const ALLOWED = new Set(["BONK", "JUP", "PENGU", "PUMP"]);

// DESPUÉS
const ALLOWED = new Set(["BONK", "JUP", "PENGU", "PUMP", "PENG"]);
```

### 3. Frontend: Logo

Descarga automáticamente el logo a:
```
frontend/public/tokens/peng.png
```

---

## 💾 Sistema de Memoria

El agente mantiene memoria persistente en `memory/`:

```
ai-token-agent/memory/
├── tokens-added.json       # Tokens añadidos (con precios históricos)
├── tokens-rejected.json    # Tokens rechazados
└── preferences.json        # Preferencias del usuario
```

### Ver memoria

```bash
npm run token:list
npm run token:insights
```

---

## 🎯 Casos de Uso

### Caso 1: Añadir Token Nuevo

```bash
# Obtienes CA desde DexScreener o Solscan
npm run token:add 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr

# El agente hace TODO el trabajo
# ✓ Valida, descarga metadatos, genera código, aplica cambios
```

### Caso 2: Explorar Tokens Trending

```bash
# Modo interactivo
npm run token:discover -- -i

# Elige cuáles añadir con ✅/❌
```

### Caso 3: Remover Token

```bash
npm run token:remove BONK

# Remueve del backend, frontend y elimina logo
```

---

## 🔧 Comandos Completos

| Comando | Descripción |
|---------|-------------|
| `npm run token:add <CA>` | Añadir token por contract address |
| `npm run token:discover` | Descubrir tokens trending |
| `npm run token:discover -- -i` | Modo interactivo |
| `npm run token:list` | Listar tokens añadidos |
| `npm run token:list -- --json` | Output en JSON |
| `npm run token:remove <CODE>` | Remover token |
| `npm run token:insights` | Ver estadísticas y memoria |
| `npm run token:cleanup` | Limpiar tokens antiguos (>90 días) |
| `npm run token:update-prices` | Actualizar precios (WIP) |
| `npm run token:watch` | Modo observador 24/7 (WIP) |

---

## ⚙️ Opciones CLI

### add

```bash
--code <symbol>          # Symbol del token (auto si no se provee)
--label <name>           # Nombre del token (auto si no se provee)
--max-amount <amount>    # Max amount personalizado
--min-amount <amount>    # Min amount personalizado
--no-download-logo       # No descargar logo
--preview                # Preview sin aplicar
--dry-run                # Simular sin cambios
--force                  # Sobrescribir si existe
--verbose                # Errores detallados
```

### discover

```bash
-i, --interactive        # Modo interactivo
--include-existing       # Incluir tokens ya añadidos
```

### remove

```bash
-y, --yes                # Confirmar automáticamente
```

---

## 💰 Costos

- **Jupiter APIs**: Gratis (sin rate limits razonables)
- **IA**: No requiere OpenAI/Claude
- **Infraestructura**: $0 (corre local)

**Total: $0/mes** 🎉

---

## 🛡️ Validaciones

El agente valida:

1. ✅ Token existe en Jupiter Token List
2. ✅ Tiene liquidez real (quote retorna > 0)
3. ✅ Precio disponible
4. ✅ Decimals válidos (0-18)
5. ✅ No está duplicado (a menos que uses --force)

---

## 🔮 Roadmap

- [ ] Modo `watch` con cron (auto-discovery periódico)
- [ ] Actualización automática de precios
- [ ] Integración con Birdeye/DexScreener
- [ ] Detección de tokens "muertos" (liquidez < threshold)
- [ ] Auto-removal de tokens sin volumen
- [ ] Webhooks para notificaciones
- [ ] Dashboard web de tokens

---

## 🎓 Ejemplos

### Ejemplo 1: Añadir BONK

```bash
npm run token:add DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

### Ejemplo 2: Añadir con custom config

```bash
npm run token:add 7GCihgDB... -- --code POPCAT --max-amount 100000
```

### Ejemplo 3: Preview antes de aplicar

```bash
npm run token:add MEW1gQWJ3... -- --preview
```

---

## 📜 Licencia

Proyecto desarrollado para Deside Hackathon 2025.

---

## 👥 Stack Tecnológico

- **Node.js** - Runtime
- **Jupiter APIs** - Validación y datos
- **Commander** - CLI interface
- **Chalk** - Output coloreado
- **Ora** - Spinners
- **Prompts** - Interactividad

---

## 🎉 Resultado

Un agente automatizado que:

- ✅ Valida tokens contra Jupiter (garantiza compatibilidad)
- ✅ Extrae metadatos automáticamente
- ✅ Verifica liquidez real
- ✅ Genera código sin intervención manual
- ✅ Descarga logos automáticamente
- ✅ Mantiene memoria de decisiones
- ✅ 100% gratis

**Añadir tokens en 10 segundos en vez de 10 minutos.** 🚀

