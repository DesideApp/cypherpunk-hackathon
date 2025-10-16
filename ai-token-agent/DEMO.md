# 🎬 Demo del AI Token Agent

## 📋 Output Esperado

Cuando ejecutas:

```bash
npm run token:add 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr
```

**El agente hace esto automáticamente:**

```
🤖 AI TOKEN AGENT
══════════════════════════════════════════════════
📍 Mint: 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr

✔ Token encontrado en Jupiter
   Symbol:   POPCAT
   Name:     Popcat
   Decimals: 9
   Verified: ✓

✔ Liquidez confirmada
   Price Impact: 0.12%
   Rutas:        4

✔ Precio obtenido
   Precio USD:   $0.5234
   Cambio 24h:   +8.45%
   Volumen 24h:  $12.4M

✔ Token no existe (OK para añadir)

📊 Resumen del Token:
──────────────────────────────────────────────────
   Code:       POPCAT
   Label:      Popcat
   Max Amount: 10,000
   Min Amount: 0.001

✔ Cambios aplicados exitosamente
   ✓ Backend actualizado
   ✓ Frontend actualizado
   ✓ Logo descargado (png)

✅ ¡Token añadido exitosamente!
══════════════════════════════════════════════════

💡 Próximos pasos:
   1. Reinicia el backend para cargar el token
   2. Añade MINT_POPCAT al .env (opcional)
   3. Prueba el blink de compra desde el frontend
```

---

## 📝 Código Generado Automáticamente

### Backend: `blinkValidationService.js`

```javascript
const ALLOWED_TOKENS = {
  BONK: { /* ... */ },
  JUP: { /* ... */ },
  PENGU: { /* ... */ },
  PUMP: { /* ... */ },
  WIF: { /* ... */ },
  POPCAT: {
    mint: env.MINT_POPCAT || '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
    code: 'POPCAT',
    label: 'Popcat',
    decimals: 9,
    maxAmount: 10000,      // ← Calculado automáticamente ($5000 / $0.5234)
    minAmount: 0.001,
  },
};
```

### Frontend: `BuyTokenModal.jsx`

```javascript
const ALLOWED = new Set(["BONK", "JUP", "PENGU", "PUMP", "POPCAT"]);
```

### Logo descargado

```
frontend/public/tokens/popcat.png
```

---

## 🔄 Comandos Disponibles

### 1. Añadir Token

```bash
# Básico (todo automático)
npm run token:add <CONTRACT_ADDRESS>

# Preview sin aplicar
npm run token:add <CA> -- --preview

# Dry run (simular)
npm run token:add <CA> -- --dry-run

# Con custom config
npm run token:add <CA> -- --code MYTOKEN --max-amount 50000

# Forzar sobrescritura
npm run token:add <CA> -- --force
```

### 2. Discovery de Tokens

```bash
# Listar tokens trending
npm run token:discover

# Modo interactivo (pregunta si añadir cada uno)
npm run token:discover -- -i
```

**Output esperado:**

```
🔥 Tokens Trending en Solana:
═══════════════════════════════════════════════════════════════════

1. POPCAT ✓ [NUEVO]
   Popcat
   CA: 7GCihgDB...uHYmW2hr
   💰 $0.5234
   📈 +8.45% 24h
   📊 Vol: $12.4M
   💧 Impact: 0.12%

2. BONK ✓ [AÑADIDO]
   Bonk
   CA: DezXAZ8z...pPB263
   💰 $0.000024
   📈 +12.45% 24h
   📊 Vol: $2.4M
   💧 Impact: 0.15%

3. JUP ✓ [AÑADIDO]
   Jupiter
   CA: JUPyiwr...NsDvCN
   💰 $0.8234
   📈 -3.21% 24h
   📊 Vol: $45.2M
   💧 Impact: 0.08%
```

### 3. Listar Tokens Añadidos

```bash
npm run token:list
```

**Output:**

```
📋 Tokens Añadidos:
═══════════════════════════════════════════════════════════════════

1. BONK
   Bonk
   Mint: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
   Añadido: 14/10/2025
   Precio al añadir: $0.000024

2. JUP
   Jupiter
   Mint: JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
   Añadido: 14/10/2025
   Precio al añadir: $0.8234

3. POPCAT
   Popcat
   Mint: 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr
   Añadido: 14/10/2025
   Precio al añadir: $0.5234

═══════════════════════════════════════════════════════════════════

Total: 3 tokens
```

### 4. Insights

```bash
npm run token:insights
```

**Output:**

