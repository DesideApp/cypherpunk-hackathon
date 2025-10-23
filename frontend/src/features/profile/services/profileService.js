import { apiRequest } from "@shared/services/apiService.js";

export async function updateMyProfile({ nickname, avatar, social }) {
  const body = {
    nickname,
    avatar,
    ...(social ? { social } : {}),
  };
  return apiRequest("/api/users/v1/me/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
