import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useWallet } from "@wallet-adapter/core/contexts/WalletProvider";
import { useProfile } from "@features/profile/hooks/useProfile.js";
import { getCssVariable } from "@wallet-adapter/theme/getCssVariable";
import { useSolanaBalance } from "../../core/hooks/useSolanaBalance";
import { Copy, Eye, Check, X as CloseX, Pencil } from "lucide-react";
import { notify } from "@shared/services/notificationService.js";
// on-chain identity and cropper removed in MVP

type Props = { onClose?: () => void };

function WalletMenuContent({ onClose }: Props) {
  const { connected, publicKey, disconnect, signMessage } = useWallet();
  const { profile, update, refresh } = useProfile();
  const balanceRaw = useSolanaBalance();

  // -------------------- pubkey / helpers
  const base58 = useMemo(() => {
    if (!publicKey) return null;
    return typeof publicKey === "string"
      ? publicKey
      : (publicKey as any)?.toBase58?.() ?? String(publicKey);
  }, [publicKey]);

  const shorten = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : addr;

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyPubkey = useCallback(async () => {
    if (!base58 || copied) return;
    try {
      await navigator.clipboard.writeText(base58);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* noop */}
  }, [base58, copied]);

  const handleDisconnect = async () => {
    try { await disconnect(); } finally { onClose?.(); }
  };

  // -------------------- identity (solo lectura + drafts de edición)
  const identityData = (profile as any) ?? {};
  const initialNickname: string = identityData?.nickname || "Unnamed";
  const initialAvatarUrl: string = identityData?.avatar || "";
  const initialX: string = identityData?.social?.twitter || identityData?.social?.x || "";
  const initialWebsite: string = identityData?.social?.website || "";

  const [editMode, setEditMode] = useState(false);
  const [nickDraft, setNickDraft] = useState(initialNickname);
  const [xDraft, setXDraft] = useState(initialX);
  const [webDraft, setWebDraft] = useState(initialWebsite);

  // Avatar: preview (sin subida en MVP)
  const [avatarPreview, setAvatarPreview] = useState<string>(initialAvatarUrl);

  // Rehidratación si cambia la identity
  useEffect(() => {
    setNickDraft(initialNickname);
    setXDraft(initialX);
    setWebDraft(initialWebsite);
    setAvatarPreview(initialAvatarUrl);
  }, [initialNickname, initialX, initialWebsite, initialAvatarUrl]);

  // Limpieza de object URLs
  useEffect(() => {
    return () => { if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview); };
  }, [avatarPreview]);

  // -------------------- balance normalizado (evita "SOL SOL")
  const balance = useMemo(() => {
    if (balanceRaw == null) return "0.0000";
    const s = String(balanceRaw).trim().replace(/\s*SOL$/i, "");
    const n = Number(s);
    return Number.isFinite(n) ? n.toFixed(4) : s;
  }, [balanceRaw]);

  // -------------------- helpers edición
  const ensureHttps = (url: string) => {
    if (!url) return "";
    const u = url.trim();
    return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  };
  const normalizeX = (handle: string) => handle.trim().replace(/^@/, "");

  const avatarChanged = initialAvatarUrl && avatarPreview !== initialAvatarUrl;
  const dirty =
    nickDraft.trim() !== initialNickname.trim() ||
    avatarChanged ||
    normalizeX(xDraft) !== normalizeX(initialX) ||
    ensureHttps(webDraft) !== ensureHttps(initialWebsite);

  const [busy, setBusy] = useState(false);
  const canSave = connected && dirty && !busy;

  // -------------------- avatar (MVP): usa URL pegada por el usuario
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -------------------- subida opcional del avatar (deshabilitada en MVP)
  const uploadAvatarIfNeeded = async (): Promise<string | null> => {
    if (/^https?:\/\//i.test(avatarPreview)) return avatarPreview.trim();
    return null;
  };

  // -------------------- Save (off‑chain)
  const onSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      let avatarForPayload: string | null = null;
      const uploaded = await uploadAvatarIfNeeded();
      if (uploaded) avatarForPayload = uploaded;

      // Firma explícita para perfil (mensaje legible)
      let signature: string | undefined;
      let message: string | undefined;
      try {
        if (connected && publicKey && typeof signMessage === 'function') {
          const base58 = typeof publicKey === 'string' ? publicKey : (publicKey as any)?.toBase58?.() ?? String(publicKey);
          message = [
            'Deside Profile Update',
            `Address: ${base58}`,
            `Nickname: ${(nickDraft || 'Unnamed').trim()}`,
            `Avatar: ${avatarForPayload || ''}`,
            `Timestamp: ${new Date().toISOString()}`,
          ].join('\n');
          signature = await signMessage(message);
        }
      } catch (e) {
        console.warn('[Profile] Firma de actualización omitida:', (e as any)?.message || e);
      }

      await update({
        nickname: (nickDraft || "Unnamed").trim(),
        avatar: avatarForPayload,
        signature,
        message,
      });
      await refresh();
      setEditMode(false);
      notify.success(signature ? "Profile saved (signed)" : "Profile saved");
    } catch (e) {
      console.error("Update profile failed:", e);
      notify.error("Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  // -------------------- estilos base
  const labelCss: React.CSSProperties = {
    fontFamily: getCssVariable("--font-navigation-family"),
    fontSize: getCssVariable("--font-navigation-size"),
    fontWeight: 600,
    textTransform: getCssVariable("--font-navigation-transform"),
    color: getCssVariable("--text-secondary"),
    letterSpacing: "0.06em",
  };
  const valueCss: React.CSSProperties = {
    fontFamily: getCssVariable("--font-data-family"),
    fontSize: getCssVariable("--font-data-size"),
    color: getCssVariable("--text-primary"),
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100%",
      background: getCssVariable("--window-background"),
    }}>
      {/* HEADER = avatar + nick + estado + pubkey (2 filas) */}
      <header style={{
        position: "relative",
        padding: "16px 20px 14px",
        background: getCssVariable("--window-background"),
      }}>
        {/* Close oculto durante edición */}
        {!editMode && (
          <button
            onClick={() => onClose?.()}
            aria-label="Close"
            style={{
              position: "absolute", right: 8, top: 8,
              width: 32, height: 32, display: "grid", placeItems: "center",
              background: "transparent", border: 0, borderRadius: 8,
              color: getCssVariable("--text-primary"), cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = getCssVariable("--hover-overlay"))}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <CloseX size={18} />
          </button>
        )}

        {/* Avatar + nombre */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", overflow: "hidden",
            background: getCssVariable("--surface-color"),
            display: "grid", placeItems: "center",
            border: `1px solid ${getCssVariable("--border-color")}`,
            position: "relative", flex: "0 0 auto",
          }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt={nickDraft} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", height: "100%", lineHeight: 1,
                fontFamily: getCssVariable("--font-ui-family"),
                fontWeight: 700, fontSize: 16,
                color: getCssVariable("--text-primary"),
              }}>
                {nickDraft.slice(0, 1).toUpperCase()}
              </span>
            )}

            {/* sin botón de cambio (cropper) en MVP */}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            {/* Nickname */}
            {!editMode ? (
              <div style={{
                fontFamily: getCssVariable("--font-ui-family"),
                fontSize: `calc(${getCssVariable("--font-ui-size")} + 2px)`,
                fontWeight: 700, color: getCssVariable("--text-primary"), lineHeight: 1.2,
              }}>
                {nickDraft || "Unnamed"}
              </div>
            ) : (
              <input
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                placeholder="Your nickname"
                className="wa-ghost-input"
                style={{
                  width: "100%", borderRadius: 8, padding: "8px 10px",
                  fontFamily: getCssVariable("--font-ui-family"),
                  fontSize: getCssVariable("--font-ui-size"),
                }}
              />
            )}

            <small style={{
              fontFamily: getCssVariable("--font-ui-family"),
              fontSize: "12px", color: getCssVariable("--text-secondary"), opacity: 0.75,
            }}>
              {connected ? "Connected" : "Not connected"}
            </small>
          </div>
        </div>

        {/* Public Key (2 filas) */}
        {connected && base58 && (
          <div style={{ marginTop: 12 }}>
            {/* Fila 1: label + Copy */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <span style={labelCss}>Public Key</span>
              <button
                onClick={copyPubkey}
                aria-label="Copy address"
                style={{
                  width: 30, height: 30, border: 0, borderRadius: 6,
                  background: "transparent", display: "grid", placeItems: "center", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = getCssVariable("--hover-overlay"))}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {copied ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
              </button>
            </div>

            {/* Fila 2: address clamp 1–2 líneas + Eye */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginTop: 6,
            }}>
              <span style={{
                ...valueCss,
                lineHeight: 1.25, whiteSpace: "normal", wordBreak: "break-all",
                display: "-webkit-box", WebkitBoxOrient: "vertical",
                WebkitLineClamp: expanded ? 2 : 1, overflow: "hidden",
                maxWidth: "calc(100% - 40px)",
              }}>
                {expanded ? base58 : shorten(base58)}
              </span>

              <button
                onClick={() => setExpanded((v) => !v)}
                aria-label={expanded ? "Collapse address" : "Expand address"}
                style={{
                  width: 30, height: 30, border: 0, borderRadius: 6,
                  background: "transparent", display: "grid", placeItems: "center",
                  cursor: "pointer", flex: "0 0 auto",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = getCssVariable("--hover-overlay"))}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Eye size={18} />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* BODY */}
      <section style={{ padding: "12px 20px 16px", display: "grid", gap: 12 }}>
        {/* Único hairline separador */}
        <div style={{
          height: 1, background: getCssVariable("--border-color"),
          opacity: 0.6, marginBottom: 4,
        }} />

        {/* Balance */}
        <Row
          label="Balance"
          value={
            <span style={{ fontFamily: getCssVariable("--font-data-family"), fontWeight: 600 }}>
              {balance} <span style={{ opacity: 0.7 }}>SOL</span>
            </span>
          }
        />

        {/* X */}
        {!editMode ? (
          <Row
            label="X"
            value={
              initialX ? (
                <a
                  href={`https://x.com/${normalizeX(initialX)}`}
                  target="_blank" rel="noreferrer"
                  style={{ ...valueCss, textDecoration: "none" }}
                >
                  @{normalizeX(initialX)}
                </a>
              ) : "—"
            }
          />
        ) : (
          <EditRow
            label="X"
            placeholder="@user"
            value={xDraft}
            onChange={setXDraft}
            hint={`https://x.com/${normalizeX(xDraft || "user")}`}
          />
        )}

        {/* Website */}
        {!editMode ? (
          <Row
            label="Website"
            value={
              initialWebsite ? (
                <a
                  href={ensureHttps(initialWebsite)}
                  target="_blank" rel="noreferrer"
                  style={{ ...valueCss, textDecoration: "none" }}
                >
                  {ensureHttps(initialWebsite)}
                </a>
              ) : "—"
            }
          />
        ) : (
          <EditRow
            label="Website"
            placeholder="https://yourdomain.xyz"
            value={webDraft}
            onChange={setWebDraft}
            hint={ensureHttps(webDraft || "yourdomain.xyz")}
          />
        )}

        {/* CTA edición */}
        {!editMode ? (
          <div style={{ marginTop: 6 }}>
            <button
              type="button" className="wa-ghost-button"
              onClick={() => setEditMode(true)}
              style={{
                padding: "10px 14px", borderRadius: 8,
                fontFamily: getCssVariable("--font-ui-family"),
                fontSize: getCssVariable("--font-ui-size"),
                color: getCssVariable("--text-primary"),
                cursor: "pointer",
              }}
            >
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <Pencil size={16} /> Edit profile
              </span>
            </button>
          </div>
        ) : (
          <div style={{
            display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", marginTop: 8,
          }}>
            <button
              type="button" className="wa-ghost-button"
            onClick={() => {
              // revert
              setNickDraft(initialNickname);
              setXDraft(initialX);
              setWebDraft(initialWebsite);
              setAvatarPreview(initialAvatarUrl);
              setEditMode(false);
            }}
              style={{ padding: "10px 14px", borderRadius: 8 }}
            >
              Cancel
            </button>

            <button
              type="button" disabled={!canSave} onClick={onSave}
              style={{
                padding: "10px 16px", borderRadius: 8, border: 0,
                background: canSave ? getCssVariable("--action-color") : getCssVariable("--border-color"),
                color: "white",
                fontFamily: getCssVariable("--font-ui-family"),
                fontSize: getCssVariable("--font-ui-size"),
                fontWeight: 700,
                cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              {busy ? "Signing..." : "Save changes"}
            </button>
          </div>
        )}
      </section>

      {/* FOOTER = Disconnect (oculto en edición) */}
      {!editMode && (
        <footer style={{ marginTop: "auto", padding: "12px 20px 20px" }}>
          <button
            onClick={handleDisconnect}
            style={{
              width: "100%", height: 40, borderRadius: 8, border: 0,
              background: getCssVariable("--action-color"),
              color: "white",
              fontFamily: getCssVariable("--font-ui-family"),
              fontSize: getCssVariable("--font-ui-size"),
              fontWeight: 600, cursor: "pointer",
              transition: "filter .15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.96)")}
            onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
          >
            Disconnect
          </button>
        </footer>
      )}

      {/* Cropper eliminado en MVP */}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "8px 0",
    }}>
      <span style={{
        fontFamily: getCssVariable("--font-navigation-family"),
        fontSize: getCssVariable("--font-navigation-size"),
        textTransform: getCssVariable("--font-navigation-transform"),
        letterSpacing: "0.06em", color: getCssVariable("--text-secondary"),
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: getCssVariable("--font-data-family"),
        fontSize: getCssVariable("--font-data-size"),
        color: getCssVariable("--text-primary"),
        textAlign: "right", minWidth: 0,
      }}>
        {value}
      </span>
    </div>
  );
}

function EditRow({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{
        fontFamily: getCssVariable("--font-navigation-family"),
        fontSize: getCssVariable("--font-navigation-size"),
        textTransform: getCssVariable("--font-navigation-transform"),
        letterSpacing: "0.06em", color: getCssVariable("--text-secondary"),
      }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="wa-ghost-input"
        style={{
          width: "100%", borderRadius: 8, padding: "10px 12px",
          fontFamily: getCssVariable("--font-data-family"),
          fontSize: getCssVariable("--font-data-size"),
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = getCssVariable("--action-color");
          (e.currentTarget as HTMLInputElement).style.boxShadow = `0 0 0 2px ${getCssVariable("--action-color")}20`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = getCssVariable("--border-color");
          (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
        }}
      />
      {hint && (
        <small style={{ color: getCssVariable("--text-secondary"), opacity: 0.75 }}>
          {hint}
        </small>
      )}
    </div>
  );
}

export default WalletMenuContent;
export { WalletMenuContent };
