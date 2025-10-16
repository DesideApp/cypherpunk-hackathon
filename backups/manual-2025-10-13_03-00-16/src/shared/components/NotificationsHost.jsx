import React from "react";
import { Toaster } from "react-hot-toast";

/**
 * Host único de toasts globales (sistema/wallet/etc.)
 * - bottom-right, compacto, coherente con el tema
 * - z-index alto para sobrepasar overlays
 */
export default function NotificationsHost() {
  return (
    <Toaster
      position="bottom-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          background: "var(--window-background)",
          color: "var(--text-primary)",
          boxShadow: "var(--window-shadow)",
          borderRadius: "10px",
          padding: "10px 12px",
          fontFamily:
            "var(--font-ui-family, system-ui, -apple-system, Segoe UI, Roboto)",
          fontSize: "14px",
          minHeight: "40px",
          maxWidth: "360px",
        },
        success: { style: { borderLeft: "3px solid #2ecc71" } },
        error:   { style: { borderLeft: "3px solid var(--action-color, #f44336)" } },
        // “loading” mejora el contraste del spinner
        loading: { style: { opacity: 0.95 } },
      }}
      containerStyle={{
        bottom: 12,
        right: 12,
        zIndex: 120000,
      }}
    />
  );
}
