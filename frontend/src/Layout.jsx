import { useLayout } from "@features/layout/contexts/LayoutContext";

import DesktopLayout from "./layout/DesktopLayout.jsx";
import MobileLayout from "./layout/MobileLayout.jsx";

export default function Layout() {
  const { isMobile } = useLayout();
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
