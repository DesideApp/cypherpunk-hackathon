# Shared UI primitives

Este paquete agrupa componentes base y estilos globales que leen **exclusivamente** de las variables definidas en `shared/utils/theme.js` y en `public/styles/global.css`. La idea es que cualquier modal, tarjeta o botón reutilice estos bloques sin duplicar CSS.

Incluye por ahora:

- `ModalShell`: overlay + panel + header/body/footer.
- `UiButton`: botón con variantes `primary`, `secondary`, `ghost` y `danger`.
- `UiChip`: chip seleccionable reutilizable.
- `UiCard`: contenedor elevado básico.
- `ui.css`: hoja de estilos global que define clases `.ui-*`.

### Cómo usar

```jsx
import { ModalShell, UiButton, UiChip, UiCard } from "@shared/ui";

function DemoModal({ open, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Demo"
      footer={(
        <>
          <UiButton variant="secondary" onClick={onClose}>Cancelar</UiButton>
          <UiButton>Confirmar</UiButton>
        </>
      )}
    >
      <UiCard>
        <UiChip selected>Opción A</UiChip>
      </UiCard>
    </ModalShell>
  );
}
```

### Próximos pasos

1. Migrar modales y tarjetas existentes para usar estas primitives.
2. Sustituir gradualmente valores mágicos (espaciado, bordes, colores) por las variables base.
3. Ampliar el set con layouts (`UiStack`) o formularios cuando se necesite.

> Nota: **no** se han tocado variables o valores hardcodeados existentes todavía; el objetivo de esta fase es sólo tener la estructura común lista. Cuando migres componentes, ajusta valores si hace falta.
