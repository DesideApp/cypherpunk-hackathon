# UI Action Modals

Plan para consolidar los modales de acciones (Send, Request, Agreement, Fund, Buy) sobre primitives reutilizables. La carpeta `shared/ui/action-modals/` ya contiene los wrappers base; falta migrar los features para usarlos.

## Foto actual

- `RequestModal` replica la tarjeta Blink de Buy (token header, flujo A↔B, presets) usando directamente las clases de `shared/ui/actionmodals.css`.
- `SendModal`, `AgreementModal`, `FundWalletModal`, `SettlementModal` mezclan primitives (`ModalShell`, `UiButton/UiChip`) con markup legacy.
- `BuyTokenModal` mantiene su propio flujo de pasos y la tarjeta `buy-selected-card`, con CSS localizada en el feature.
- `ActionButtons.jsx` expone la botonera redonda, pero mantiene estilos inline.
- No existen componentes en `shared/ui` que envuelvan las clases `.action-modal-*`.

## Objetivo

Extraer componentes React reusables que cubran las piezas repetidas, de modo que los modales de features sólo definan el contenido específico (copys, handlers). Los estilos seguirán centralizados en `shared/ui/actionmodals.css`.

## Primitives disponibles

1. **`ActionModalCard`**
   - Envuelve `action-modal-card` y acepta metadata del token (tint, glow, background, iconScale) para setear las CSS vars automáticamente mediante `useActionModalStyles`.

2. **`ActionModalTokenHeader`**
   - Renderiza logo/token/conversión y aplica las clases `action-modal-token-*`. Acepta fallback emoji o imagen.

3. **`ActionModalIdentity` / `ActionModalIdentityFlow`**
   - Cubren el bloque “usuario A ⇄ usuario B”, con placeholders `skeleton` incluidos.

4. **Helpers de cantidad**
   - `ActionModalPresetAmounts` replica la parrilla de presets (0.001 / 0.1 / 1) con callback `onSelect`.
   - `ActionModalCustomRow` envuelve la fila Custom+Note, permitiendo pasar nodos personalizados.
   - `ActionModalHint` centraliza el texto auxiliar dentro de la tarjeta.

5. **Hook utilitario**
   - `useActionModalStyles(meta)` devuelve `{ cardStyle, logoStyle, logoInnerStyle, icon }`.

6. **Botonera**
   - `ActionButtons.jsx` sigue disponible con los estilos inline originales. Pendiente moverlos a la CSS.

## Orden propuesto de trabajo

1. Migrar `RequestModal` para consumir las primitives (`ActionModalCard`, `ActionModalTokenHeader`, `ActionModalIdentityFlow`, etc.), eliminando estilos inline.
2. Repetir con `SendModal`, `AgreementModal`, `FundWalletModal` y `SettlementModal`.
3. Evaluar si `BuyTokenModal` puede adoptar alguno de los helpers sin romper su flujo por pasos.

## Notas adicionales

- Mantener los valores mágicos sólo en la CSS; los componentes deberían limitase a recibir props semánticas.
- Cuando se expongan nuevas primitives, actualiza `shared/ui/index.js` y añade ejemplos breves al README.
- Revisar el viejo `UiActionCard` para rescatar ideas (chips, quote, stats) que puedan integrarse de forma progresiva.
