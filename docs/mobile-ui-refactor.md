# Mobile UI Refactor Checklist

Date: 2025-01-20  
Branch: `feature/mobile-responsive-refactor`

## High-Level Changes

- **Parallel structure**  
  Desktop y mobile comparten la misma jerarquía base (`Chat.jsx` → `ChatWindow`/`LeftPanel`), pero ahora existen wrappers específicos:
  - **Desktop**: `DesktopLayout` → `DesktopMessagingLayout` → (`LeftPanel`, `ChatWindow` en arreglo)  
  - **Mobile**: `MobileLayout` → `MobileMessagingLayout` (decide `list` | `chat`) →  
    - `MobileConversationList` → `LeftPanel` (`left-panel--mobile`)  
    - `MobileChatScreen` → `ChatWindow` (`chat-window--mobile`)
  Cada wrapper sólo aplica estilos/modo; la lógica compartida (hooks, store) vive en los componentes originales para evitar duplicidad.

- **Layout split**: `Layout.jsx` now routes through `DesktopLayout` or `MobileLayout`. The mobile shell reserves space for the bottom nav and listens to `mobile:view-change` events to hide/show it.
- **Chat routing**: `Chat.jsx` chooses between `DesktopMessagingLayout` and `MobileMessagingLayout`. The latter manages the list/chat stack and dispatches `view` updates.

## Conversation List (`LeftPanel` / `UnifiedList`)

- `LeftPanel` adds `left-panel--mobile` to enable mobile-only styles.
- `UnifiedList` now accepts `mode` (`desktop` | `mobile`), rendering BEM-style classes (`unified-list--mobile`, etc.) for phone-friendly sizing.
- Mobile scale targets:
  - Header: 72 px tall, action icons 44 px, title 23 px.
  - Search bar: 56 px, font 16.5 px, icon 20 px.
  - Filter chips: 38 px height, font 14 px.
  - Conversation rows: min-height ≈70 px, avatar 44 px, title 16.2 px, preview 13.6 px.
- Scroll is confined to `.unified-list`, not the entire panel.

## Bottom Navigation (`MobileBottomNav`)

- New component acts as the global nav in mobile.  
  Tabs: Chat, Swap (external link), Account, Settings.  
  Stats tab only appears on desktop/for admins.
- Styling: rounded 60 px bar with blur + safe-area padding. Hidden automatically when `view === "chat"`.

## Chat Header (`ChatHeader`)

- Mobile header mirrors list dimensions: 64 px, avatar 40 px, buttons 46 px, name font 16.5 px.
- Back/menu buttons conditionally rendered (`allowMobileMenu` flag in `ChatWindow`).

## Chat Body (`ChatWindow` / `ChatMessages`)

- `.chat-window--mobile` removes global padding and aligns message columns with 18 px gutters.
- `ChatMessages` reserves ~96 px bottom padding (now 88 px) for composer overlap but avoids extra side gutters.

## Composer & Actions (`WritingPanel` + `ActionBar`)

- Mobile action bar no longer sits in a separate shell.  
  `WritingPanel` renders `writing-panel-actions` above the input when `mode="mobile"`.
- `ActionBar` supports `mode` prop: desktop shows the full set; mobile shows `Send`, `Request`, and `More`.
- The `More` button opens a small bottom sheet listing the remaining actions (Buy, Fund, Agreement, etc.).
- Writing panel adjustments:
  - Full-width input row (radius 26 px).
  - Emoji picker, clear button, and send button aligned inside the same block (`send-button` 46 px).
  - Reduced safe-area padding (`calc(8px + inset)`).

## pendientes / backlog

- **Mobile bottom nav actions**  
  - Hoy el tab `Swap` abre jup.ag en una pestaña externa. Si queremos repetir el flujo inline (Jupiter plugin) habrá que exponer la lógica del `LeftBar` dentro de un modal móvil.
  - `Account`/`Settings` siguen usando los paneles actuales (bus `panelEvents`). Conviene revisar si necesitamos versiones móviles simplificadas.

- **Tablet breakpoint**  
  - No hay modo “tablet”; actualmente cualquier ancho ≤640 usa el layout móvil. Definir si 641–960 debe comportarse como desktop, mobile, o un híbrido.

- **Animation/gesture polish**  
  - `MobileMessagingLayout` podría añadir animaciones (slide) cuando se cambia de lista a chat, además de gestos “swipe-to-back”.
  - Integrar `edge-to-edge` en iOS (usar `env(safe-area-inset-*)` en header y composer).

- **Accessibility & QA**  
  - Verificar `aria` en la hoja `ActionBar` móvil (el sheet usa botón con `role="menuitem"`, but we should confirm focus trapping).
  - Tests manuales en navegadores móviles reales (Safari iOS, Chrome/Android) con teclado on-screen para asegurar que las reservas de padding son suficientes.

- **Theming**  
  - Revisión de colores en modo claro (aún no se ha validado).  
  - Evaluar si necesitamos variantes dark/light para la bottom nav y el sheet de acciones.

## View-State Wiring

- `MobileMessagingLayout` emits `mobile:view-change` events (`list` | `chat`) to inform the layout shell when to hide the bottom nav.
- `WritingPanel` accepts `mobileActionBarProps` to receive action handlers from `ChatWindow`.

## Implementation Notes

- All desktop styling remains untouched; mobile overrides are scoped via `mode` props or `.chat-window--mobile`, `.left-panel--mobile`, etc.
- Existing lint errors in unrelated modules (legacy hooks, tests) were observed but unaffected.
- Further refinements (animations, tablet breakpoints) can extend the same pattern by adding new `mode` values or media queries.
