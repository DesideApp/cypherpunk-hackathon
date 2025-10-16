const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit'
});

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric'
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
});

const rangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const formatDateShort = (date) => dayFormatter.format(date);

const formatDateWithYear = (date) => rangeFormatter.format(date);

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday as start of week
  const start = startOfDay(date);
  start.setDate(start.getDate() - diff);
  return start;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

const addMonths = (date, months) => {
  const copy = new Date(date.getTime());
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

const formatRange = (startISO, endISO) => {
  if (!startISO || !endISO) return '';

  const start = new Date(startISO);
  const end = new Date(endISO);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

  const endInclusive = new Date(end.getTime() - 1);
  const sameDay = start.toDateString() === endInclusive.toDateString();

  if (sameDay) {
    return formatDateWithYear(start);
  }

  const sameYear = start.getFullYear() === endInclusive.getFullYear();
  const startLabel = sameYear ? formatDateShort(start) : formatDateWithYear(start);
  const endLabel = formatDateWithYear(endInclusive);

  return `${startLabel} – ${endLabel}`;
};

const formatBucketLabel = (timestamp, bucketMinutes, mode) => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  switch (mode) {
    case 'weekday':
      return weekdayFormatter.format(date);
    case 'day':
      return dayFormatter.format(date);
    default:
      return timeFormatter.format(date);
  }
};

const describeBucketDuration = (minutes) => {
  if (!minutes) return 'bucket';
  if (minutes % DAY === 0) {
    const days = minutes / DAY;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (minutes % HOUR === 0) {
    const hours = minutes / HOUR;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} min`;
};

const PERIOD_CONFIG = {
  '1h': {
    label: '1H',
    bucketMinutes: 5,
    bucketMode: 'time',
    resolveRange: (now) => ({
      rangeStart: addMinutes(now, -HOUR),
      rangeEnd: now
    })
  },
  '1d': {
    label: '24H',
    bucketMinutes: 120,
    bucketMode: 'time',
    resolveRange: (now) => {
      const rangeEnd = startOfDay(now);
      return {
        rangeStart: addMinutes(rangeEnd, -DAY),
        rangeEnd
      };
    }
  },
  '7d': {
    label: '7D',
    bucketMinutes: DAY,
    bucketMode: 'weekday',
    resolveRange: (now) => {
      const rangeEnd = startOfWeek(now);
      return {
        rangeStart: addMinutes(rangeEnd, -7 * DAY),
        rangeEnd
      };
    }
  },
  '30d': {
    label: '30D',
    bucketMinutes: DAY,
    bucketMode: 'day',
    resolveRange: (now) => {
      const rangeEnd = startOfMonth(now);
      const rangeStart = startOfMonth(addMonths(rangeEnd, -1));
      return {
        rangeStart,
        rangeEnd
      };
    }
  },
  '90d': {
    label: '90D',
    bucketMinutes: WEEK,
    bucketMode: 'weekday',
    resolveRange: (now) => {
      const rangeEnd = startOfWeek(now);
      return {
        rangeStart: addMinutes(rangeEnd, -13 * WEEK),
        rangeEnd
      };
    }
  }
};

export const PERIOD_OPTIONS = Object.entries(PERIOD_CONFIG).map(([key, config]) => ({
  key,
  label: config.label
}));

export const buildPeriodRequest = (periodKey) => {
  const now = new Date();
  const config = PERIOD_CONFIG[periodKey] || PERIOD_CONFIG['1d'];
  const { rangeStart, rangeEnd } = config.resolveRange(now);
  const params = {
    period: periodKey,
    bucketMinutes: config.bucketMinutes
  };

  if (rangeStart && rangeEnd) {
    params.rangeStart = rangeStart.toISOString();
    params.rangeEnd = rangeEnd.toISOString();
  }

  return {
    params,
    meta: {
      rangeLabel: rangeStart && rangeEnd ? formatRange(params.rangeStart, params.rangeEnd) : '',
      bucketMinutes: config.bucketMinutes,
      bucketMode: config.bucketMode
    }
  };
};

export const formatHistoryPoint = (point, meta) => {
  const bucketMinutes = meta?.bucketMinutes ?? point.bucketMinutes ?? 0;
  const bucketMode = meta?.bucketMode;
  const label = formatBucketLabel(point.timestamp ?? point.label, bucketMinutes, bucketMode);
  return {
    ...point,
    label,
    bucketMinutes
  };
};

export const formatRangeLabel = formatRange;

export const formatBucketDuration = describeBucketDuration;
