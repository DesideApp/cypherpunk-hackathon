# 🔍 INFORME FORENSE DE ESTILOS

**Fecha**: 13/10/2025, 16:46:04
**Archivos analizados**: 25

---

## 📁 ARCHIVOS OFICIALES (Fuente de Verdad)

Estos archivos **DEBEN** contener TODAS las variables. El resto de archivos **SOLO** debe referenciarlos.

- `frontend/src/shared/utils/theme.js` → Colores, spacing, radius, fuentes
- `frontend/src/shared/styles/global.css` → CSS variables globales

---

## 🎨 COLORES HARDCODEADOS (52 únicos)

### `rgba(128, 128, 128, 0.15)` (3 usos)

- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (líneas: 55, 166)
- ✓ `frontend/src/features/messaging/ui/ContactList.css` (líneas: 54)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-128-128-128-015": "rgba(128, 128, 128, 0.15)",
```
Luego reemplazar en archivos: `var(--color-128-128-128-015)`

### `rgba(255, 48, 79, 0.5)` (3 usos)

- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (líneas: 131, 139, 147)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-255-48-79-05": "rgba(255, 48, 79, 0.5)",
```
Luego reemplazar en archivos: `var(--color-255-48-79-05)`

### `rgba(128, 128, 128, 0.25)` (2 usos)

- ✓ `frontend/src/features/messaging/ui/ContactList.css` (líneas: 19)
- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (líneas: 16)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-128-128-128-025": "rgba(128, 128, 128, 0.25)",
```
Luego reemplazar en archivos: `var(--color-128-128-128-025)`

### `rgba(128, 128, 128, 0.85)` (2 usos)

- ✓ `frontend/src/features/messaging/ui/ContactList.css` (líneas: 37)
- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (líneas: 34)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-128-128-128-085": "rgba(128, 128, 128, 0.85)",
```
Luego reemplazar en archivos: `var(--color-128-128-128-085)`

### `rgba(255, 255, 255, 0.05)` (2 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (líneas: 121, 217)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-255-255-255-005": "rgba(255, 255, 255, 0.05)",
```
Luego reemplazar en archivos: `var(--color-255-255-255-005)`

### `#16a34a` (2 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (líneas: 222, 244)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-16a34a": "#16a34a",
```
Luego reemplazar en archivos: `var(--color-16a34a)`

### `#f87171` (2 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (líneas: 226, 248)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-f87171": "#f87171",
```
Luego reemplazar en archivos: `var(--color-f87171)`

### `rgba(0,0,0,.12)` (1 usos)

- ✓ `frontend/src/features/layout/components/LeftBar.css` (líneas: 116)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-0-0-0-12": "rgba(0,0,0,.12)",
```
Luego reemplazar en archivos: `var(--color-0-0-0-12)`

### `rgba(0,0,0,.06)` (1 usos)

- ✓ `frontend/src/features/layout/components/ThemeToggle.css` (líneas: 81)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-0-0-0-06": "rgba(0,0,0,.06)",
```
Luego reemplazar en archivos: `var(--color-0-0-0-06)`

### `rgba(150, 150, 150, 1)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (líneas: 182)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-150-150-150-1": "rgba(150, 150, 150, 1)",
```
Luego reemplazar en archivos: `var(--color-150-150-150-1)`

### `#ffecec` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (líneas: 356)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-ffecec": "#ffecec",
```
Luego reemplazar en archivos: `var(--color-ffecec)`

### `rgba(0, 0, 0, 0.12)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AgreementCard.css` (líneas: 10)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-0-0-0-012": "rgba(0, 0, 0, 0.12)",
```
Luego reemplazar en archivos: `var(--color-0-0-0-012)`

