import './ConnectionsOverview.css';
import { formatBucketDuration } from '../utils/periods';

const MAX_ROWS = 30;

export default function ConnectionsOverview({ summary, totals, history }) {
  if (!history.length) {
    return null;
  }

  const recentHistory = [...history]
    .slice(-MAX_ROWS)
    .reverse();
  const bucketLabel = formatBucketDuration(totals.bucketMinutes);

  return (
    <div className="connections-overview">
      <div className="connections-overview-header">
        <h3>User Connections</h3>
        <span className="connections-peak">
          Peak last period: {summary.peak.toLocaleString('en-US')}
        </span>
      </div>

      <div className="connections-stats">
        <div className="connections-stat">
          <span className="stat-label">Active now</span>
          <span className="stat-value">{summary.active.toLocaleString('en-US')}</span>
        </div>
        <div className="connections-stat">
          <span className="stat-label">New today</span>
          <span className="stat-value">{summary.newConnections.toLocaleString('en-US')}</span>
        </div>
        <div className="connections-stat">
          <span className="stat-label">Disconnected</span>
          <span className="stat-value">{summary.disconnections.toLocaleString('en-US')}</span>
        </div>
      </div>

      <div className="connections-overview-summary">
        <div className="summary-card">
          <span className="summary-label">Total interactions</span>
          <span className="summary-value">{totals.totalInteractions.toLocaleString('en-US')}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Unique participants</span>
          <span className="summary-value">{totals.uniqueParticipants.toLocaleString('en-US')}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average active</span>
          <span className="summary-value">{summary.avgActive.toLocaleString('en-US')}</span>
        </div>
      </div>

      <div className="connections-table-wrapper">
        <table className="connections-table">
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
                <td>{point.value.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length > MAX_ROWS && (
          <div className="connections-table-note">
            Showing latest {MAX_ROWS} buckets out of {history.length}.
          </div>
        )}
      </div>

      <div className="connections-footer">
        <span>Period: {totals.periodLabel || 'Selected'}</span>
        <span>
          {bucketLabel} buckets · Updated {history[history.length - 1].minutesAgo} min ago
        </span>
      </div>
    </div>
  );
}
