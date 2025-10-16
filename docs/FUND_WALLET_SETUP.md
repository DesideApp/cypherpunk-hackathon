# Configuración de Fund Wallet (Sin KYC)

Esta funcionalidad permite a los usuarios fondear sus wallets directamente desde la aplicación sin necesidad de KYC (hasta ciertos límites).

## 🎯 Proveedores Integrados

### 1. MoonPay
- **Sin KYC hasta:** ~$150 USD (varía por región)
- **Website:** https://www.moonpay.com
- **Métodos de pago:** Tarjetas de crédito/débito, Apple Pay, Google Pay

### 2. Coinflow
- **Sin KYC hasta:** ~$500 USD
- **Website:** https://www.coinflow.cash
- **Específico para:** Solana
- **Métodos de pago:** Tarjetas de crédito/débito

## 🔑 Obtener API Keys

### MoonPay

1. Regístrate en [MoonPay Dashboard](https://dashboard.moonpay.com/)
2. Crea una nueva cuenta de desarrollador
3. En el dashboard, ve a **Settings** → **API Keys**
4. Copia tu **Publishable API Key** (comienza con `pk_live_` o `pk_test_`)
5. Añade la clave a tu archivo `.env`:
   ```bash
   VITE_MOONPAY_API_KEY=pk_test_tu_clave_aqui
   ```

**Notas:**
- En modo sandbox/test, usa la clave `pk_test_`
- En producción, usa `pk_live_`
- Las claves de test no requieren verificación completa

### Coinflow

1. Regístrate en [Coinflow Merchant Dashboard](https://merchant.coinflow.cash/)
2. Completa el proceso de onboarding básico
3. En el dashboard, copia tu **Merchant ID**
4. Añade el ID a tu archivo `.env`:
   ```bash
   VITE_COINFLOW_MERCHANT_ID=tu_merchant_id_aqui
   ```

**Notas:**
- Coinflow está optimizado para Solana
- Proceso de aprobación rápido (1-2 días)
- Soporta mainnet y devnet

## 📝 Variables de Entorno

Crea o actualiza tu archivo `.env` en la raíz del proyecto con:

```bash
# MoonPay (Opcional)
VITE_MOONPAY_API_KEY=pk_test_your_key_here

# Coinflow (Opcional)
VITE_COINFLOW_MERCHANT_ID=your_merchant_id_here
```

**Importante:** 
- Las variables deben empezar con `VITE_` para ser accesibles en el frontend
- Al menos una de las dos debe estar configurada
- Si falta la clave, el proveedor no aparecerá como opción

## 🚀 Uso

1. El usuario hace clic en el botón **"Fund"** en la barra de acciones del chat
2. Se abre un modal con opciones de monto ($50, $100, $200, $500, o personalizado)
3. El usuario selecciona un proveedor (MoonPay o Coinflow)
4. Se abre el proveedor en una nueva ventana con la wallet pre-configurada
5. El usuario completa el pago
6. Los fondos llegan automáticamente a su wallet (5-15 minutos)

## 🔒 Límites Sin KYC

| Proveedor | Límite Sin KYC | Métodos de Pago | Regiones |
|-----------|----------------|-----------------|----------|
| MoonPay   | ~$150 USD      | Tarjeta, Apple Pay | Global (varía) |
| Coinflow  | ~$500 USD      | Tarjeta          | USA, Europa |

**Nota:** Los límites varían según la región y pueden cambiar. Para montos mayores, los proveedores solicitarán KYC automáticamente.

## 🛠️ Desarrollo Local

Para probar en desarrollo sin API keys reales:

1. Usa las claves de prueba proporcionadas por los proveedores
2. MoonPay ofrece un modo sandbox con claves de test
3. Los enlaces se abrirán pero no procesarán pagos reales

## 📋 Checklist de Implementación

- [x] Botón "Fund" añadido al ActionBar
- [x] Modal FundWalletModal creado
- [x] Integración con MoonPay
- [x] Integración con Coinflow
- [x] Estilos CSS responsive
- [ ] Añadir variables de entorno a `.env`
- [ ] Obtener API keys de proveedores
- [ ] Testear en mainnet

## 🐛 Troubleshooting

### El botón "Fund" no aparece
- Verifica que hayas importado correctamente los componentes en `ChatWindow.jsx`

### "Proveedor no configurado"
- Asegúrate de que las variables de entorno estén definidas
- Verifica que empiecen con `VITE_`
- Reinicia el servidor de desarrollo después de añadir variables

### El popup se bloquea
- Los navegadores pueden bloquear popups
- Pide al usuario que permita popups desde tu dominio

## 🔗 Enlaces Útiles

- [MoonPay Documentation](https://docs.moonpay.com/)
- [Coinflow Documentation](https://docs.coinflow.cash/)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)

## 💡 Próximas Mejoras

- [ ] Añadir más proveedores (Transak, Ramp)
- [ ] Webhook para confirmar transacciones
- [ ] Historial de fondeos
- [ ] Notificaciones cuando llegan fondos
- [ ] Integración con Solana Pay



