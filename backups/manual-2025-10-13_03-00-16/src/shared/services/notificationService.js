import mitt from "mitt";
import { toast } from "react-hot-toast";

const MAX_TOASTS = 3;
const active = new Map(); // toastId -> timestamp

// Mantén el emitter para compatibilidad (si algo viejo emite, lo canalizamos a toast)
export const notificationEmitter = mitt();
notificationEmitter.on("notify", ({ message, type = "info", ...opts }) => {
  notify(message, type, opts);
});

/**
 * API única de notificaciones globales
 * - Dedup por id (por defecto: `${type}:${message}`)
 * - Límite de simultáneos (MAX_TOASTS)
 */
export function notify(message, type = "info", opts = {}) {
  const { id = `${type}:${String(message)}`, duration = 3500, style, ...rest } = opts;
  const toastOpts = { id, duration, style, ...rest };

  let tid;
  switch (type) {
    case "success":
      tid = toast.success(message, toastOpts);
      break;
    case "error":
      tid = toast.error(message, toastOpts);
      break;
    case "warning":
      // warning no existe en hot-toast; usamos neutral con borde ámbar
      tid = toast(message, {
        ...toastOpts,
        style: {
          borderLeft: "3px solid var(--warning-color, #f59e0b)",
          ...(style || {})
        }
      });
      break;
    case "loading":
      tid = toast.loading(message, { ...toastOpts, duration: Infinity });
      break;
    case "info":
    default:
      tid = toast(message, toastOpts);
      break;
  }

  active.set(tid, Date.now());

  // Enforce límite
  while (active.size > MAX_TOASTS) {
    const oldestId = [...active.entries()].sort((a, b) => a[1] - b[1])[0][0];
    toast.dismiss(oldestId);
    active.delete(oldestId);
  }

  // Limpieza tras autocierre
  if (duration !== Infinity) {
    setTimeout(() => active.delete(tid), duration + 150);
  }
  return tid;
}

notify.dismiss = (id) => (id ? toast.dismiss(id) : toast.dismiss());
notify.update = (id, next = {}) => {
  // Atajo: terminar loading -> success, etc.
  const { type = "info", message = "", ...rest } = next;
  notify.dismiss(id);
  return notify(message, type, { id, ...rest });
};

// Atajos
notify.info    = (m, o) => notify(m, "info", o);
notify.success = (m, o) => notify(m, "success", o);
notify.error   = (m, o) => notify(m, "error", o);
notify.warning = (m, o) => notify(m, "warning", o);
notify.loading = (m, o) => notify(m, "loading", o);
