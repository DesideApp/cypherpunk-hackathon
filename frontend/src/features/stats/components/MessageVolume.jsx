import "./MessageVolume.css";
import { formatBucketDuration } from "@features/stats/utils/periods.js";

const MAX_ROWS = 30;

export default function MessageVolume({ history, messagesToday, total, bucketMinutes, periodLabel }) {
  if (!history?.length) {
    return null;
  }

  const recentHistory = [...history].slice(-MAX_ROWS).reverse();
  const averagePerBucket = history.length ? Math.round(total / history.length) : 0;
  const bucketLabel = formatBucketDuration(bucketMinutes);

  return (
    <div className="message-volume">
      <div className="message-volume__header">
        <h3>Message Volume</h3>
        <span className="message-volume__total">Period: {periodLabel || "Selected"}</span>
      </div>

      <div className="message-volume__summary">
        <SummaryCard label="Total messages" value={total} />
        <SummaryCard label={`Average per ${bucketLabel}`} value={averagePerBucket} />
        <SummaryCard label="Today" value={messagesToday} />
      </div>

        <div className="message-volume__table-wrapper">
        <table className="message-volume__table">
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
                <td>{point.value.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length > MAX_ROWS && (
          <div className="message-volume__table-note">
            Showing latest {MAX_ROWS} buckets out of {history.length}.
          </div>
        )}
      </div>

      <div className="message-volume__footer">
        <span>Updated {history[history.length - 1].minutesAgo} min ago</span>
        <span>
          {bucketLabel} buckets · {history.length}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <span className="summary-card__label">{label}</span>
      <span className="summary-card__value">{value.toLocaleString("en-US")}</span>
    </div>
  );
}
