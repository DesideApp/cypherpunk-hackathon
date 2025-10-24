import { useCallback, useMemo } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { updateMyProfile } from "../services/profileService.js";
import useUserProfile from "@shared/hooks/useUserProfile.js";
import userDirectory from "@shared/services/userDirectory.js";

export function useProfile() {
  const { publicKey } = useWallet();
  const base58 = useMemo(() => {
    if (!publicKey) return null;
    return typeof publicKey === "string" ? publicKey : publicKey?.toBase58?.() || String(publicKey);
  }, [publicKey]);

  const { profile: dirProfile, loading, refetch } = useUserProfile(base58, { ensure: true });

  const profile = useMemo(() => {
    if (!base58) return null;
    const p = dirProfile || null;
    if (!p) return { nickname: "", avatar: "", pubkey: base58, social: { x: "", website: "" } };
    return {
      nickname: p.nickname || "",
      avatar: p.avatar || "",
      pubkey: p.pubkey || base58,
      social: p.social || { x: "", website: "" },
    };
  }, [base58, dirProfile]);

  const update = useCallback(async ({ nickname, avatar, social }) => {
    await updateMyProfile({ nickname, avatar, social });
    if (base58) {
      userDirectory.primeUser(base58, { nickname, avatar, social });
    }
    await refetch();
  }, [base58, refetch]);

  const refresh = useCallback(async () => { await refetch(); }, [refetch]);

  return { loading, profile, refresh, update };
}
