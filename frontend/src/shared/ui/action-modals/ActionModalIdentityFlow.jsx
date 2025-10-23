import React from "react";
import PropTypes from "prop-types";
import { ActionModalIdentity } from "./ActionModalIdentity.jsx";

const ARROWS = {
  incoming: "←",
  outgoing: "→",
};

export function ActionModalIdentityFlow({
  left,
  right,
  direction = "outgoing",
  arrowLabel,
  className,
  ...rest
}) {
  const arrow =
    arrowLabel != null ? arrowLabel : ARROWS[direction] || ARROWS.outgoing;
  const classes = ["action-modal-transaction-flow", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      <ActionModalIdentity {...left} />
      <span className="action-modal-arrow">{arrow}</span>
      <ActionModalIdentity {...right} />
    </div>
  );
}

ActionModalIdentityFlow.propTypes = {
  left: PropTypes.shape(ActionModalIdentity.propTypes).isRequired,
  right: PropTypes.shape(ActionModalIdentity.propTypes).isRequired,
  direction: PropTypes.oneOf(["incoming", "outgoing"]),
  arrowLabel: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  className: PropTypes.string,
};
