import { Counter, Gauge } from 'prom-client';

export const vaultUploadAttempts = new Counter({
  name: 'vault_upload_attempts_total',
  help: 'Intentos de generar carga de adjuntos en el Attachment Vault',
});

export const vaultUploadSuccess = new Counter({
  name: 'vault_upload_success_total',
  help: 'Adjuntos subidos correctamente al Attachment Vault',
  labelNames: ['wallet'],
});

export const vaultUploadFailure = new Counter({
  name: 'vault_upload_failure_total',
  help: 'Fallos al generar subida de adjuntos al Attachment Vault',
  labelNames: ['reason'],
});

export const vaultPurgeCounter = new Counter({
  name: 'vault_purge_total',
  help: 'Adjuntos purgados del Attachment Vault',
  labelNames: ['reason'],
});

export const vaultUsageGauge = new Gauge({
  name: 'vault_usage_bytes',
  help: 'Uso actual del Attachment Vault por wallet',
  labelNames: ['wallet'],
});

export default {
  vaultUploadAttempts,
  vaultUploadSuccess,
  vaultUploadFailure,
  vaultPurgeCounter,
  vaultUsageGauge,
};
