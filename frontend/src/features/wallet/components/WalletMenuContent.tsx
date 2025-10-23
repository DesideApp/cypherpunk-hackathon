import React, { useMemo } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useProfile } from "@features/profile/hooks/useProfile.js";
import { useSolanaBalance } from "@wallet-adapter/core/hooks/useSolanaBalance";
import ProfileSection from "@features/profile/components/ProfileSection";

type Props = { onClose?: () => void };

function WalletMenuContent({ onClose }: Props) {
  const { connected, publicKey, disconnect } = useWallet();
  const { profile, update, refresh } = useProfile();
  const balanceRaw = useSolanaBalance();

  const publicKeyStr = useMemo(() => {
    if (!publicKey) return null;
    return typeof publicKey === "string"
      ? publicKey
      : (publicKey as any)?.toBase58?.() ?? String(publicKey);
  }, [publicKey]);

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } finally {
      onClose?.();
    }
  };

  const balance = useMemo(() => {
    if (balanceRaw == null) return "0.0000";
    const s = String(balanceRaw).trim().replace(/\s*SOL$/i, "");
    const n = Number(s);
    return Number.isFinite(n) ? n.toFixed(4) : s;
  }, [balanceRaw]);

  return (
    <ProfileSection
      profile={profile}
      connected={connected}
      publicKey={publicKeyStr}
      onUpdate={update}
      onRefresh={refresh}
      balance={balance}
      onDisconnect={handleDisconnect}
      onClose={onClose}
    />
  );
}

export default WalletMenuContent;
export { WalletMenuContent };
