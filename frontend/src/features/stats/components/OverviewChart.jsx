import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatBucketDuration } from "@features/stats/utils/periods.js";
import "./OverviewChart.css";

const COLORS = {
  messages: "#8B5CF6",
  connections: "#10B981",
};

const formatNumber = (value) => {
  if (value == null) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("en-US");
};

const tooltipFormatters = {
  weekday: new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }),
  day: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }),
  time: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
};

const formatTooltipLabel = (label, payload, meta) => {
  const point = payload && payload[0]?.payload;
  const mode = meta?.bucketMode ?? "time";
  const formatter = tooltipFormatters[mode] ?? tooltipFormatters.time;
  const bucketLabel = meta?.bucketMinutes ? formatBucketDuration(meta.bucketMinutes) : null;

  if (point?.timestamp) {
    const date = new Date(point.timestamp);
    if (!Number.isNaN(date.getTime())) {
      const formatted = formatter.format(date);
      return bucketLabel ? `${formatted} · ${bucketLabel}` : formatted;
    }
  }

  return bucketLabel ? `${label} · ${bucketLabel}` : label;
};

export default function OverviewChart({ data = [], meta }) {
  if (!data.length) {
    return (
      <div className="overview-chart-empty">
        <p>No data in this period.</p>
      </div>
    );
  }

  return (
    <div className="overview-chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 8" stroke="rgba(148, 163, 184, 0.25)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--color-text-tertiary, #94a3b8)" }}
            tickMargin={10}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--color-text-tertiary, #94a3b8)" }}
            tickFormatter={formatNumber}
            width={60}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => value.toLocaleString("en-US")}
            labelFormatter={(label, payload) => formatTooltipLabel(label, payload, meta)}
            contentStyle={{
              background: "var(--color-surface, rgba(17, 24, 39, 0.9))",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              borderRadius: 12,
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="messages"
            name="Messages"
            stroke={COLORS.messages}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="connections"
            name="Connections"
            stroke={COLORS.connections}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
