import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const formatNumber = (value) => {
  if (value == null) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString('en-US');
};

export default function InfraChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="overview-chart-empty">
        <p>No data in this period.</p>
      </div>
    );
  }

  const prepared = data.map((d) => ({
    label: new Date(d.timestamp).toLocaleString(),
    count: d.count,
    errorRate: d.errorRate,
  }));

  return (
    <div className="overview-chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={prepared} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 8" stroke="rgba(148, 163, 184, 0.25)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
          <YAxis yAxisId="left" tickFormatter={formatNumber} width={60} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" width={60} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(value, name) => [name === 'errorRate' ? `${value}%` : value.toLocaleString('en-US'), name]} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="count" name="Requests" stroke="#8B5CF6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
          <Line yAxisId="right" type="monotone" dataKey="errorRate" name="Error rate" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

