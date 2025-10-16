import { apiRequest } from "@shared/services/apiService.js";

export async function updateMyProfile({ nickname, avatar, signature, message, social }) {
  // avatar: allow null to clear
  const body = {
    nickname,
    avatar,
    ...(social ? { social } : {}),
    ...(signature ? { signature } : {}),
    ...(message ? { message } : {}),
  };
  return apiRequest("/api/users/v1/me/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
