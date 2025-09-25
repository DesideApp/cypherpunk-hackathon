import { useState, useEffect, useCallback, useRef } from "react";
import { sendContactRequest, approveContact, rejectContact } from "../services/contactService";
import { notify } from "@shared/services/notificationService.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { getUpdatedContacts } from "../services/contactsUpdater.js";

export default function useContactManager() {
  const [confirmedContacts, setConfirmedContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);

  const { ensureReady, isAuthenticated, isLoading: authLoading } = useAuthManager();
  const isUpdating = useRef(false);

  // 🔹 Resetear el estado completo
  const resetContactsState = useCallback(() => {
    setConfirmedContacts([]);
    setPendingRequests([]);
    setReceivedRequests([]);
  }, []);

  // 🔹 Cargar contactos desde backend (sin ensureReady)
  const updateContactsState = useCallback(async () => {
    if (isUpdating.current) return;
    isUpdating.current = true;

    try {
      const { confirmed, pending, incoming } = await getUpdatedContacts();
      setConfirmedContacts(confirmed || []);
      setPendingRequests(pending || []);
      setReceivedRequests(incoming || []);
    } catch (error) {
      console.error("❌ Error al actualizar contactos:", error);
      notify("❌ Error al actualizar contactos.", "error");
    } finally {
      isUpdating.current = false;
    }
  }, []);

  // 🔹 Carga inicial solo si está autenticado (sin pedir firma)
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      updateContactsState(); // 🔹 No usamos ensureReady
    } else if (!isAuthenticated) {
      resetContactsState();
    }
  }, [isAuthenticated, authLoading, updateContactsState, resetContactsState]);

  // 🔹 Carga manual protegida (cuando el usuario lo pide)
  const loadContacts = useCallback(async () => {
    try {
      const ok = await ensureReady(updateContactsState);
      if (!ok) resetContactsState();
    } catch {
      resetContactsState();
    }
  }, [ensureReady, updateContactsState, resetContactsState]);

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
