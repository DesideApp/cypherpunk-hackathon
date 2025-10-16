import { apiRequest } from "@shared/services/apiService.js";

const BASE = "/api/v1/blinks";

function ensureOk(response) {
  if (!response) {
    throw new Error("Blink execution failed without response.");
  }
  if (response.error) {
    const err = new Error(response.message || "Blink execution failed.");
    err.code = response.errorCode || response.error;
    err.details = response.details || null;
    throw err;
  }
  if (response.data) return response.data;
  return response;
}

export async function executeBlink(actionUrl, account, { signal } = {}) {
  console.debug("[blink] executing via backend", { actionUrl, account });
  const res = await apiRequest(`${BASE}/execute`, {
    method: "POST",
    body: JSON.stringify({ actionUrl, account }),
    ...(signal ? { signal } : {}),
  });
  return ensureOk(res);
}
