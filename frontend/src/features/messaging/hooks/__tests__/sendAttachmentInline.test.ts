import { describe, expect, it, vi, Mock } from "vitest";
import * as relay from "../../clients/relayClient";
import { encryptPayload } from "../../e2e/e2e";

vi.mock("../../clients/relayClient", () => ({
  enqueue: vi.fn().mockResolvedValue({ id: "srv1", deliveredAt: null }),
}));

vi.mock("../../e2e/e2e", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../e2e/e2e")>();
  return {
    ...mod,
    encryptPayload: vi.fn(mod.encryptPayload),
  };
});

describe("sendAttachmentInline E2EE", () => {
  it("never enqueues iv:null when a conversation key exists", async () => {
    const rawKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const convKey = await globalThis.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );

    const base64 = "AAECAw==";
    const mime = "image/webp";
    const convId = "A:B";
    const self = "A";
    const peer = "B";
    const mediaAad = `cid:${convId}|from:${self}|to:${peer}|v:1|media`;

    const env = await encryptPayload({ type: "bin", binBase64: base64 }, convKey, mediaAad);

    await relay.enqueue({
      to: peer,
      box: env.cipher,
      iv: env.iv,
      msgId: "local-1",
      mime,
      meta: { kind: "media", convId, from: self, to: peer, aad: mediaAad },
    });

    const enqueueMock = relay.enqueue as unknown as Mock;
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const args = enqueueMock.mock.calls[0][0] as {
      iv: unknown;
      box: unknown;
      meta?: { aad?: string };
    };

    expect(args.iv).toBeTruthy();
    expect(args.box).toBeTruthy();
    expect(args.meta?.aad).toBe(mediaAad);
  });
});
