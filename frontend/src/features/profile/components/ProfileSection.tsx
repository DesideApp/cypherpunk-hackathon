import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Copy,
  Eye,
  Image as ImageIcon,
  Pencil,
  X as CloseIcon,
  XCircle,
} from "lucide-react";
import { UiButton, UiCard } from "@shared/ui";
import { apiRequest } from "@shared/services/apiService.js";
import { apiUrl } from "@shared/config/env.js";
import { optimizeAvatar } from "@wallet-adapter/core/hooks/useAvatarUpload";
import { notify } from "@shared/services/notificationService.js";

import "./ProfileSection.css";

type ProfilePayload = {
  nickname: string;
  avatar: string | null;
  social: {
    x?: string;
    website?: string;
  };
};

type ProfileSectionProps = {
  profile: unknown;
  connected: boolean;
  publicKey: string | null;
  onUpdate: (payload: ProfilePayload) => Promise<void>;
  onRefresh: () => Promise<void>;
  balance: string;
  onDisconnect: () => Promise<void>;
  onClose?: () => void;
};

const ProfileSection: React.FC<ProfileSectionProps> = ({
  profile,
  connected,
  publicKey,
  onUpdate,
  onRefresh,
  balance,
  onDisconnect,
  onClose,
}) => {
  const identity = (profile as any) ?? {};

  const initialNickname: string = identity?.nickname || "Unnamed";
  const initialAvatarUrl: string = identity?.avatar || "";
  const initialX: string =
    identity?.social?.twitter || identity?.social?.x || "";
  const initialWebsite: string = identity?.social?.website || "";

  const [editMode, setEditMode] = useState(false);
  const [nickDraft, setNickDraft] = useState(initialNickname);
  const [xDraft, setXDraft] = useState(initialX || "");
  const [webDraft, setWebDraft] = useState(initialWebsite || "");
  const [avatarPreview, setAvatarPreview] = useState<string>(initialAvatarUrl);

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const base58 = useMemo(() => publicKey ?? null, [publicKey]);

  useEffect(() => {
    setNickDraft(initialNickname);
    setXDraft(initialX || "");
    setWebDraft(initialWebsite || "");
    setAvatarPreview(initialAvatarUrl);
  }, [initialNickname, initialX, initialWebsite, initialAvatarUrl]);

  const ensureHttps = (url: string) => {
    if (!url) return "";
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const normalizeX = (handle: string) => handle.trim().replace(/^@/, "");
  const shorten = (value: string, head = 4, tail = 4) => {
    if (!value) return "";
    const trimmed = value.trim();
    if (trimmed.length <= head + tail + 1) return trimmed;
    return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
  };

  const avatarChanged =
    (initialAvatarUrl || "") !== (avatarPreview || "");
  const dirty =
    nickDraft.trim() !== initialNickname.trim() ||
    avatarChanged ||
    normalizeX(xDraft) !== normalizeX(initialX || "") ||
    ensureHttps(webDraft) !== ensureHttps(initialWebsite || "");

  const canSave = connected && dirty && !busy;

  const copyPubkey = useCallback(async () => {
    if (!base58 || copied) return;
    try {
      await navigator.clipboard.writeText(base58);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }, [base58, copied]);

  const uploadAvatarIfNeeded = async (): Promise<string | null> => {
    if (!avatarPreview) return null;
    if (/^https?:\/\//i.test(avatarPreview)) return avatarPreview.trim();
    return null;
  };

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const uploaded = await uploadAvatarIfNeeded();
      await onUpdate({
        nickname: (nickDraft || "Unnamed").trim(),
        avatar: uploaded,
        social: {
          x: normalizeX(xDraft || ""),
          website: ensureHttps(webDraft || ""),
        },
      });
      await onRefresh();
      setEditMode(false);
      notify.success("Profile saved");
    } catch (error) {
      console.error("Update profile failed:", error);
      notify.error("Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarChange = useCallback(() => {
    if (!editMode) return;
    const next = window.prompt("Image URL", avatarPreview || "");
    if (next === null) return;
    setAvatarPreview(next.trim());
  }, [avatarPreview, editMode]);

  const handleAvatarClear = useCallback(() => {
    if (!editMode) return;
    setAvatarPreview("");
  }, [editMode]);

  const handleAvatarUploadClick = useCallback(() => {
    if (!editMode) return;
    fileInputRef.current?.click();
  }, [editMode]);

  const processAvatarFile = useCallback(async (f: File) => {
    try {
      setBusy(true);
      const optimized = await optimizeAvatar(f, 512);
      const dataUrl: string = await new Promise((ok, ko) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result || ""));
        r.onerror = ko;
        r.readAsDataURL(optimized);
      });
      const res: any = await apiRequest("/api/v1/uploads/avatar", {
        method: "POST",
        body: JSON.stringify({ dataUrl }),
      });
      if (res?.error || !res?.url) throw new Error(res?.message || res?.error || "Upload failed");
      const absolute = apiUrl(res.url);
      setAvatarPreview(absolute);
    } catch (err: any) {
      console.error("Avatar upload failed:", err?.message || err);
      notify.error("Failed to upload image");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAvatarFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      await processAvatarFile(f);
    } finally {
      try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {}
    }
  }, [processAvatarFile]);

  const onAvatarDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, [editMode]);

  const onAvatarDragLeave = useCallback(() => {
    if (!editMode) return;
    setDragOver(false);
  }, [editMode]);

  const onAvatarDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) await processAvatarFile(f);
  }, [editMode, processAvatarFile]);

  const handleCancel = () => {
    setNickDraft(initialNickname);
    setXDraft(initialX || "");
    setWebDraft(initialWebsite || "");
    setAvatarPreview(initialAvatarUrl);
    setEditMode(false);
  };

  const connectionLabel = connected ? "Connected" : "Not connected";

  const rootClasses = [
    "profile-modal",
    editMode && "profile-modal--editing",
  ]
    .filter(Boolean)
    .join(" ");

  const xValue = normalizedValue(
    initialX,
    (value) => `https://x.com/${normalizeX(value)}`,
    (value) => `@${normalizeX(value)}`
  );

  const websiteValue = normalizedValue(
    initialWebsite,
    ensureHttps,
    ensureHttps
  );

  return (
    <div className={rootClasses}>
      <header className="profile-modal__header">
        <div className="profile-modal__heading">
          <h2 className="profile-modal__title">Profile</h2>
          <p className="profile-modal__subtitle">
            Changes are stored securely in your Deside account.
          </p>
        </div>
        {onClose && !editMode && (
          <button
            type="button"
            className="profile-icon-button"
            onClick={onClose}
            aria-label="Close profile panel"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </header>

      <section className="profile-modal__body">
        <div className="profile-identity">
          <div
            className="profile-avatar"
            onDragOver={onAvatarDragOver}
            onDragEnter={onAvatarDragOver}
            onDragLeave={onAvatarDragLeave}
            onDrop={onAvatarDrop}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={nickDraft}
                className="profile-avatar__image"
              />
            ) : (
              <span className="profile-avatar__fallback">
                {(nickDraft || "U").slice(0, 1).toUpperCase()}
              </span>
            )}

            {editMode && (
              <div className="profile-avatar__overlay" aria-label="Avatar actions">
                <button
                  type="button"
                  className="profile-avatar__action"
                  onClick={handleAvatarChange}
                >
                  <ImageIcon size={14} />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  className="profile-avatar__action"
                  onClick={handleAvatarUploadClick}
                  disabled={busy}
                >
                  <ImageIcon size={14} />
                  <span>{busy ? "Uploading…" : "Upload"}</span>
                </button>
                {dragOver && (
                  <span className="profile-avatar__hint" aria-live="polite">Drop image to upload</span>
                )}
                {avatarPreview && (
                  <button
                    type="button"
                    className="profile-avatar__action profile-avatar__action--ghost"
                    onClick={handleAvatarClear}
                  >
                    <XCircle size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hidden file input for avatar upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarFile}
          />

          <div className="profile-identity__content">
            {editMode ? (
              <input
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                placeholder="Your nickname"
                className="profile-input"
              />
            ) : (
              <h3 className="profile-name">{nickDraft || "Unnamed"}</h3>
            )}

            <span className="profile-status">{connectionLabel}</span>

            {!editMode && (
              <button
                type="button"
                className="profile-edit-trigger"
                onClick={() => setEditMode(true)}
              >
                <Pencil size={14} />
                Edit profile
              </button>
            )}
          </div>
        </div>

        <div className="profile-fields">
          {editMode ? (
            <ProfileFieldEdit
              label="X"
              value={xDraft}
              onChange={setXDraft}
              placeholder="@user"
              hint={
                xDraft
                  ? `https://x.com/${normalizeX(xDraft)}`
                  : "https://x.com/username"
              }
            />
          ) : (
            <ProfileField label="X">
              {xValue.rendered || "—"}
            </ProfileField>
          )}

          {editMode ? (
            <ProfileFieldEdit
              label="Website"
              value={webDraft}
              onChange={setWebDraft}
              placeholder="https://yourdomain.xyz"
              hint={webDraft ? ensureHttps(webDraft) : "https://yourdomain.xyz"}
            />
          ) : (
            <ProfileField label="Website">
              {websiteValue.rendered || "—"}
            </ProfileField>
          )}
        </div>

        <UiCard className="profile-wallet">
          <span className="profile-wallet__title">Wallet details</span>

          <div className="profile-wallet__row">
            <div className="profile-wallet__info">
              <span className="profile-field__label">Public key</span>
              <span className="profile-wallet__key">
                {base58 ? (expanded ? base58 : shorten(base58)) : "—"}
              </span>
            </div>

            <div className="profile-wallet__actions">
              <button
                type="button"
                className="profile-icon-button"
                onClick={copyPubkey}
                disabled={!base58}
                aria-label="Copy public key"
              >
                {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              </button>
              <button
                type="button"
                className="profile-icon-button"
                onClick={() => setExpanded((prev) => !prev)}
                disabled={!base58}
                aria-label={expanded ? "Collapse public key" : "Expand public key"}
              >
                <Eye size={16} />
              </button>
            </div>
          </div>

          <div className="profile-wallet__row">
            <span className="profile-field__label">Balance</span>
            <span className="profile-wallet__balance">{balance}</span>
          </div>
        </UiCard>

        {editMode && (
          <div className="profile-modal__actions">
            <UiButton variant="ghost" onClick={handleCancel}>
              Cancel
            </UiButton>
            <UiButton onClick={handleSave} disabled={!canSave}>
              {busy ? "Saving..." : "Save changes"}
            </UiButton>
          </div>
        )}
      </section>

      {!editMode && (
        <footer className="profile-modal__footer">
          <UiButton block onClick={onDisconnect}>
            Disconnect
          </UiButton>
        </footer>
      )}
    </div>
  );
};

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function ProfileField({ label, children }: FieldProps) {
  return (
    <div className="profile-field">
      <span className="profile-field__label">{label}</span>
      <span className="profile-field__value">{children}</span>
    </div>
  );
}

type FieldEditProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  hint?: string;
};

function ProfileFieldEdit({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: FieldEditProps) {
  return (
    <div className="profile-field profile-field--edit">
      <label className="profile-field__label">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="profile-input"
      />
      {hint && <small className="profile-field__hint">{hint}</small>}
    </div>
  );
}

function normalizedValue(
  raw: string | null | undefined,
  toHref: (value: string) => string,
  toText: (value: string) => string
) {
  if (!raw || !raw.trim()) {
    return { href: null, rendered: "" };
  }
  const href = toHref(raw);
  const text = toText(raw);
  return {
    href,
    rendered: (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="profile-link"
      >
        {text}
      </a>
    ),
  };
}

export default ProfileSection;
export { ProfileSection };
