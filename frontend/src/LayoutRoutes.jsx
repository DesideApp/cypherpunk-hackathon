import React from "react";
import { Routes, Route } from "react-router-dom";

import Chat from "@pages/chat/Chat.jsx";
import StatsDashboard from "@pages/admin/StatsDashboard.jsx";

export default function LayoutRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Chat />} />
      <Route path="/admin/stats/*" element={<StatsDashboard />} />
      {/* más rutas… */}
    </Routes>
  );
}

