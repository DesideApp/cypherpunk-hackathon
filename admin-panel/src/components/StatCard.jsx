import './StatCard.css';

export default function StatCard({ title, value, icon, color, trend, subtitle }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-icon" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div className="stat-info">
          <h3 className="stat-title">{title}</h3>
          <p className="stat-value">{value}</p>
        </div>
      </div>
      
      <div className="stat-footer">
        {trend != null && (
          <span className={`stat-trend ${trend.startsWith('+') ? 'positive' : trend.startsWith('-') ? 'negative' : 'neutral'}`}>
            {trend}
          </span>
        )}
        <span className="stat-period">{subtitle || 'vs last hour'}</span>
      </div>
    </div>
  );
}
