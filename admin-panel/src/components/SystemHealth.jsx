import './SystemHealth.css';

export default function SystemHealth({ systemLoad, errorRate }) {
  const getLoadStatus = (load) => {
    if (load < 50) return { label: 'Excellent', className: 'excellent', color: '#4CAF50' };
    if (load < 80) return { label: 'Moderate', className: 'moderate', color: '#FF9800' };
    return { label: 'Critical', className: 'critical', color: '#F44336' };
  };

  const getErrorStatus = (rate) => {
    if (rate < 1) return { label: 'Low', className: 'low', color: '#4CAF50' };
    if (rate < 3) return { label: 'Medium', className: 'medium', color: '#FF9800' };
    return { label: 'High', className: 'high', color: '#F44336' };
  };

  const loadStatus = getLoadStatus(systemLoad);
  const errorStatus = getErrorStatus(errorRate);

  return (
    <div className="system-health">
      <h3>System Health</h3>
      
      <div className="health-metrics">
        <div className="health-metric">
          <div className="metric-header">
            <span className="metric-label">System Load</span>
            <span className="metric-value">{systemLoad.toFixed(1)}%</span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill"
              style={{ 
                width: `${systemLoad}%`,
                backgroundColor: loadStatus.color
              }}
            ></div>
          </div>
          <span className={`metric-status ${loadStatus.className}`}>
            {loadStatus.label}
          </span>
        </div>

        <div className="health-metric">
          <div className="metric-header">
            <span className="metric-label">Error Rate</span>
            <span className="metric-value">{errorRate.toFixed(1)}%</span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill"
              style={{ 
                width: `${Math.min(errorRate * 20, 100)}%`,
                backgroundColor: errorStatus.color
              }}
            ></div>
          </div>
          <span className={`metric-status ${errorStatus.className}`}>
            {errorStatus.label}
          </span>
        </div>
      </div>

      <div className="health-summary">
        <div className="summary-item">
          <span className="summary-icon">🟢</span>
          <span className="summary-text">Server Online</span>
        </div>
        <div className="summary-item">
          <span className="summary-icon">📡</span>
          <span className="summary-text">API Responding</span>
        </div>
        <div className="summary-item">
          <span className="summary-icon">💾</span>
          <span className="summary-text">Database OK</span>
        </div>
      </div>
    </div>
  );
}
