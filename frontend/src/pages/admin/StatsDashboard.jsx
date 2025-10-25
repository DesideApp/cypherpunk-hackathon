import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import Dashboard from "@pages/admin/stats/Dashboard.jsx";
import Traffic from "@pages/admin/stats/Traffic.jsx";
import Users from "@pages/admin/stats/Users.jsx";
import Actions from "@pages/admin/stats/Actions.jsx";
import Adoption from "@pages/admin/stats/Adoption.jsx";
import Infra from "@pages/admin/stats/Infra.jsx";
import Relay from "@pages/admin/stats/Relay.jsx";
import "./StatsDashboard.css";

const TABS = [
  { key: "dashboard", label: "Dashboard", path: "dashboard" },
  { key: "traffic", label: "Traffic", path: "traffic" },
  { key: "users", label: "Users", path: "users" },
  { key: "actions", label: "Actions", path: "actions" },
  { key: "adoption", label: "Adoption", path: "adoption" },
  { key: "infra", label: "Infra", path: "infra" },
  { key: "relay", label: "Relay", path: "relay" },
];

export default function StatsDashboard() {
  const { isAdmin, isAuthenticated, isLoading } = useAuthManager();

  if (!isLoading && (!isAuthenticated || !isAdmin)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="stats-layout">
      <header className="stats-layout__header">
        <div className="stats-layout__header-inner">
          <div className="stats-layout__heading">
            <span className="stats-layout__eyebrow">Insights</span>
            <h1>Product Insights</h1>
            <p>Métricas internas de mensajería, acciones y adopción.</p>
          </div>
        </div>
      </header>

      <nav className="stats-layout__tabs">
        <div className="stats-layout__tabs-inner">
          {TABS.map((tab) => (
            <NavLink
              key={tab.key}
              to={tab.path}
              className={({ isActive }) => `stats-tab ${isActive ? "active" : ""}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="stats-layout__content">
        <div className="stats-layout__content-inner">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="traffic" element={<Traffic />} />
            <Route path="users" element={<Users />} />
            <Route path="actions" element={<Actions />} />
            <Route path="adoption" element={<Adoption />} />
            <Route path="infra" element={<Infra />} />
            <Route path="relay" element={<Relay />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
