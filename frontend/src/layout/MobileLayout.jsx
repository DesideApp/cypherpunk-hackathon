import React, { useCallback, useEffect, useState } from "react";

import LayoutRoutes from "../LayoutRoutes.jsx";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import MobileBottomNav from "@features/layout/components/MobileBottomNav.jsx";
import MobileSettingsSheet from "@features/layout/components/MobileSettingsSheet.jsx";

import "../Layout.css";

export default function MobileLayout() {
  const { leftbarExpanded, setLeftbarExpanded } = useLayout();
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      setShowBottomNav(event?.detail !== "chat");
    };
    window.addEventListener("mobile:view-change", handler);
    return () => window.removeEventListener("mobile:view-change", handler);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    if (leftbarExpanded) {
      setLeftbarExpanded(false);
    }
  }, [leftbarExpanded, setLeftbarExpanded]);

  return (
    <div className={`layout-mobile ${showBottomNav ? "" : "nav-hidden"}`}>
      <main className="layout-mobile-content">
        <LayoutRoutes />
      </main>

      {showBottomNav && (
        <MobileBottomNav onOpenSettings={() => setShowSettings(true)} />
      )}

      {leftbarExpanded && (
        <button
          type="button"
          className="leftbar-overlay"
          aria-label="Close navigation"
          onClick={handleCloseDrawer}
        />
      )}
      <MobileSettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
