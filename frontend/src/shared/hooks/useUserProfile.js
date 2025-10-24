// src/shared/hooks/useUserProfile.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import userDirectory, { getUser as dirGet, fetchUser as dirFetch, subscribe as dirSubscribe } from '@shared/services/userDirectory.js';

const PUBKEY_REGEX = /^([1-9A-HJ-NP-Za-km-z]{32,44})$/;

export function useUserProfile(pubkey, options = {}) {
  const { ensure = true } = options || {};

  const key = useMemo(() => {
    const k = typeof pubkey === 'string' ? pubkey.trim() : pubkey || null;
    if (!k || !PUBKEY_REGEX.test(String(k))) return null;
    return String(k);
  }, [pubkey]);

  const [profile, setProfile] = useState(() => (key ? dirGet(key) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Suscripción a cambios en el directorio
  useEffect(() => {
    if (!key) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return () => {};
    }
    setProfile(dirGet(key));
    const unsub = dirSubscribe(key, (data) => {
      setProfile(data || null);
    });
    return unsub;
  }, [key]);

  const fetch = useCallback(async (force = false) => {
    if (!key) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await dirFetch(key, { force });
      setProfile(res || null);
      return res;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [key]);

  // Carga inicial si ensure=true
  useEffect(() => {
    if (!key) return;
    if (!ensure) return;
    if (!dirGet(key)) {
      void fetch(false);
    }
  }, [key, ensure, fetch]);

  const refetch = useCallback(() => fetch(true), [fetch]);

  return { profile, loading, error, refetch };
}

export default useUserProfile;

