// src/wallet-adapter/ui/system/panel-bus.ts
export type PanelMode = 'connect' | 'menu';
type OpenDetail = { mode: PanelMode };

const OPEN = 'wa:panel/open';
const CLOSE = 'wa:panel/close';

const isDev =
  typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export const panelEvents = {
  /**
   * Abre el overlay correspondiente.
   * Pasa siempre un modo explícito. Si falta, se usa 'connect' y se avisa en dev.
   */
  open(mode?: PanelMode) {
    if (typeof window === 'undefined') return;
    const effective: PanelMode = mode ?? 'connect';
    if (isDev && mode == null) {
      // Deprecation guard: no usar open() sin mode
      console.warn(
        '[panelEvents] open() sin "mode" está deprecado; usando mode="connect" por defecto.'
      );
    }
    if (isDev) console.debug('[panelEvents] open()', { mode: effective });
    window.dispatchEvent(
      new CustomEvent<OpenDetail>(OPEN, { detail: { mode: effective } })
    );
  },

  /** Cierra el overlay que corresponda (Shell o Panel). */
  close() {
    if (typeof window === 'undefined') return;
    if (isDev) console.debug('[panelEvents] close()');
    window.dispatchEvent(new Event(CLOSE));
  },

  /** Suscribe a aperturas. Devuelve un unsubscribe. */
  onOpen(cb: (detail: OpenDetail) => void) {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenDetail>).detail;
      // Defensa: garantizar siempre un mode válido hacia el consumidor
      cb({ mode: detail?.mode ?? 'connect' });
    };
    window.addEventListener(OPEN, handler);
    return () => window.removeEventListener(OPEN, handler);
  },

  /** Suscribe a cierres. Devuelve un unsubscribe. */
  onClose(cb: () => void) {
    const handler = () => cb();
    window.addEventListener(CLOSE, handler);
    return () => window.removeEventListener(CLOSE, handler);
  },
};

// Exports legacy/constantes (por si tienes imports existentes)
export const PANEL_OPEN_EVENT = OPEN;
export const PANEL_CLOSE_EVENT = CLOSE;
