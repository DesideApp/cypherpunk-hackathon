import './MessageVolume.css';
import { formatBucketDuration } from '../utils/periods';

const MAX_ROWS = 30;

export default function MessageVolume({
  history,
  messagesToday,
  total,
  bucketMinutes,
  periodLabel
}) {
  if (!history.length) {
    return null;
  }

  const recentHistory = [...history]
    .slice(-MAX_ROWS)
    .reverse();

  const averagePerBucket = history.length ? Math.round(total / history.length) : 0;
  const bucketLabel = formatBucketDuration(bucketMinutes);

  return (
    <div className="message-volume">
      <div className="message-volume-header">
        <h3>Message Volume</h3>
        <span className="message-volume-total">
          Period: {periodLabel || 'Selected'}
        </span>
      </div>

      <div className="message-volume-summary">
        <div className="summary-card">
          <span className="summary-label">Total messages</span>
          <span className="summary-value">{total.toLocaleString('en-US')}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Average per {bucketLabel}</span>
          <span className="summary-value">{averagePerBucket.toLocaleString('en-US')}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Today</span>
          <span className="summary-value">{messagesToday.toLocaleString('en-US')}</span>
        </div>
      </div>

      <div className="message-volume-table-wrapper">
        <table className="message-volume-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Messages</th>
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
          <div className="message-volume-table-note">
            Showing latest {MAX_ROWS} buckets out of {history.length}.
          </div>
        )}
      </div>

      <div className="message-volume-footer">
        <span>Updated {history[history.length - 1].minutesAgo} min ago</span>
        <span>{bucketLabel} buckets: {history.length}</span>
      </div>
    </div>
  );
}
