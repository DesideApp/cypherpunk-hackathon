import { useState, useEffect, useCallback, useRef } from "react";
import { sendContactRequest, approveContact, rejectContact } from "../services/contactService";
import { notify } from "@shared/services/notificationService.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { getUpdatedContacts } from "../services/contactsUpdater.js";
import {
  loadContactsCache,
  saveContactsCache,
  clearContactsCache,
} from "@features/contacts/services/contactsCache.js";
import { DEMO_CONTACTS_STATE } from "@features/contacts/services/demoContacts.js";
import { IS_DEMO } from "@shared/config/env.js";

const EMPTY_CONTACTS = { confirmed: [], pending: [], incoming: [] };

const getInitialState = () => {
  if (!IS_DEMO) return EMPTY_CONTACTS;
  const cached = loadContactsCache();
  if (cached) return cached;
  return DEMO_CONTACTS_STATE;
};

export default function useContactManager() {
  const initialState = getInitialState();
  const [confirmedContacts, setConfirmedContacts] = useState(initialState.confirmed);
  const [pendingRequests, setPendingRequests] = useState(initialState.pending);
  const [receivedRequests, setReceivedRequests] = useState(initialState.incoming);

  const { ensureReady, isAuthenticated, isLoading: authLoading } = useAuthManager();
  const isUpdating = useRef(false);

  const applyContactsState = useCallback((nextState, persist = true) => {
    const { confirmed = [], pending = [], incoming = [] } = nextState || EMPTY_CONTACTS;
    setConfirmedContacts(confirmed);
    setPendingRequests(pending);
    setReceivedRequests(incoming);
    if (persist && IS_DEMO) {
      saveContactsCache({ confirmed, pending, incoming });
    }
  }, []);

  // 🔹 Resetear el estado completo
  const resetContactsState = useCallback(() => {
    applyContactsState(IS_DEMO ? DEMO_CONTACTS_STATE : EMPTY_CONTACTS, IS_DEMO);
    if (IS_DEMO) clearContactsCache();
  }, [applyContactsState]);

  // 🔹 Cargar contactos desde backend (sin ensureReady)
  const updateContactsState = useCallback(async () => {
    if (isUpdating.current) return;
    isUpdating.current = true;

    try {
      const { confirmed = [], pending = [], incoming = [] } = await getUpdatedContacts();
      applyContactsState({ confirmed, pending, incoming }, true);
    } catch (error) {
      console.error("❌ Error al actualizar contactos:", error);
      notify("❌ Error al actualizar contactos.", "error");
    } finally {
      isUpdating.current = false;
    }
  }, [applyContactsState]);

  // 🔹 Carga inicial solo si está autenticado (sin pedir firma)
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      updateContactsState();
      return;
    }

    if (!IS_DEMO) {
      applyContactsState(EMPTY_CONTACTS, false);
      return;
    }

    const cached = loadContactsCache();
    if (cached) {
      applyContactsState(cached, false);
      return;
    }

    applyContactsState(DEMO_CONTACTS_STATE, false);
  }, [isAuthenticated, authLoading, updateContactsState, applyContactsState]);

  // 🔹 Carga manual protegida (cuando el usuario lo pide)
  const loadContacts = useCallback(async () => {
    try {
      const ok = await ensureReady(updateContactsState);
      if (!ok) {
        applyContactsState(IS_DEMO ? DEMO_CONTACTS_STATE : EMPTY_CONTACTS, false);
      }
    } catch {
      applyContactsState(IS_DEMO ? DEMO_CONTACTS_STATE : EMPTY_CONTACTS, false);
    }
  }, [ensureReady, updateContactsState, applyContactsState]);

  // 🔹 Agregar contacto
  const handleAddContact = useCallback(
    async (wallet) => {
      const ok = await ensureReady(async () => {
        await sendContactRequest(wallet);
        await updateContactsState();
      }, true);

      if (!ok) {
        notify("❌ No se pudo enviar la solicitud de contacto.", "error");
      }
    },
    [ensureReady, updateContactsState]
  );

  // 🔹 Aceptar solicitud
  const handleAcceptRequest = useCallback(
    async (wallet) => {
      const ok = await ensureReady(async () => {
        await approveContact(wallet);
        await updateContactsState();
      }, true);

      if (!ok) {
        notify("❌ No se pudo aceptar la solicitud.", "error");
      }
    },
    [ensureReady, updateContactsState]
  );

  // 🔹 Rechazar solicitud
  const handleRejectRequest = useCallback(
    async (wallet) => {
      const ok = await ensureReady(async () => {
        await rejectContact(wallet);
        await updateContactsState();
      }, true);

      if (!ok) {
        notify("❌ No se pudo rechazar la solicitud.", "error");
      }
    },
    [ensureReady, updateContactsState]
  );

  return {
    confirmedContacts,
    pendingRequests,
    receivedRequests,
    handleAddContact,
    handleAcceptRequest,
    handleRejectRequest,
    loadContacts,
    resetContactsState,
  };
}
