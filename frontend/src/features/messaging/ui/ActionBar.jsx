import React from "react";
import PropTypes from "prop-types";

const ACTIONS = [
  {
    key: "send",
    label: "Send",
    title: "Send money",
  },
  {
    key: "request",
    label: "Request",
    title: "Request payment",
  },
  {
    key: "agreement",
    label: "Agreement",
    title: "On-chain agreement",
  },
];

function noop() {}

export default function ActionBar({
  onSend = noop,
  onRequest = noop,
  onAgreement = noop,
  disabled = false,
  pendingKind = null,
}) {
  const handlers = {
    send: onSend,
    request: onRequest,
    agreement: onAgreement,
  };

  return (
    <div className="action-bar" role="group" aria-label="Quick actions">
      {ACTIONS.map(({ key, label, title }) => {
        const isPending = pendingKind === key;
        const handler = handlers[key] || noop;
        const isDisabled = disabled;
        return (
          <button
            key={key}
            type="button"
            className={`action-bar-button${isPending ? " pending" : ""}${isDisabled ? " disabled" : ""}`}
            onClick={() => {
              if (typeof handler === "function") handler();
            }}
            title={title}
            aria-label={title}
            aria-disabled={isDisabled}
          >
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

ActionBar.propTypes = {
  onSend: PropTypes.func,
  onRequest: PropTypes.func,
  onAgreement: PropTypes.func,
  disabled: PropTypes.bool,
  pendingKind: PropTypes.oneOf(["send", "request", "agreement", null]),
};
