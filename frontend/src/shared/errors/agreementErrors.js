const DEFAULT_MESSAGE = "An unexpected error occurred.";

function extractCode(err) {
  if (!err) return null;
  if (typeof err === "string") return null;
  if (err.code) return err.code;
  if (err.errorCode) return err.errorCode;
  if (err.error && typeof err.error === "object") {
    return err.error.code || err.error.errorCode || err.error.statusCode || null;
  }
  return null;
}

function extractMessage(err) {
  if (!err) return DEFAULT_MESSAGE;
  if (typeof err === "string") return err;
  return err.message || err.details?.message || DEFAULT_MESSAGE;
}

export function mapAgreementError(err) {
  const code = extractCode(err);
  switch (code) {
    case "AGREEMENT_NOT_FOUND":
      return "This agreement does not exist or was removed.";
    case "NOT_PARTICIPANT":
      return "Your wallet is not part of this agreement.";
    case "INVALID_TURN":
      return "It is the other participant's turn to sign.";
    case "DEADLINE_EXPIRED":
      return "The agreement has expired.";
    case "STATE_INVALID":
      return "This agreement no longer accepts signatures.";
    case "VALIDATION_FAILED":
      return "Check the agreement fields.";
    case "DUPLICATE_SIGNATURE":
      return "You already signed this agreement.";
    case "MEMO_MISMATCH":
      return "The transaction does not contain the expected proof. Launch the signature from the card.";
    case "TX_NOT_FOUND":
      return "We could not verify your transaction. Try again.";
    case "RPC_UNAVAILABLE":
      return "The network is busy. Please try again.";
    case "RATE_LIMITED":
      return "Too many requests. Please try again shortly.";
    case "UNAUTHORIZED":
      return "Sign in to continue.";
    default:
      return extractMessage(err) || DEFAULT_MESSAGE;
  }
}

export default mapAgreementError;