### `#d9480f` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AgreementCard.css` (líneas: 87)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-d9480f": "#d9480f",
```
Luego reemplazar en archivos: `var(--color-d9480f)`

### `#0ca678` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AgreementCard.css` (líneas: 99)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-0ca678": "#0ca678",
```
Luego reemplazar en archivos: `var(--color-0ca678)`

### `rgba(16,185,129,.14)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (líneas: 73)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-16-185-129-14": "rgba(16,185,129,.14)",
```
Luego reemplazar en archivos: `var(--color-16-185-129-14)`

### `rgb(16,185,129)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (líneas: 73)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-16-185-129": "rgb(16,185,129)",
```
Luego reemplazar en archivos: `var(--color-16-185-129)`

### `rgba(16,185,129,.35)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (líneas: 73)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-16-185-129-35": "rgba(16,185,129,.35)",
```
Luego reemplazar en archivos: `var(--color-16-185-129-35)`

### `rgba(34,197,94,.14)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (líneas: 74)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-34-197-94-14": "rgba(34,197,94,.14)",
```
Luego reemplazar en archivos: `var(--color-34-197-94-14)`

### `rgb(34,197,94)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (líneas: 74)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-34-197-94": "rgb(34,197,94)",
```
Luego reemplazar en archivos: `var(--color-34-197-94)`

### `rgba(34,197,94,.35)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (líneas: 74)

**💡 ACCIÓN**: Crear variable en `theme.js`
```javascript
"--color-34-197-94-35": "rgba(34,197,94,.35)",
```
Luego reemplazar en archivos: `var(--color-34-197-94-35)`

... y 32 colores más.

---

## 📏 SPACING/PADDING HARDCODEADO (19 únicos)

### `8px` (50 usos)

