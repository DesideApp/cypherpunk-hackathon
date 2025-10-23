import React, { useMemo } from "react";
import { MessageCircle, ArrowLeftRight, User, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayout } from "@features/layout/contexts/LayoutContext";
import { panelEvents } from "@features/auth/ui/system/panel-bus";

import "./MobileBottomNav.css";

export default function MobileBottomNav({ onOpenSettings = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useLayout();

  const navItems = useMemo(() => {
    const base = [
      { id: "chat", icon: MessageCircle, label: "Chat", path: "/" },
      { id: "swap", icon: ArrowLeftRight, label: "Swap", action: "openSwap" },
      { id: "account", icon: User, label: "Account", action: "openAccount" },
      { id: "settings", icon: Settings, label: "Settings", action: "openSettings" },
    ];
    return base;
  }, []);

  if (!isMobile) return null;

  const handleAction = (item) => {
    if (item.path) {
      navigate(item.path);
      return;
    }

    if (item.action === "openSwap") {
      window.open("https://jup.ag/swap", "_blank", "noopener,noreferrer");
      return;
    }

    if (item.action === "openAccount") {
      panelEvents.open("menu");
      return;
    }

    if (item.action === "openSettings") {
      onOpenSettings?.();
      return;
    }
  };

  const activeId =
    navItems.find((item) => item.path && location.pathname.startsWith(item.path))?.id || "chat";

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav__item ${isActive ? "is-active" : ""}`}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            onClick={() => handleAction(item)}
          >
            <Icon size={22} />
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
