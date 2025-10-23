import { describe, it, expect } from "vitest";
import { toUiMessage } from "./toUiMessage.js";

describe("toUiMessage", () => {
  it("preserves agreement metadata and convId/clientId", () => {
    const message = {
      kind: "agreement",
      agreement: { id: "ag1", createdBy: "WALLET_A" },
      receipt: { status: "pending_a" },
      clientId: "client-123",
    };

    const result = toUiMessage(message, "WALLET_A", "WALLET_A:WALLET_B");

    expect(result.kind).toBe("agreement");
    expect(result.agreement).toEqual(message.agreement);
    expect(result.receipt).toEqual(message.receipt);
    expect(result.convId).toBe("WALLET_A:WALLET_B");
    expect(result.clientId).toBe("client-123");
    expect(result.sender).toBe("me");
    expect(result.direction).toBe("sent");
  });

  it("derives direction for payment requests based on payer/payee", () => {
    const message = {
      kind: "payment-request",
      paymentRequest: { payee: "WALLET_A", amount: "10", token: "USDC" },
      clientId: "pr-1",
    };

    const result = toUiMessage(message, "WALLET_A", "WALLET_A:WALLET_B");

    expect(result.kind).toBe("payment-request");
    expect(result.paymentRequest).toEqual(message.paymentRequest);
    expect(result.sender).toBe("me");
    expect(result.direction).toBe("sent");
  });

  it("maps media messages and infers media kind", () => {
    const message = {
      id: "srv-99",
      kind: "media-inline",
      base64: "ZmFrZS1kYXRh",
      mime: "image/png",
    };

    const result = toUiMessage(message, "WALLET_A", "WALLET_A:WALLET_B");

    expect(result.kind).toBe("media-inline");
    expect(result.media).toEqual({
      kind: "image",
      base64: "ZmFrZS1kYXRh",
      mime: "image/png",
      width: undefined,
      height: undefined,
      durationMs: undefined,
    });
    expect(result.text).toBeNull();
    expect(result.clientId).toBe("srv-99");
  });

  it("falls back to message id when clientId is missing", () => {
    const message = {
      id: "server-abc",
      kind: "agreement",
      agreement: { id: "ag-42" },
      receipt: { status: "pending_a" },
    };

    const result = toUiMessage(message, "WALLET_A", "WALLET_A:WALLET_B");

    expect(result.clientId).toBe("server-abc");
  });
});
