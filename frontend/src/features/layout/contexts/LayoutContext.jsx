import { createContext, useContext, useState, useEffect, useLayoutEffect } from "react";
import { getPreferredTheme, applyTheme } from "@shared/utils/theme.js";

const LayoutContext = createContext({
  leftbarExpanded: false,
  toggleLeftbar: () => {},
  setLeftbarExpanded: () => {},
  rightPanelOpen: false,
  toggleRightPanel: () => {},
  setRightPanelOpen: () => {},
  leftbarWidth: 0,
  headerTitleOffset: "0px",
  device: "desktop",
  isDesktop: true,
  isTablet: false,
  isMobile: false,
  theme: "light",
  toggleTheme: () => {},
});

export const LayoutProvider = ({ children }) => {
  // Leftbar state
  const [leftbarExpanded, setLeftbarExpanded] = useState(false);

  // RightPanel state
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // Device type
  const [device, setDevice] = useState("desktop");

  // Theme state
  const [theme, setTheme] = useState(() => {
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme); // Aplicar solo UNA VEZ en la inicialización
    return initialTheme;
  });

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // ELIMINADO useLayoutEffect para evitar bucle infinito

  // Update device on resize
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      if (width > 1024) {
        setDevice("desktop");
      } else if (width > 640) {
        setDevice("tablet");
      } else {
        setDevice("mobile");
      }
    };

    checkDevice();

    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  // Leftbar widths
  const collapsedWidthDesktop = 50;
  const expandedWidthDesktop = 350;

  const leftbarWidth =
    device !== "mobile"
      ? leftbarExpanded
        ? expandedWidthDesktop
        : collapsedWidthDesktop
      : 0;

  // Header Title Offset
  const collapsedOffset = "0px";
  const expandedOffset = "300px";

  const headerTitleOffset =
    device !== "mobile"
      ? leftbarExpanded
        ? expandedOffset
        : collapsedOffset
      : "0px";

  const toggleLeftbar = () => {
    setLeftbarExpanded((prev) => !prev);
  };

  const toggleRightPanel = () => {
    setRightPanelOpen((prev) => !prev);
  };

  return (
    <LayoutContext.Provider
      value={{
        leftbarExpanded,
        setLeftbarExpanded,
        toggleLeftbar,
        rightPanelOpen,
        setRightPanelOpen,
        toggleRightPanel,
        leftbarWidth,
        headerTitleOffset,
        device,
        isDesktop: device !== "mobile",
        isTablet: device === "tablet",
        isMobile: device === "mobile",
        theme,
        toggleTheme,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => useContext(LayoutContext);

export { LayoutContext };
