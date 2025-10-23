# Shared UI primitives

Colección de bloques reutilizables que comparten tokens de `shared/utils/theme.js` y las variables globales del frontend. Sirven para construir, sin duplicar estilos, todo lo que se repite en la app (botones, modales, burbujas de mensajes, etc.).

## Qué hay disponible

- **Primitives base**
  - `ModalShell`: estructura de modal (overlay + panel + header/body/footer) con tamaños `md` y `lg`.
  - `UiButton`, `UiChip`, `UiCard`, `UiSelectionCard`, `UiSearchInput`: controles atómicos que ya respetan la tipografía y espaciados del tema.
  - `ui.css`: utilidades `.ui-*` (layout, typographic tweaks) que se cargan automáticamente al importar el paquete.

- **Action modals (WIP)**
  - `actionmodals.css` define las clases comunes para los modales de “Send / Request / Agreement / Fund / Buy”.
  - Carpeta `action-modals/` incluye wrappers listos (`ActionModalCard`, `ActionModalTokenHeader`, `ActionModalIdentity*`, `ActionModalHint`, etc.) que aplican esas clases y exponen helpers para los estilos dinámicos.
  - `ActionButtons.jsx` provee la botonera redondeada heredada de Buy (cancel/back/primary). Sigue usando estilos inline hasta que movamos esa lógica a la CSS.

- **Bubbles para mensajes**
  - Carpeta `bubbles/` (`ActionBubbleShell.jsx`, `ActionCardBase.jsx`, `bubbles.css`) que encapsula cómo se ve una tarjeta de acción dentro del chat. Úsalo cuando renderices contenido enriquecido como previews o acuerdos dentro de las conversaciones.

## Cómo se importa

```jsx
import {
  ModalShell,
  UiButton,
  UiChip,
  ActionButtons,
} from "@shared/ui";
```

Todas las hojas de estilos necesarias (`ui.css`, `actionmodals.css`) se cargan en la exportación principal, por lo que no es necesario importarlas manualmente.

## Próximo trabajo

- Crear wrappers React (`ActionModalCard`, `ActionModalTokenHeader`, etc.) que apliquen las clases de `actionmodals.css` para dejar de duplicar markup en los features.
- Sustituir los estilos inline de `ActionButtons.jsx` por clases dentro de la CSS compartida.
- Documentar en `docs/ui-action-modals.md` el roadmap completo de los modales de acción (flow, tokens dinámicos, presets) y mantener sincronizadas las primitives con Buy/Request.
