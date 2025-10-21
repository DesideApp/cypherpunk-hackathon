import React from "react";
import { useLayout } from "@features/layout/contexts/LayoutContext";

import DesktopMessagingLayout from "./DesktopMessagingLayout.jsx";
import MobileMessagingLayout from "./mobile/MobileMessagingLayout.jsx";

import "./Chat.css";

export default function Chat() {
  const { isMobile } = useLayout();
  return isMobile ? <MobileMessagingLayout /> : <DesktopMessagingLayout />;
}

