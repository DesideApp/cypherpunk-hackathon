import { useMemo } from "react";

/**
 * Conversaciones derivadas sólo del estado en memoria.
 * En esta versión sin backups devolvemos lista vacía y helpers no-op.
 */
export default function useConversationManager() {
  const conversations = useMemo(() => [], []);
  const refreshConversations = () => Promise.resolve([]);

  return {
    conversations,
    loading: false,
    error: null,
    refreshConversations,
  };
}
