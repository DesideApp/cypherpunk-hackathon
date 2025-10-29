import { Counter, Histogram, Gauge } from 'prom-client';

export const relayReserveCounter = new Counter({
  name: 'relay_store_reserve_total',
  help: 'Mensajes encolados en relay',
});

export const relayReserveBytesCounter = new Counter({
  name: 'relay_store_reserve_bytes',
  help: 'Bytes encolados en relay',
});

export const relayRejectionCounter = new Counter({
  name: 'relay_store_rejections_total',
  help: 'Rechazos al intentar encolar en relay',
  labelNames: ['reason'],
});

export const relayFetchCounter = new Counter({
  name: 'relay_store_fetch_total',
  help: 'Fetchs realizados por clientes relay',
});

export const relayFetchLatency = new Histogram({
  name: 'relay_store_fetch_latency_ms',
  help: 'Latencia desde enqueue hasta fetch',
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
});

export const relayAckLatency = new Histogram({
  name: 'relay_store_ack_latency_ms',
  help: 'Latencia desde entrega hasta ack',
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
});

export const relayMailboxUsageGauge = new Gauge({
  name: 'relay_store_mailbox_usage_bytes',
  help: 'Uso actual por buzón relay',
  labelNames: ['wallet'],
});

export const relayHistoryDriftGauge = new Gauge({
  name: 'relay_history_drift_total',
  help: 'Conteo de mensajes en relay sin counterpart en history',
});

export const relayHistoryRepairCounter = new Counter({
  name: 'relay_history_repaired_total',
  help: 'Mensajes reparados (insertados en history) durante la reconciliación',
});

export const relayHistoryDriftHistoryGauge = new Gauge({
  name: 'relay_history_drift_missing_relay',
  help: 'Conteo de mensajes en history que no tienen mensaje en relay',
});

export function observeFetchLatency(msg, deliveredAt) {
  if (!msg?.timestamps?.enqueuedAt) return;
  const enqueued = new Date(msg.timestamps.enqueuedAt).getTime();
  const delivered = deliveredAt?.getTime?.() ?? Date.now();
  if (Number.isFinite(enqueued) && enqueued > 0) {
    relayFetchLatency.observe(delivered - enqueued);
  }
}

export function observeAckLatency(msg, acknowledgedAt) {
  const delivered = msg?.timestamps?.deliveredAt ? new Date(msg.timestamps.deliveredAt).getTime() : null;
  const acked = acknowledgedAt?.getTime?.() ?? Date.now();
  if (delivered && Number.isFinite(delivered)) {
    relayAckLatency.observe(Math.max(0, acked - delivered));
  }
}

export default {
  relayReserveCounter,
  relayReserveBytesCounter,
  relayRejectionCounter,
  relayFetchCounter,
  relayFetchLatency,
  relayAckLatency,
  relayMailboxUsageGauge,
  observeFetchLatency,
  observeAckLatency,
};
