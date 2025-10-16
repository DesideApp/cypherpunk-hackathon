import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { searchUserByPubkey } from "@features/contacts/services/userService.js";
import { updateMyProfile } from "../services/profileService.js";

export function useProfile() {
  const { publicKey } = useWallet();
  const base58 = useMemo(() => {
    if (!publicKey) return null;
    return typeof publicKey === "string" ? publicKey : publicKey?.toBase58?.() || String(publicKey);
  }, [publicKey]);

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  const refresh = useCallback(async () => {
    if (!base58) return;
    setLoading(true);
    try {
      const r = await searchUserByPubkey(base58);
      if (!r?.error && r?.registered) {
        setProfile({
          nickname: r.nickname || "",
          avatar: r.avatar || "",
          pubkey: r.pubkey,
          social: r.social || { x: "", website: "" },
        });
      } else {
        setProfile({ nickname: "", avatar: "", pubkey: base58, social: { x: "", website: "" } });
      }
    } finally {
      setLoading(false);
    }
  }, [base58]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = useCallback(async ({ nickname, avatar, social, signature, message }) => {
    await updateMyProfile({ nickname, avatar, social, signature, message });
    await refresh();
  }, [refresh]);

  return { loading, profile, refresh, update };
}
