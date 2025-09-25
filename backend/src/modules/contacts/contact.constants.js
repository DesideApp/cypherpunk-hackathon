// Estados DM-first
export const ContactStatus = {
  PENDING_OUT: "pending_out",
  PENDING_IN: "pending_in", // si decides crear doc inverso, opcional
  ACCEPTED: "accepted",
  BLOCKED: "blocked",
  CLOSED: "closed",
};

export const CONTACT_TTL_DAYS = 30;       // caducidad de solicitud
export const REJECT_COOLDOWN_DAYS = 7;    // cooldown tras rechazo

// Eventos (dejamos legacy vivos en paralelo en los emisores)
export const DMEvents = {
  REQUEST: "dm_request",
  ACCEPTED: "dm_accepted",
  REJECTED: "dm_rejected",
  CANCELED: "dm_canceled",
  BLOCKED: "dm_blocked",
  UNBLOCKED: "dm_unblocked",
};
