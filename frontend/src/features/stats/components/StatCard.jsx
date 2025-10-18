import "./StatCard.css";

export default function StatCard({ title, value, icon, color, trend, subtitle }) {
  const trendClass = trend
    ? trend.startsWith("+")
      ? "positive"
      : trend.startsWith("-")
        ? "negative"
        : "neutral"
    : null;

  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <div className="stat-card__icon" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div className="stat-card__info">
          <h3 className="stat-card__title">{title}</h3>
          <p className="stat-card__value">{value}</p>
        </div>
      </div>

      <div className="stat-card__footer">
        {trend != null && (
          <span className={`stat-card__trend ${trendClass}`}>{trend}</span>
        )}
        <span className="stat-card__subtitle">{subtitle || "vs last period"}</span>
      </div>
    </div>
  );
}
