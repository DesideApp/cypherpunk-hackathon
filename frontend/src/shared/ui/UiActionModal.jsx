import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { ModalShell, UiButton } from "@shared/ui";

export const UiActionModal = ({
  open = false,
  title = "Action",
  steps = [],
  currentStep = 0,
  onStepChange,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  confirmDisabled = false,
  confirmLoading = false,
  showBackButton = true,
  showCloseButton = true,
  children,
  className,
  ...rest
}) => {
  const [internalStep, setInternalStep] = useState(currentStep);

  // Sync internal step with external currentStep
  useEffect(() => {
    setInternalStep(currentStep);
  }, [currentStep]);

  const handleStepChange = (newStep) => {
    setInternalStep(newStep);
    if (onStepChange) {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (internalStep > 0) {
      handleStepChange(internalStep - 1);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const canGoBack = internalStep > 0;
  const isLastStep = internalStep === steps.length - 1;

  const modalFooter = (
    <>
      {showCloseButton && (
        <UiButton variant="ghost" onClick={handleClose} disabled={confirmLoading}>
          Close
        </UiButton>
      )}
      {showBackButton && canGoBack && (
        <UiButton variant="secondary" onClick={handleBack} disabled={confirmLoading}>
          Back
        </UiButton>
      )}
      {isLastStep && (
        <UiButton 
          onClick={handleConfirm} 
          disabled={confirmDisabled || confirmLoading}
        >
          {confirmLoading ? "Loading..." : confirmLabel}
        </UiButton>
      )}
    </>
  );

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={undefined} // We handle close in footer
      title={title}
      footer={modalFooter}
      className={className}
      {...rest}
    >
      <div className="ui-action-modal-body">
        {/* Step indicator */}
        {steps.length > 1 && (
          <div className="ui-action-modal-steps">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`ui-action-modal-step ${
                  index === internalStep ? "active" : 
                  index < internalStep ? "completed" : "pending"
                }`}
              >
                <div className="ui-action-modal-step-number">
                  {index < internalStep ? "✓" : index + 1}
                </div>
                <span className="ui-action-modal-step-label">{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Dynamic content */}
        <div className="ui-action-modal-content">
          {typeof children === "function" 
            ? children({ step: internalStep, stepName: steps[internalStep] })
            : children
          }
        </div>
      </div>
    </ModalShell>
  );
};

UiActionModal.propTypes = {
  open: PropTypes.bool,
  title: PropTypes.string,
  steps: PropTypes.arrayOf(PropTypes.string),
  currentStep: PropTypes.number,
  onStepChange: PropTypes.func,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  confirmLabel: PropTypes.string,
  confirmDisabled: PropTypes.bool,
  confirmLoading: PropTypes.bool,
  showBackButton: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  className: PropTypes.string,
};

UiActionModal.displayName = "UiActionModal";

