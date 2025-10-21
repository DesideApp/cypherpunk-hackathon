import React, { useCallback } from "react";

import LeftBar from "@features/layout/components/LeftBar.jsx";
import LayoutRoutes from "../LayoutRoutes.jsx";
import { useLayout } from "@features/layout/contexts/LayoutContext";

import "../Layout.css";

export default function DesktopLayout() {
  const { leftbarExpanded, setLeftbarExpanded } = useLayout();

  const handleCloseDrawer = useCallback(() => {
    if (leftbarExpanded) {
      setLeftbarExpanded(false);
    }
  }, [leftbarExpanded, setLeftbarExpanded]);

  return (
    <div className="layout-wrapper">
      <LeftBar />

      {/* Desktop no utiliza overlay, pero mantenemos botón oculto para accesibilidad */}
      {false && (
        <button
          type="button"
          className="leftbar-overlay"
          aria-label="Close navigation"
          onClick={handleCloseDrawer}
        />
      )}

      <main className="layout-content">
        <LayoutRoutes />
      </main>
    </div>
  );
}

