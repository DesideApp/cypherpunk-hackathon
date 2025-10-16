# Proveedores de Fund Wallet - Comparativa Detallada

## 🎯 Por qué elegimos Coinflow + Transak

Después de investigar las opciones, elegimos estos dos proveedores por:

1. ✅ **NO requieren empresa registrada**
2. ✅ **Funcionan con URLs públicas** (sin credenciales)
3. ✅ **Buenos límites sin KYC**
4. ✅ **Soporte nativo para Solana**

---

## 💎 **Coinflow** (Recomendado #1)

### Ventajas
- ✅ **Construido específicamente para Solana**
- ✅ Límite sin KYC: **$500** (el más alto)
- ✅ Comisiones bajas: ~2.5%
- ✅ No requiere empresa
- ✅ Acepta individuos/sole proprietors
- ✅ **Funciona SIN credenciales** con URLs públicas

### Desventajas
- ⚠️ Aprobación merchant: 1-3 días (opcional)
- ⚠️ Menos métodos de pago que Transak

### Registro como Merchant (opcional)
1. https://merchant.coinflow.cash/
2. Registro como "Individual" o "Sole Proprietor"
3. Verificación básica de identidad (NO es KYC bancario)
4. Aprobación en 1-3 días laborables

### Sin registro (YA funciona)
```javascript
const url = `https://coinflow.cash/checkout?walletPubkey=${wallet}&amount=${amount}&currency=USD&blockchain=solana`;
```

---

## 🌍 **Transak** (Recomendado #2)

### Ventajas
- ✅ Cobertura global muy amplia
- ✅ Múltiples métodos de pago
- ✅ No requiere empresa
- ✅ Registro simple para individuos
- ✅ **Funciona SIN credenciales** con "demo-api-key"

### Desventajas
- ⚠️ Límite sin KYC más bajo: ~$125
- ⚠️ Comisiones un poco más altas: ~3.5%
- ⚠️ No es específico de Solana (multi-chain)

### Registro (opcional)
1. https://integrate.transak.com/
2. Registro como "Individual Developer"
3. API Key instantánea para testing
4. Para producción: verificación simple de identidad

### Sin registro (YA funciona)
```javascript
const url = `https://global.transak.com?apiKey=demo-api-key&cryptoCurrencyCode=SOL&walletAddress=${wallet}&fiatAmount=${amount}`;
```

---

## ❌ **Descartados**

### MoonPay
- ❌ **Requiere empresa registrada**
- ❌ Business entity mandatory para producción
- ⚠️ Solo funciona con cuenta sandbox para individuos
- ✅ Buena UX y límites
- ✅ Muy conocido

**Por qué lo descartamos:** La barrera de entrada es muy alta para MVP/hackathon.

### Ramp Network
- ✅ No requiere empresa
- ⚠️ API más limitada que Coinflow/Transak
- ⚠️ Documentación menos clara para Solana

**Por qué no lo incluimos aún:** Coinflow y Transak cubren mejor el caso de uso.

---

## 📊 Comparativa Final

| Criterio | Coinflow | Transak | MoonPay | Ramp |
|----------|----------|---------|---------|------|
| **Requiere empresa** | ❌ No | ❌ No | ✅ Sí | ❌ No |
| **Límite sin KYC** | $500 | $125 | $150 | $100 |
| **Comisión aprox.** | 2.5% | 3.5% | 4% | 3% |
| **Funciona sin API key** | ✅ Sí | ✅ Sí | ❌ No | ⚠️ Limitado |
| **Específico Solana** | ✅ Sí | ⚠️ Multi | ⚠️ Multi | ⚠️ Multi |
| **Velocidad** | 5-10 min | 10-15 min | 10-20 min | 10-15 min |
| **Registro individual** | ✅ Fácil | ✅ Muy fácil | ❌ No | ✅ Fácil |

---

## 🚀 Recomendación para tu proyecto

### Para MVP/Hackathon (AHORA)
**Usa URLs públicas** - Funciona inmediatamente sin registros:
- ✅ Coinflow como opción principal
- ✅ Transak como alternativa

### Para Producción (después)
**Regístrate como individual** en:
1. **Coinflow** (1-3 días aprobación)
   - Mejor para usuarios que fondean $100-500
   - Nativo Solana, mejor experiencia
   
2. **Transak** (aprobación inmediata)
   - Mejor para usuarios que fondean $10-125
   - Más métodos de pago, más países

### A largo plazo
Si el proyecto escala y procesas alto volumen:
- Considera constituir empresa
- Añade MoonPay entonces (tiene la mejor UX)
- Integra webhooks para tracking automático

---

## 💡 Tips de Implementación

### 1. Sin KYC óptimo
```
$0-125   → Transak (más métodos de pago)
$125-500 → Coinflow (límite más alto)
$500+    → Requiere KYC en ambos
```

### 2. Experiencia de usuario
- Muestra advertencia KYC antes de los límites
- Sugiere Coinflow por defecto (mejor para Solana)
- Ofrece Transak como alternativa

### 3. Tracking
Sin webhooks (URLs públicas):
- Usuario ve notificación cuando completa pago
- Wallet se fondea automáticamente
- No tracking automático en tu backend

Con webhooks (credenciales):
- Puedes mostrar historial de transacciones
- Enviar notificaciones cuando llegan fondos
- Analytics de volumen

---

## 📚 Recursos

- **Coinflow Docs:** https://docs.coinflow.cash/
- **Transak Docs:** https://docs.transak.com/
- **Solana Pay:** https://docs.solanapay.com/ (alternativa futura)

---

**Estado actual:** ✅ Implementado con Coinflow + Transak usando URLs públicas (funciona sin credenciales)