- ✓ `frontend/src/features/messaging/ui/ChatWindow.css` (6 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (6 veces)
- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (5 veces)
- ... y 13 archivos más

**💡 ACCIÓN**: Crear variable `--space-sm`

### `10px` (36 usos)

- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (6 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (6 veces)
- ✓ `frontend/src/features/messaging/ui/ContactList.css` (4 veces)
- ... y 11 archivos más

**💡 ACCIÓN**: Crear variable `--space-md`

### `6px` (35 usos)

- ✓ `frontend/src/features/messaging/ui/MessageBubble.css` (4 veces)
- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (3 veces)
- ... y 13 archivos más

**💡 ACCIÓN**: Crear variable `--space-sm`

### `12px` (27 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (8 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (5 veces)
- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (3 veces)
- ... y 10 archivos más

**💡 ACCIÓN**: Crear variable `--space-md`

### `2px` (24 usos)

- ✓ `frontend/src/features/messaging/ui/MessageBubble.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/PaymentRequestCard.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/UnifiedList.css` (3 veces)
- ... y 10 archivos más

**💡 ACCIÓN**: Crear variable `--space-xs`

### `16px` (23 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (7 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (4 veces)
- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (2 veces)
- ... y 8 archivos más

**💡 ACCIÓN**: Crear variable `--space-md`

### `4px` (21 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/ChatWindow.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/AgreementCard.css` (2 veces)
- ... y 9 archivos más

**💡 ACCIÓN**: Crear variable `--space-xs`

### `14px` (13 usos)

- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (4 veces)
- ✓ `frontend/src/features/messaging/ui/AgreementCard.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/BlinkActionCard.css` (2 veces)
- ... y 4 archivos más

**💡 ACCIÓN**: Crear variable `--space-md`

### `1px` (10 usos)

- ✓ `frontend/src/features/messaging/ui/ContactRequests.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (2 veces)
- ✓ `frontend/src/features/layout/components/LeftBar.css` (1 veces)
- ... y 5 archivos más

**💡 ACCIÓN**: Crear variable `--space-xs`

### `20px` (10 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (4 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (4 veces)
- ✓ `frontend/src/features/messaging/ui/ChatMessages.css` (1 veces)
- ... y 1 archivos más

**💡 ACCIÓN**: Crear variable `--space-lg`

### `24px` (4 usos)

- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/ChatWindow.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--space-lg`

### `50px` (3 usos)

- ✓ `frontend/src/features/messaging/ui/WritingPanel.css` (3 veces)

**💡 ACCIÓN**: Crear variable `--space-2xl`

### `0px` (2 usos)

- ✓ `frontend/src/features/messaging/ui/LeftPanel.css` (2 veces)

**💡 ACCIÓN**: Crear variable `--space-xs`

### `3px` (2 usos)

- ✓ `frontend/src/features/messaging/ui/UnifiedList.css` (2 veces)

**💡 ACCIÓN**: Crear variable `--space-xs`

### `28px` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--space-xl`

... y 4 valores más.

---

## 🔲 BORDER RADIUS HARDCODEADO (12 únicos)

### `999px` (13 usos)

- ✓ `frontend/src/features/messaging/ui/ChatWindow.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (3 veces)

**💡 ACCIÓN**: Crear variable `--radius-xl`

### `10px` (13 usos)

- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (8 veces)
- ✓ `frontend/src/features/layout/components/LeftBar.css` (1 veces)
- ✓ `frontend/src/features/messaging/ui/LeftPanel.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-lg`

### `50%` (13 usos)

- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (2 veces)

**💡 ACCIÓN**: Crear variable `--radius-xl`

### `12px` (10 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css` (3 veces)
- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/PaymentRequestCard.css` (2 veces)

**💡 ACCIÓN**: Crear variable `--radius-lg`

### `8px` (9 usos)

- ✓ `frontend/src/features/messaging/ui/WritingPanel.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (2 veces)
- ✓ `frontend/src/features/layout/components/ThemeToggle.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-md`

### `16px` (8 usos)

- ✓ `frontend/src/features/messaging/ui/BlinkActionCard.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/PaymentRequestCard.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/AgreementCard.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-lg`

### `4px` (5 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (2 veces)
- ✓ `frontend/src/features/messaging/ui/ContactRequests.css` (1 veces)
- ✓ `frontend/src/features/messaging/ui/UnifiedList.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-sm`

### `6px` (4 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (1 veces)
- ✓ `frontend/src/features/messaging/ui/ChatHeader.css` (1 veces)
- ✓ `frontend/src/features/messaging/ui/ChatMessages.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-md`

### `15px` (3 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css` (1 veces)
- ✓ `frontend/src/features/messaging/ui/ContactList.css` (1 veces)
- ✓ `frontend/src/features/messaging/ui/ConversationList.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-lg`

### `14px` (1 usos)

- ✓ `frontend/src/features/layout/components/ThemeToggle.css` (1 veces)

**💡 ACCIÓN**: Crear variable `--radius-lg`

... y 2 valores más.

---

## 💫 BOX SHADOWS HARDCODEADOS (22 únicos)

### `none` (8 usos)

- ✓ `frontend/src/features/messaging/ui/PaymentRequestCard.css`
- ✓ `frontend/src/features/wallet/components/WalletBalanceWidget.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `var(--card-shadow)` (4 usos)

- ✓ `frontend/src/features/messaging/ui/UnifiedList.css`
- ✓ `frontend/src/features/messaging/ui/ChatWindow.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `var(--elevated-shadow)` (3 usos)

- ✓ `frontend/src/features/messaging/ui/ChatWindow.css`
- ✓ `frontend/src/features/messaging/ui/UnifiedList.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `0 0 5px rgba(255, 48, 79, 0.5)` (3 usos)

- ✓ `frontend/src/features/messaging/ui/ConversationList.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `0 24px 60px var(--overlay-dark-medium)` (2 usos)

- ✓ `frontend/src/features/messaging/ui/modals/BuyTokenModal.css`
- ✓ `frontend/src/features/messaging/ui/modals/FundWalletModal.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `none !important` (1 usos)

- ✓ `frontend/src/adapters/wallet-adapter/theme/globals.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `0 0 0 2px var(--focus-ring)` (1 usos)

- ✓ `frontend/src/adapters/wallet-adapter/theme/globals.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `2px 0 5px rgba(0,0,0,.12)` (1 usos)

- ✓ `frontend/src/features/layout/components/LeftBar.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `0 0 6px var(--error-color)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AddContactForm.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

### `0 16px 38px rgba(0, 0, 0, 0.12)` (1 usos)

- ✓ `frontend/src/features/messaging/ui/AgreementCard.css`

**💡 ACCIÓN**: Crear variable `--shadow-{sm|md|lg}`

---

## 🔤 TIPOGRAFÍA HARDCODEADA

### Font Families (9 únicas)

✅ `var(--font-data-family)` (11 usos)

✅ `var(--font-ui-family)` (9 usos)

✅ `var(--font-caption-family)` (9 usos)

✅ `var(--font-title-family)` (8 usos)

✅ `var(--font-body-family)` (7 usos)

✅ `var(--font-subtitle-family)` (3 usos)

✅ `var(--font-mono, monospace)` (1 usos)

✅ `var(--font-data-family, "JetBrains Mono", monospace)` (1 usos)

❌ `'SF Mono', 'Monaco', 'Courier New', monospace` (1 usos)
  - `frontend/src/features/messaging/ui/modals/FundWalletModal.css` (líneas: 72)
  **💡 ACCIÓN**: Usar `var(--font-data-family)`


### Font Sizes (30 únicos)

❌ `0.95rem` (18 usos)
  - Archivos afectados: 8
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.9rem` (17 usos)
  - Archivos afectados: 7
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.85rem` (12 usos)
  - Archivos afectados: 6
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.75rem` (10 usos)
  - Archivos afectados: 7
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.8rem` (8 usos)
  - Archivos afectados: 6
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.7rem` (7 usos)
  - Archivos afectados: 5
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.78rem` (7 usos)
  - Archivos afectados: 4
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `11px` (4 usos)
  - Archivos afectados: 4
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.65rem` (4 usos)
  - Archivos afectados: 4
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `1.1rem` (4 usos)
  - Archivos afectados: 4
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.72rem` (4 usos)
  - Archivos afectados: 3
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `1rem` (3 usos)
  - Archivos afectados: 3
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.82rem` (3 usos)
  - Archivos afectados: 2
  **💡 ACCIÓN**: Crear variable en `global.css` → `--font-xs-size`

❌ `0.92rem` (2 usos)

❌ `1.05rem` (2 usos)

... y 15 tamaños más.


### Font Weights (4 únicos)

❌ `bold` (6 usos)
  **💡 ACCIÓN**: Crear variable `--font-weight-bold`

❌ `600` (2 usos)

❌ `700` (2 usos)

❌ `650` (1 usos)


### Line Heights (7 únicos)

❌ `1` (7 usos)
  **💡 ACCIÓN**: Crear variable `--line-height-tight`

❌ `1.4` (3 usos)

❌ `1.6` (3 usos)

❌ `1.2` (2 usos)

❌ `1.5` (2 usos)

❌ `24px` (1 usos)

❌ `1.3` (1 usos)

---

## 🚀 PLAN DE ACCIÓN PRIORITARIO

### 1️⃣ CRÍTICO (Hacer YA)

- [ ] Consolidar los 5 colores más usados en `theme.js`
- [ ] Consolidar los 5 spacing más usados en `theme.js`
- [ ] Consolidar los 3 radius más usados en `theme.js`
- [ ] Unificar familias de fuente (9 diferentes → 1-2 familias)

### 2️⃣ IMPORTANTE (Próximos días)

- [ ] Revisar y unificar sombras (22 diferentes)
- [ ] Consolidar font-sizes (30 diferentes → 6-8 tamaños)
- [ ] Consolidar font-weights (4 diferentes → 3-4 pesos)
- [ ] Consolidar line-heights (7 diferentes → 3-4 valores)
- [ ] Crear sistema de design tokens completo

### 3️⃣ MEJORA (Cuando tengas tiempo)

- [ ] Documentar sistema de diseño
- [ ] Crear componentes reutilizables
- [ ] Implementar CSS-in-JS o Tailwind

---

**Generado por**: AI Style Agent
**Siguiente paso**: Ejecuta `npm run style:design` para ver propuestas de sistemas de diseño
