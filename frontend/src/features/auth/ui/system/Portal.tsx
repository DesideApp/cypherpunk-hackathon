import { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  /** id de contenedor en DOM para reusar si existe */
  containerId?: string;
}

// Singleton root + ref-count para evitar overlays huérfanos
let ROOT: HTMLElement | null = null;
let REFCOUNT = 0;

function ensureRoot(): HTMLElement {
  if (ROOT && document.body.contains(ROOT)) return ROOT;

  const existing = document.getElementById('wallet-sdk-portal') as HTMLElement | null;
  const el = existing ?? document.createElement('div');

  el.setAttribute('id', 'wallet-sdk-portal');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = '100vw';
  el.style.height = '100vh';
  el.style.zIndex = '99999'; // por encima de todo
  el.style.pointerEvents = 'none'; // por defecto no bloquea el fondo

  if (!existing) document.body.appendChild(el);
  ROOT = el;
  return el;
}

export const Portal = ({ children }: PortalProps) => {
  const containerRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    containerRef.current = ensureRoot();
    REFCOUNT += 1;
    setMounted(true);

    return () => {
      REFCOUNT -= 1;
      if (REFCOUNT <= 0 && containerRef.current?.parentElement) {
        containerRef.current.parentElement.removeChild(containerRef.current);
        ROOT = null;
        REFCOUNT = 0;
      }
    };
  }, []);

  return mounted && containerRef.current
    ? createPortal(<div style={{ pointerEvents: 'auto' }}>{children}</div>, containerRef.current)
    : null;
};

export default Portal;
