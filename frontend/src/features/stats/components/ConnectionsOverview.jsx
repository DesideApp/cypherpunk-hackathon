import "./ConnectionsOverview.css";
import { formatBucketDuration } from "@features/stats/utils/periods.js";

const MAX_ROWS = 30;

export default function ConnectionsOverview({ summary, totals, history }) {
  if (!history?.length) {
    return null;
  }

  const recentHistory = [...history].slice(-MAX_ROWS).reverse();
  const bucketLabel = formatBucketDuration(totals.bucketMinutes);

  return (
    <div className="connections-overview">
      <div className="connections-overview__header">
        <h3>User Connections</h3>
        <span className="connections-overview__peak">
          Peak last period: {summary.peak.toLocaleString("en-US")}
        </span>
      </div>

      <div className="connections-overview__stats">
        <Stat label="Active now" value={summary.active} />
        <Stat label="New today" value={summary.newConnections} />
        <Stat label="Disconnected" value={summary.disconnections} />
      </div>

      <div className="connections-overview__summary">
        <Summary label="Total interactions" value={totals.totalInteractions} />
        <Summary label="Unique participants" value={totals.uniqueParticipants} />
        <Summary label="Average active" value={summary.avgActive} />
      </div>

      <div className="connections-overview__table-wrapper">
        <table className="connections-overview__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Interactions</th>
            </tr>
          </thead>
          <tbody>
            {recentHistory.map((point) => (
              <tr key={point.timestamp || point.label}>
                <td>{point.label}</td>
                <td>{point.value.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length > MAX_ROWS && (
          <div className="connections-overview__table-note">
            Showing latest {MAX_ROWS} buckets out of {history.length}.
          </div>
        )}
      </div>

      <div className="connections-overview__footer">
        <span>Period: {totals.periodLabel || "Selected"}</span>
        <span>
          {bucketLabel} buckets · Updated {history[history.length - 1].minutesAgo} min ago
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="connections-stat">
      <span className="connections-stat__label">{label}</span>
      <span className="connections-stat__value">{value.toLocaleString("en-US")}</span>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="connections-summary">
      <span className="connections-summary__label">{label}</span>
      <span className="connections-summary__value">{value.toLocaleString("en-US")}</span>
    </div>
  );
}
