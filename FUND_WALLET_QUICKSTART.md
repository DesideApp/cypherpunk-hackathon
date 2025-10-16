# 🚀 Quick Start: Fund Wallet (Sin KYC)

Nueva funcionalidad para que los usuarios fondeen sus wallets directamente sin KYC!

## ✨ Lo que se añadió

1. **Nuevo botón "Fund"** en la barra de acciones (entre Buy y Agreement)
2. **Modal FundWalletModal** con dos proveedores:
   - 💎 **Coinflow** (sin KYC hasta ~$500) - Nativo Solana
   - 🌍 **Transak** (sin KYC hasta ~$125) - Global
3. **Opciones rápidas**: $50, $100, $200, $500, o monto personalizado
4. **UI moderna** integrada con la estética de la app
5. **URLs públicas**: ✨ **Funciona SIN credenciales YA MISMO**

## 🎯 Cómo funciona

```
Usuario → Clic en "Fund" → Selecciona monto → Elige proveedor → 
Se abre MoonPay/Coinflow → Usuario paga con tarjeta → SOL llega a wallet
```

## 📦 Archivos modificados/creados

```
frontend/src/features/messaging/ui/
├── ActionBar.jsx                     ← Añadido botón "Fund"
├── ChatWindow.jsx                    ← Añadido handler y modal
└── modals/
    ├── FundWalletModal.jsx          ← NUEVO componente
    └── FundWalletModal.css          ← NUEVO estilos

docs/
└── FUND_WALLET_SETUP.md             ← NUEVA documentación completa

frontend/
└── .env.example                     ← NUEVO template de variables
```

## ⚡ Setup Rápido (¡Ya funciona!)

### 🎉 ¡NO necesitas configurar NADA!

El botón **"Fund" ya funciona** con URLs públicas. Solo:

1. **Abre la app**
2. **Ve a cualquier conversación**
3. **Haz clic en "Fund"** (entre Buy y Agreement)
4. **¡Prueba el flujo!** - Se abrirá Coinflow o Transak

### 🔧 Opcional: Añadir credenciales (para branding personalizado)

Si más adelante quieres customizar:

```bash
# frontend/.env (OPCIONAL)
VITE_COINFLOW_MERCHANT_ID=tu_merchant_id
VITE_TRANSAK_API_KEY=tu_api_key
```

Pero **NO es necesario** para que funcione.

## 🔑 Obtener API Keys reales

### MoonPay (Recomendado para empezar)

1. Ve a https://dashboard.moonpay.com/
2. Regístrate como desarrollador (gratis)
3. En Dashboard → Settings → API Keys
4. Copia tu **Publishable Key** (comienza con `pk_test_`)
5. Añádela al `.env` como `VITE_MOONPAY_API_KEY`

**Tiempo:** ~5 minutos

### Coinflow (Optimizado para Solana)

1. Ve a https://merchant.coinflow.cash/
2. Regístrate como merchant
3. Completa el onboarding básico
4. Copia tu **Merchant ID**
5. Añádelo al `.env` como `VITE_COINFLOW_MERCHANT_ID`

**Tiempo:** ~10 minutos + aprobación (1-2 días)

## 💰 Límites sin KYC

| Proveedor | Límite | Comisión | Requiere credenciales | Mejor para |
|-----------|--------|----------|----------------------|------------|
| **Coinflow** | **~$500** | ~2.5% | ❌ No | Solana nativo |
| **Transak** | ~$125 | ~3.5% | ❌ No | Global/Múltiples métodos |

Si el usuario intenta fondear más del límite, verá una advertencia automática.

## 🎨 UI/UX

- **Responsive**: Funciona en móvil y desktop
- **Dark mode**: Integrado con el tema existente
- **Feedback claro**: Notificaciones de estado
- **Advertencias**: Avisa cuando se requiere KYC
- **Sin fricción**: Se abre en nueva pestaña, no interrumpe el chat

## 🧪 Testing (funciona YA)

✅ **Sin configuración:**
1. El botón "Fund" funciona con URLs públicas
2. Abre Coinflow/Transak directamente
3. El usuario puede completar el pago real

✅ **Con credenciales (opcional):**
- Mejor branding personalizado
- Webhooks para confirmar transacciones
- Analytics y reportes

## 📋 Próximos pasos opcionales

- [ ] Añadir más proveedores (Transak, Ramp)
- [ ] Webhook para confirmar cuando llegan fondos
- [ ] Historial de transacciones
- [ ] Integración directa con Solana Pay

## 🐛 ¿Problemas?

### No veo el botón "Fund"
→ Verifica que el servidor esté corriendo: `npm run dev`

### "Proveedor no configurado"
→ Añade las variables de entorno y reinicia el servidor

### El popup se bloquea
→ Permite popups en tu navegador para localhost

### Otra cosa no funciona
→ Revisa la documentación completa en `docs/FUND_WALLET_SETUP.md`

## 📚 Documentación completa

Ver: `docs/FUND_WALLET_SETUP.md` para más detalles técnicos.

---

**¡Disfruta de la nueva funcionalidad! 🎉**

