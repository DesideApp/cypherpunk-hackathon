import nacl from 'tweetnacl';
import bs58 from 'bs58';
import logger from '#config/logger.js';

// Verificar firma en Solana
export const verifySignature = (message, signature, pubkey) => {
    try {
        // Normaliza: garantizamos string antes de codificar
        const msgStr = typeof message === 'string' ? message : String(message);
        const encodedMessage = new TextEncoder().encode(msgStr);

        logger.info("🔵 Verificando firma...");
        logger.info(`   👉 PubKey (Base58): ${pubkey}`);
        logger.info(`   👉 Signature (Base58): ${signature}`);

        const signatureUint8 = bs58.decode(signature);
        const pubkeyUint8 = bs58.decode(pubkey);

        const isValid = nacl.sign.detached.verify(encodedMessage, signatureUint8, pubkeyUint8);

        if (isValid) {
            logger.info("✅ Firma válida.");
        } else {
            logger.warn("❌ Firma inválida.");
        }

        return isValid;
    } catch (error) {
        logger.error("❌ Error verifying signature:", error);
        return false;
    }
};