```
📊 Estadísticas del AI Token Agent:
═══════════════════════════════════════════════════════════════════

📈 Resumen:
   Tokens añadidos:   3
   Tokens rechazados: 1

🆕 Último token añadido:
   POPCAT - Popcat
   14/10/2025, 15:23:45

⚙️  Preferencias:
   auto download logos: true
   min liquidity: 100000
   min volume24h: 50000
   max price impact: 5
   prefer verified: true
   default max amount usd: 5000

═══════════════════════════════════════════════════════════════════
```

### 5. Remover Token

```bash
npm run token:remove POPCAT
```

**Output:**

```
¿Seguro que quieres remover POPCAT? › No / Yes

🗑️  Removiendo token POPCAT...

   ✓ Removido del backend
   ✓ Removido del frontend
   ✓ Logo eliminado

✅ Token removido exitosamente
```

---

## 🎯 Casos de Uso Reales

### Caso 1: Añadir BONK

```bash
npm run token:add DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
```

El agente:
1. ✅ Valida en Jupiter
2. ✅ Detecta: BONK, 5 decimals, $0.000024
3. ✅ Calcula maxAmount: 200,000,000 (para ~$5000)
4. ✅ Genera código y lo aplica
5. ✅ Descarga logo desde Jupiter CDN

**Tiempo total: ~10 segundos**

### Caso 2: Añadir Token Nuevo

```bash
# Encuentras un token nuevo en DexScreener
npm run token:add <CONTRACT_ADDRESS>

# Si está en Jupiter → añadido automáticamente
# Si NO está en Jupiter → rechazado (sin liquidez garantizada)
```

### Caso 3: Explorar Trending

```bash
npm run token:discover -- -i

# Te muestra top tokens
# Eliges cuáles añadir con ✅/❌
# Añade múltiples tokens en una sesión
```

---

## 🔍 Validaciones Automáticas

El agente valida automáticamente:

| Validación | Qué verifica |
|------------|--------------|
| ✅ Existe en Jupiter | Token está en Jupiter Token List |
| ✅ Liquidez real | Quote de 0.1 SOL retorna > 0 tokens |
| ✅ Precio disponible | Jupiter Price API retorna precio USD |
| ✅ Metadatos válidos | Symbol, name, decimals correctos |
| ✅ No duplicado | No existe ya en ALLOWED_TOKENS |

Si alguna validación falla → token rechazado automáticamente.

---

## 💡 Tips

### Preview antes de aplicar

```bash
npm run token:add <CA> -- --preview
```

Muestra el código generado sin modificar archivos.

### Dry run completo

```bash
npm run token:add <CA> -- --dry-run
```

Simula todo el proceso sin aplicar cambios.

### Override manual

```bash
npm run token:add <CA> -- --code MYTOKEN --label "My Token" --max-amount 100000
```

Usa tus valores en vez de auto-detectados.

---

## 🐛 Troubleshooting

### Error: "Token no encontrado en Jupiter"

**Causa:** Token no está listado en Jupiter  
**Solución:** Solo tokens con liquidez en Jupiter son soportados

### Error: "Sin liquidez suficiente"

**Causa:** Quote de prueba falló (no hay rutas de swap)  
**Solución:** Token no es tradeable, no añadir

### Error: "Token ya existe"

**Causa:** Token ya está en ALLOWED_TOKENS  
**Solución:** Usa `--force` para sobrescribir

### Error: Network ENOTFOUND

**Causa:** Sin conexión a internet / WSL sin DNS  
**Solución:** 
1. Verificar conexión: `curl https://token.jup.ag/all`
2. En WSL2: configurar `/etc/resolv.conf`

---

## 📊 Comparación: Manual vs AI Agent

| Tarea | Manual | AI Agent |
|-------|--------|----------|
| Buscar CA | 2 min | 0 seg |
| Buscar decimals | 1 min | 0 seg |
| Verificar liquidez | 3 min | 2 seg |
| Obtener precio | 1 min | 1 seg |
| Calcular maxAmount | 30 seg | 0 seg |
| Modificar backend | 1 min | 1 seg |
| Modificar frontend | 30 seg | 1 seg |
| Descargar logo | 2 min | 2 seg |
| **TOTAL** | **~11 min** | **~10 seg** |

**Ahorro: 60x más rápido** ⚡

---

## 🎉 Resultado

Un agente completamente funcional que:

- ✅ Valida contra Jupiter (100% compatibilidad)
- ✅ Automatiza todo el proceso
- ✅ Genera código sin errores
- ✅ Mantiene memoria de decisiones
- ✅ 100% gratis (APIs públicas)

**De 11 minutos de trabajo manual a 10 segundos automáticos.** 🚀

