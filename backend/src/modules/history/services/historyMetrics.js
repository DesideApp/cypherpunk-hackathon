import { Counter } from 'prom-client';

export const historyMessagesWrittenCounter = new Counter({
  name: 'history_messages_written_total',
  help: 'Mensajes registrados en history',
  labelNames: ['source'],
});

export const historyMessagesDuplicateCounter = new Counter({
  name: 'history_messages_duplicate_total',
  help: 'Mensajes ignorados por idempotencia (ya existentes)',
  labelNames: ['source'],
});

export const historyMessagesFailedCounter = new Counter({
  name: 'history_messages_failed_total',
  help: 'Errores al persistir mensajes en history',
  labelNames: ['source', 'reason'],
});

export function recordMessageWritten(source = 'relay') {
  historyMessagesWrittenCounter.inc({ source });
}

export function recordMessageDuplicate(source = 'relay') {
  historyMessagesDuplicateCounter.inc({ source });
}

export function recordMessageFailed(source = 'relay', reason = 'unknown') {
  historyMessagesFailedCounter.inc({ source, reason });
}

export default {
  historyMessagesWrittenCounter,
  historyMessagesDuplicateCounter,
  historyMessagesFailedCounter,
  recordMessageWritten,
  recordMessageDuplicate,
  recordMessageFailed,
};

