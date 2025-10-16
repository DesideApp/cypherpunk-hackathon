import { apiRequest } from "@shared/services/apiService.js";

export async function executeBuyBlink({ token, amount, account, slippageBps }) {
  const params = new URLSearchParams({ token, amount: String(amount) });
  const response = await apiRequest(`/api/v1/blinks/buy?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      type: "transaction",
      account,
      data: {
        amount: String(amount),
        slippageBps,
      },
    }),
  });

  if (!response || response.error) {
    const message = response?.message || response?.error || "Buy execution failed";
    const err = new Error(message);
    err.code = response?.error || response?.statusCode;
    err.details = response?.details || null;
    throw err;
  }

  return response;
}
