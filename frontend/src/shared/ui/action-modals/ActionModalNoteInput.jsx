import React from "react";
import PropTypes from "prop-types";

/**
 * ActionModalNoteInput - Input específico para notas/mensajes
 * Diseñado para ir en el lado derecho de ActionModalCustomRow
 */
export function ActionModalNoteInput({ className, ...rest }) {
  const classes = ["action-modal-note-input", className]
    .filter(Boolean)
    .join(" ");

  return <input type="text" className={classes} {...rest} />;
}

ActionModalNoteInput.propTypes = {
  className: PropTypes.string,
};

