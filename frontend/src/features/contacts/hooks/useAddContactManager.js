import { useState, useEffect, useCallback, useRef } from "react";
import { sendContactRequest } from "../services/contactService.js";
import userDirectory from "@shared/services/userDirectory.js";
import { notify } from "@shared/services/notificationService.js";
import { useAuthManager } from "@features/auth/hooks/useAuthManager.js";
import { getUpdatedContacts } from "../services/contactsUpdater.js";

export default function useAddContactManager(onContactAdded) {
  const [pubkey, setPubkey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sentRequests, setSentRequests] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef(null);
  const isUpdating = useRef(false);

  const { ensureReady, isAuthenticated, isLoading: authLoading } = useAuthManager();

  const isValidPubkey = /^([1-9A-HJ-NP-Za-km-z]{32,44})$/.test(pubkey.trim());

  // 🔹 Ajuste dinámico del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "50px";
      if (textareaRef.current.scrollHeight > textareaRef.current.clientHeight) {
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  }, [pubkey]);

  const clearInput = () => setPubkey("");

  // 🔹 Cargar solicitudes pendientes (sin ensureReady)
  const loadSentRequests = useCallback(async () => {
    if (isUpdating.current) return;
    isUpdating.current = true;

    try {
      const { pending } = await getUpdatedContacts();
      setSentRequests(pending || []);
    } catch (error) {
      setSentRequests([]);
      console.error("❌ Error cargando solicitudes enviadas:", error);
    } finally {
      isUpdating.current = false;
    }
  }, []);

  // ✅ Cargar automáticamente al montar SOLO si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      // 🔹 No pedimos ensureReady porque no debe firmar ni renovar tokens solo por montar
      loadSentRequests();
    }
  }, [isAuthenticated, authLoading, loadSentRequests]);

  // 🔹 Enviar solicitud de contacto (sí usa ensureReady)
  const handleAddContact = useCallback(async () => {
    const trimmedPubkey = pubkey.trim();

    if (!isValidPubkey) {
      notify("❌ Public key inválida.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const ready = await ensureReady(async () => {
        const result = await userDirectory.fetchUser(trimmedPubkey, { force: true });

        if (result.error) return notify(result.message, "error");
        if (!result.registered)
          return notify("⚠️ Esta wallet no está registrada en Deside.", "warning");
        if (result.relationship === "confirmed")
          return notify("⚠️ Este usuario ya es tu contacto.", "info");
        if (result.relationship === "pending")
          return notify("⚠️ Ya tienes una solicitud pendiente con este usuario.", "info");
        if (result.blocked)
          return notify("⚠️ Este usuario está bloqueado.", "error");

        notify(
          result.nickname
            ? `✅ Usuario encontrado: ${result.nickname}`
            : "✅ Usuario encontrado.",
          "success"
        );

        // 🔹 Enviar solicitud y actualizar la lista
        await sendContactRequest(trimmedPubkey);
        // Refrescar relación/estado post-request
        try { await userDirectory.fetchUser(trimmedPubkey, { force: true }); } catch {}
        notify("✅ Solicitud enviada correctamente.", "success");
        setPubkey("");

        if (onContactAdded) onContactAdded();

        await loadSentRequests(); // Actualizar lista de solicitudes
      }, true);

      if (!ready) {
        console.warn("⚠️ No se pudo completar handleAddContact porque no está ready");
      }
    } catch (error) {
      console.error("❌ Error enviando solicitud:", error);
      notify("❌ Error enviando solicitud.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [pubkey, isValidPubkey, onContactAdded, ensureReady, loadSentRequests]);

  return {
    pubkey,
    setPubkey,
    isValidPubkey,
    isLoading,
    textareaRef,
    handleAddContact,
    loadSentRequests,
    sentRequests,
    isExpanded,
    setIsExpanded,
    clearInput,
  };
}
