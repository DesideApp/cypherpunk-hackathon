// Encapsula emisiones WebSocket para el flujo DM-first
import { DMEvents } from "#modules/contacts/contact.constants.js";

const DM_LEGACY_EVENTS_ENABLED = String(process.env.DM_LEGACY_EVENTS_ENABLED ?? 'false').toLowerCase() === 'true';

let ioRef = null;

export function setDMIO(io) {
  ioRef = io;
}

function _toWalletRoom(wallet) {
  // En vuestro ws registráis la wallet/room con "register_wallet"
  // Aquí simplemente usamos la wallet como sala.
  return wallet;
}

export function emitDMRequest(targetWallet, payload) {
  if (!ioRef) return;
  ioRef.to(_toWalletRoom(targetWallet)).emit(DMEvents.REQUEST, payload);
  if (DM_LEGACY_EVENTS_ENABLED) {
    ioRef.to(_toWalletRoom(targetWallet)).emit("contact_request", payload);
  }
}

export function emitDMAccepted(targetWallet, payload) {
  if (!ioRef) return;
  ioRef.to(_toWalletRoom(targetWallet)).emit(DMEvents.ACCEPTED, payload);
  if (DM_LEGACY_EVENTS_ENABLED) {
    ioRef.to(_toWalletRoom(targetWallet)).emit("contact_accepted", payload);
  }
}

export function emitDMRejected(targetWallet, payload) {
  if (!ioRef) return;
  ioRef.to(_toWalletRoom(targetWallet)).emit(DMEvents.REJECTED, payload);
  if (DM_LEGACY_EVENTS_ENABLED) {
    ioRef.to(_toWalletRoom(targetWallet)).emit("contact_removed", payload);
  }
}

export function emitDMCanceled(targetWallet, payload) {
  if (!ioRef) return;
  ioRef.to(_toWalletRoom(targetWallet)).emit(DMEvents.CANCELED, payload);
}

export function emitDMBlocked(targetWallet, payload) {
  if (!ioRef) return;
  ioRef.to(_toWalletRoom(targetWallet)).emit(DMEvents.BLOCKED, payload);
  if (DM_LEGACY_EVENTS_ENABLED) {
    ioRef.to(_toWalletRoom(targetWallet)).emit("contact_blocked", payload);
  }
}

export function emitDMUnblocked(targetWallet, payload) {
  if (!ioRef) return;
  ioRef.to(_toWalletRoom(targetWallet)).emit(DMEvents.UNBLOCKED, payload);
  if (DM_LEGACY_EVENTS_ENABLED) {
    ioRef.to(_toWalletRoom(targetWallet)).emit("contact_unblocked", payload);
  }
}
