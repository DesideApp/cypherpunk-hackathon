// src/modules/relay/services/relayStoreProvider.js
//
// Pequeño contenedor para registrar y obtener la instancia activa del RelayStore.
// Por defecto se inicializa con la implementación Mongo; los tests o futuros
// backends pueden llamar a `setRelayStore` para inyectar otra implementación.

import MongoRelayStore from './mongoRelayStore.js';

let currentStore = null;

export function getRelayStore() {
  if (!currentStore) {
    currentStore = new MongoRelayStore();
  }
  return currentStore;
}

export function setRelayStore(store) {
  currentStore = store;
}

export default {
  getRelayStore,
  setRelayStore,
};
