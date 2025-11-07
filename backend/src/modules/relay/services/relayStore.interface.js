// src/modules/relay/services/relayStore.interface.js
//
// Esta interfaz define las operaciones mínimas que debe exponer cualquier
// implementación de almacenamiento para la relay (Mongo, Dynamo, etc.).
// La iremos usando en los controladores a medida que refactoricemos el flujo.

/**
 * @typedef {Object} RelayReserveInput
 * @property {import('mongoose').ClientSession=} session     Sesión opcional (Mongo) para transacciones.
 * @property {string} messageId                             UUID del mensaje (idempotente).
 * @property {string} to                                    Wallet destino.
 * @property {string} from                                  Wallet remitente.
 * @property {string} box                                   Payload cifrado (base64).
 * @property {number} boxSize                               Tamaño del campo `box` en bytes.
 * @property {string=} iv                                   IV opcional del cifrado.
 * @property {string} messageType                           Tipo lógico (text, agreement, etc.).
 * @property {Record<string, unknown>=} meta                 Metadatos normalizados (ver docs/relay/module.md).
 * @property {number=} ttlSeconds                           Override puntual de TTL.
 */

/**
 * @typedef {Object} RelayReserveResult
 * @property {boolean} created            true si el mensaje no existía.
 * @property {number} previousBoxSize     Tamaño anterior (0 si nuevo).
 * @property {Date} createdAt             Timestamp de creación (para history).
 * @property {Date} updatedAt             Timestamp tras el upsert.
 */

/**
 * @typedef {Object} RelayMessageDoc
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {string} box
 * @property {number} boxSize
 * @property {string=} iv
 * @property {string} messageType
 * @property {Record<string, unknown>=} meta
 * @property {{ createdAt: Date, enqueuedAt?: Date, deliveredAt?: Date|null, acknowledgedAt?: Date|null }} timestamps
 * @property {'pending'|'delivered'|'acknowledged'|'failed'} status
 */

/**
 * @typedef {Object} RelayAckResult
 * @property {number} totalBytes     Bytes liberados por los mensajes acked.
 * @property {number} deletedCount   Número de documentos eliminados.
 */

/**
 * @typedef {Object} RelayPurgeResult
 * @property {number} deleted
 * @property {number} freedBytes
 */

/**
 * Interfaz base para cualquier store de relay.
 * Implementaciones concretas deben proporcionar todos los métodos.
 *
 * @interface
 */
export class RelayStore {
  /**
   * Busca un mensaje por ID.
   * @param {string} _id
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<RelayMessageDoc|null>}
   */
  // eslint-disable-next-line class-methods-use-this
  async findById(_id, _session) {
    throw new Error('findById not implemented');
  }

  /**
   * Busca un mensaje por acuerdo/metadatos.
   * @param {string} _wallet
   * @param {string} _agreementId
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<RelayMessageDoc|null>}
   */
  // eslint-disable-next-line class-methods-use-this
  async findByAgreement(_wallet, _agreementId, _session) {
    throw new Error('findByAgreement not implemented');
  }

  /**
   * Obtiene múltiples mensajes por ID (limitado a un destinatario).
   * @param {string} _wallet
   * @param {string[]} _ids
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<RelayMessageDoc[]>}
   */
  // eslint-disable-next-line class-methods-use-this
  async findManyByIds(_wallet, _ids, _session) {
    throw new Error('findManyByIds not implemented');
  }

  /**
   * Upsert idempotente de un mensaje, reservando espacio para la cuota.
   * @param {RelayReserveInput} _input
   * @returns {Promise<RelayReserveResult>}
   */
  // eslint-disable-next-line class-methods-use-this
  async reserveAndUpsert(_input) {
    throw new Error('reserveAndUpsert not implemented');
  }

  /**
   * Obtiene mensajes ordenados para un destinatario (FIFO).
   * @param {string} _wallet
   * @param {{ limit?: number, session?: import('mongoose').ClientSession }=} _options
   * @returns {Promise<RelayMessageDoc[]>}
   */
  // eslint-disable-next-line class-methods-use-this
  async fetchMessages(_wallet, _options) {
    throw new Error('fetchMessages not implemented');
  }

  /**
   * Marca mensajes como entregados (sin eliminarlos).
   * @param {string} _wallet
   * @param {string[]} _ids
   * @param {import('mongoose').ClientSession=} _session
   */
  // eslint-disable-next-line class-methods-use-this
  async markDelivered(_wallet, _ids, _session) {
    throw new Error('markDelivered not implemented');
  }

  /**
   * Confirma (ack) y elimina mensajes, devolviendo bytes liberados.
   * @param {string} _wallet
   * @param {string[]} _ids
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<RelayAckResult>}
   */
  // eslint-disable-next-line class-methods-use-this
  async ackMessages(_wallet, _ids, _session) {
    throw new Error('ackMessages not implemented');
  }

  /**
   * Purga todos los mensajes del buzón.
   * @param {string} _wallet
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<RelayPurgeResult>}
   */
  // eslint-disable-next-line class-methods-use-this
  async purgeMailbox(_wallet, _session) {
    throw new Error('purgeMailbox not implemented');
  }

  /**
   * Purga la fracción solicitada (mensajes más antiguos).
   * @param {string} _wallet
   * @param {number} _fraction
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<RelayPurgeResult>}
   */
  // eslint-disable-next-line class-methods-use-this
  async purgeMailboxFraction(_wallet, _fraction, _session) {
    throw new Error('purgeMailboxFraction not implemented');
  }

  /**
   * Recalcula el uso real (sum boxSize) y lo devuelve.
   * @param {string} _wallet
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<number>}
   */
  // eslint-disable-next-line class-methods-use-this
  async recalcUsage(_wallet, _session) {
    throw new Error('recalcUsage not implemented');
  }

  /**
   * Lista IDs pendientes (útil para sockets).
   * @param {string} _wallet
   * @returns {Promise<string[]>}
   */
  // eslint-disable-next-line class-methods-use-this
  async listPendingIds(_wallet) {
    throw new Error('listPendingIds not implemented');
  }

  /**
   * Obtiene estadísticas de mensajes que expiran antes de un threshold.
   * @param {string} _wallet
   * @param {Date} _threshold
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<{ count: number, bytes: number }>}
   */
  // eslint-disable-next-line class-methods-use-this
  async countExpired(_wallet, _threshold, _session) {
    throw new Error('countExpired not implemented');
  }

  /**
   * Elimina mensajes expirados y devuelve métricas.
   * @param {string} _wallet
   * @param {Date} _threshold
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<{ deleted: number, freedBytes: number }>}
   */
  // eslint-disable-next-line class-methods-use-this
  async deleteExpired(_wallet, _threshold, _session) {
    throw new Error('deleteExpired not implemented');
  }

  /**
   * Devuelve snapshot de buzón (conteo y bytes totales).
   * @param {string} _wallet
   * @param {import('mongoose').ClientSession=} _session
   * @returns {Promise<{ count: number, bytes: number }>}
   */
  // eslint-disable-next-line class-methods-use-this
  async mailboxSnapshot(_wallet, _session) {
    throw new Error('mailboxSnapshot not implemented');
  }
}

export default RelayStore;
