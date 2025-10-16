import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/traffic', label: 'Traffic', icon: '🚦' },
    { path: '/users', label: 'Users', icon: '👥' },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Admin Panel</h2>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="main-header">
          <button 
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1>Admin Panel</h1>
          <div className="header-actions">
            <span className="status-indicator">🟢 Online</span>
          </div>
        </header>
        
        <main className="main-body">
          {children}
        </main>
      </div>
    </div>
  );
}
