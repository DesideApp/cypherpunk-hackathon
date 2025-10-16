import React from "react";
import { Routes, Route } from "react-router-dom";

import LeftBar from "@features/layout/components/LeftBar.jsx";
import Chat from "@pages/chat/Chat.jsx";

import "./Layout.css";

/**
 * Layout base:
 * - Grid 2 columnas: rail (LeftBar) + contenido.
 * - 1 fila: solo contenido (BottomBar eliminado).
 * - Sin lógica de gate aquí (la lleva WalletGateHost global).
 */
export default function Layout() {
  return (
    <div className="layout-wrapper">
      <LeftBar />

      <main className="layout-content">
        <Routes>
          <Route path="/" element={<Chat />} />
          {/* más rutas… */}
        </Routes>
      </main>
    </div>
  );
}
