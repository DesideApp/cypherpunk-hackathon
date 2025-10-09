import { apiRequest } from "@shared/services/apiService.js";
import { mapAgreementError } from "@shared/errors/agreementErrors.js";

const BASE = "/api/v1/agreements";

function ensureOk(response) {
  if (response?.error) {
    const err = new Error(mapAgreementError(response));
    err.code = response?.errorCode || response?.error?.code || response?.code;
    throw err;
  }
  return response;
}

export async function createAgreement(payload) {
  const res = await apiRequest(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return ensureOk(res);
}

export async function prepareAgreementSignature(id, { signer } = {}) {
  if (!id) throw new Error("Agreement id requerido");
  const res = await apiRequest(`${BASE}/${id}/prepare-sign`, {
    method: "POST",
    body: JSON.stringify({ signer }),
  });
  return ensureOk(res);
}

export async function confirmAgreementSignature(id, payload) {
  if (!id) throw new Error("Agreement id requerido");
  const res = await apiRequest(`${BASE}/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return ensureOk(res);
}

export async function getAgreement(id) {
  if (!id) throw new Error("Agreement id requerido");
  const res = await apiRequest(`${BASE}/${id}`, { method: "GET" });
  return ensureOk(res);
}

export async function verifyAgreement(id) {
  if (!id) throw new Error("Agreement id requerido");
  const res = await apiRequest(`${BASE}/${id}/verify`, { method: "POST" });
  return ensureOk(res);
}

export async function markAgreementSettled(id, payload) {
  if (!id) throw new Error("Agreement id requerido");
  const res = await apiRequest(`${BASE}/${id}/settlement`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
  return ensureOk(res);
}
