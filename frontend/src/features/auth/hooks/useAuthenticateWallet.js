// src/hooks/useAuthenticateWallet.js
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { authenticateWithServer, getNonceFromServer } from "@shared/services/apiService";
import { storeCSRFToken, storeWalletSignature } from "@shared/services/tokenService";
import bs58 from "bs58";

export const useAuthenticateWallet = () => {
  const { publicKey, signMessage } = useWallet();

  const authenticateWallet = async () => {
    const pubkeyStr =
      typeof publicKey === "string"
        ? publicKey
        : (publicKey?.toBase58?.() ?? publicKey?.toString?.() ?? String(publicKey || ""));

    if (!pubkeyStr) {
      console.warn("[AuthService] ❌ No hay wallet conectada");
      return { pubkey: null, status: "no_wallet_connected" };
    }

    try {
      // 1) Nonce
      const { nonce, error: nonceError } = await getNonceFromServer();
      if (!nonce || nonceError) {
        console.warn("[AuthService] ❌ No se pudo obtener nonce:", nonceError);
        return { pubkey: null, status: "nonce_failed" };
      }

      // 2) Mensaje legible (string)
      const origin = window.location.origin;
      const ts = new Date().toISOString();
      const message =
        `Deside Authentication\n` +
        `Domain: ${origin}\n` +
        `Address: ${pubkeyStr}\n` +
        `Nonce: ${nonce}\n` +
        `Timestamp: ${ts}`;

      // 3) Firmar con la wallet (string -> visible para el usuario)
      if (typeof signMessage !== "function") {
        console.warn("[AuthService] ❌ La wallet no soporta signMessage()");
        return { pubkey: pubkeyStr, status: "signature_unsupported" };
      }

      const rawSignature = await signMessage(message);
      if (!rawSignature) {
        console.warn("[AuthService] ⚠️ Firma no generada (cancelación o fallo)");
        return { pubkey: null, status: "signature_failed" };
      }

      // 4) Normalización a Base58
      let signature;
      if (typeof rawSignature === "string") {
        signature = rawSignature;
      } else if (rawSignature instanceof Uint8Array) {
        signature = bs58.encode(rawSignature);
      } else if (Array.isArray(rawSignature)) {
        signature = bs58.encode(Uint8Array.from(rawSignature));
      } else {
        console.warn("[AuthService] ⚠️ Tipo de firma desconocido");
        return { pubkey: pubkeyStr, status: "signature_unknown_type" };
      }

      // 5) Persistir firma para APIs (X-Wallet-Signature)
      try { storeWalletSignature(signature); } catch {}

      // 6) Intercambio con el backend
      const result = await authenticateWithServer(pubkeyStr, signature, message);
      if (!result || result?.nextStep !== "ACCESS_GRANTED") {
        return {
          pubkey: pubkeyStr,
          status: "server_error",
          message: result?.error || "Unknown error",
        };
      }

      // 7) Persistencia CSRF si aparece en cookie
      const csrfMatch = document.cookie.match(/csrfToken=([^;]+)/);
      if (csrfMatch) storeCSRFToken(csrfMatch[1]);

      try {
        window.dispatchEvent(new Event('sessionEstablished'));
      } catch (_) {}

      return { pubkey: pubkeyStr, status: "authenticated" };
    } catch (error) {
      console.error("[AuthService] ❌ Error en authenticateWallet:", error);
      return {
        pubkey: pubkeyStr || null,
        status: "authentication_failed",
        message: error?.message || "Unknown error",
      };
    }
  };

  return authenticateWallet;
};
