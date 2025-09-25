import ENV from "@shared/config/env.js";
import { getSocketClient } from "../clients/socketClient.js";

function reason(ok, why) {
  return { ok, reason: why };
}

export function shouldUseWebRTC({
  to: _to,
  hasAttachments = false,
  forceRelay = false,
  forceWebRTC = false,
}) {
  const sock = getSocketClient?.() || { status: 'closed', isPeerOnline: () => false };
  const cfg = ENV?.MESSAGING || {};
  if (forceWebRTC) return reason(true, "forced_webrtc");
  if (forceRelay || cfg.FORCE_RELAY) return reason(false, "forced_relay");
  if (hasAttachments) return reason(false, "attachments_relay");
  if (!cfg.USE_WEBRTC_FOR_TEXT) return reason(false, "toggle_off");
  if (sock.status !== 'open') return reason(false, 'ws_closed');
  return reason(true, "ws_open_text");
}

export function getTransportStatus(to) {
  const sock = getSocketClient?.() || { status: 'closed', isPeerOnline: () => false };
  const cfg = ENV?.MESSAGING || {};
  return {
    ws: sock.status,
    peerOnline: !!(to && sock.isPeerOnline?.(to)),
    policy: {
      FORCE_RELAY: !!cfg.FORCE_RELAY,
      USE_WEBRTC_FOR_TEXT: !!cfg.USE_WEBRTC_FOR_TEXT,
    },
  };
}

export function selectTransport({
  hasAttachment = false,
  dataChannelReady = false,
  peerOnline = false,
  forceRelay = false,
  forceRTC = false,
}) {
  const cfg = ENV?.MESSAGING || {};
  if (forceRTC) return "rtc";
  if (forceRelay || cfg.FORCE_RELAY) return "relay";
  if (hasAttachment) return "relay";
  const rtcAllowed = !!cfg.USE_WEBRTC_FOR_TEXT;
  if (rtcAllowed && (dataChannelReady || peerOnline)) return "rtc";
  return "relay";
}

export default { shouldUseWebRTC, getTransportStatus, selectTransport };
