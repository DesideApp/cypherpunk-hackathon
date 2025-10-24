# Shared UI primitives

Colección de bloques reutilizables que comparten tokens de `shared/utils/theme.js` y las variables globales del frontend. Sirven para construir, sin duplicar estilos, todo lo que se repite en la app (botones, modales, burbujas de mensajes, etc.).

## Qué hay disponible

- **Primitives base**
  - `ModalShell`: estructura de modal (overlay + panel + header/body/footer) con tamaños `md` y `lg`.
  - `UiButton`, `UiChip`, `UiCard`, `UiSelectionCard`, `UiSearchInput`: controles atómicos que ya respetan la tipografía y espaciados del tema.
  - `ui.css`: utilidades `.ui-*` (layout, typographic tweaks) que se cargan automáticamente al importar el paquete.

- **Action modals (primitive-based)**
  - `actionmodals.css` define las clases comunes para los modales de "Send / Request / Agreement / Fund / Buy".
  - Carpeta `action-modals/` incluye wrappers React listos para usar:
    - **Layout**: `ActionModalCard`, `ActionModalCustomRow`, `ActionModalHint`
    - **Token display**: `ActionModalTokenHeader` (logo + nombre + conversión USD)
    - **Identity**: `ActionModalIdentity`, `ActionModalIdentityFlow` (flujo visual con flechas)
    - **Inputs**: `ActionModalField`, `ActionModalInput`, `ActionModalSelect`, `ActionModalTextarea`, `ActionModalNoteInput`
    - **Controls**: `ActionModalPresetAmounts` (botones rápidos), `ActionModalToggle` (radiogroup)
    - **Styles**: `useActionModalStyles` (hook para estilos dinámicos por token)
  - `ActionButtons.jsx` provee la botonera redondeada heredada de Buy (cancel/back/primary).

- **Bubbles para mensajes**
  - Carpeta `bubbles/` (`ActionBubbleShell.jsx`, `ActionCardBase.jsx`, `bubbles.css`) que encapsula cómo se ve una tarjeta de acción dentro del chat. Úsalo cuando renderices contenido enriquecido como previews o acuerdos dentro de las conversaciones.

## Cómo se importa

```jsx
import {
  ModalShell,
  UiButton,
  UiChip,
  ActionButtons,
  // Action modals primitives
  ActionModalCard,
  ActionModalTokenHeader,
  ActionModalIdentityFlow,
  ActionModalPresetAmounts,
  ActionModalCustomRow,
  ActionModalField,
  ActionModalInput,
  ActionModalSelect,
  ActionModalTextarea,
  ActionModalNoteInput,
  ActionModalToggle,
  ActionModalHint,
} from "@shared/ui";
```

Todas las hojas de estilos necesarias (`ui.css`, `actionmodals.css`) se cargan en la exportación principal, por lo que no es necesario importarlas manualmente.

## Uso básico

### Ejemplo: Modal de Request usando primitives

```jsx
import {
  ModalShell,
  ActionModalCard,
  ActionModalTokenHeader,
  ActionModalIdentityFlow,
  ActionModalPresetAmounts,
  ActionModalCustomRow,
  ActionModalNoteInput,
  ActionModalHint,
} from "@shared/ui";

function RequestModal({ token, meta, amount, ... }) {
  return (
    <ModalShell title="Request payment" footer={footer}>
      <ActionModalCard meta={meta}>
        <ActionModalTokenHeader
          meta={meta}
          token={token}
          conversionPrimary="≈ $50 USD"
          conversionSecondary={`Requesting ${amount} ${token}`}
        />
        
        <ActionModalIdentityFlow
          direction="incoming"
          left={{ title: "You" }}
          right={{ title: "Contact", subtitle: "0x1234..." }}
        />
        
        <ActionModalHint>
          Your contact will review and approve the request.
        </ActionModalHint>
      </ActionModalCard>

      <ActionModalPresetAmounts
        amounts={[0.001, 0.1, 1]}
        selected={amount}
        onSelect={setAmount}
      />

      <ActionModalCustomRow
        left={<input type="number" />}
        right={<ActionModalNoteInput placeholder="Add note" />}
      />
    </ModalShell>
  );
}
```

## Próximo trabajo

- ✅ Primitives creados y funcionando
- ✅ RequestModal migrado a primitives
- ⏳ Migrar SendModal, AgreementModal, FundModal, SettlementModal
- ⏳ Refactorizar BuyTokenModal para usar primitives
- Documentar en `docs/ui-action-modals.md` el roadmap completo de los modales de acción (flow, tokens dinámicos, presets) y mantener sincronizadas las primitives con Buy/Request.
