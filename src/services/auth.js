import api from "./axiosInstance";

export const register = (formData) =>
  api.post("/auth/register/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const login = (body) =>
  api.post("/auth/login/", body);

export const otpSend = (body) =>
  api.post("/auth/otp/send/", body);

export const otpVerify = (body) =>
  api.post("/auth/otp/verify/", body);

export const otpResend = (body) =>
  api.post("/auth/otp/resend/", body);

export const getMe = () =>
  api.get("/auth/me/");

export const refreshToken = () =>
  api.post("/auth/token/refresh/");

export const logout = () =>
  api.post("/auth/logout/");

export const forgotPasswordRequest = (body) =>
  api.post("/auth/password/reset/request/", body);

export const forgotPasswordVerifyOtp = (body) =>
  api.post("/auth/password/reset/verify/", body);

export const forgotPasswordReset = (body) =>
  api.post("/auth/password/reset/confirm/", body);

export const getAuditLogs = () =>
  api.get("/audit/");

export const getAdminUsers = () =>
  api.get("/auth/admin-users/");

export const createAdminUser = (body) =>
  api.post("/auth/admin-users/create/", body);

export const updateUserRole = (id, body) =>
  api.patch(`/auth/admin-users/${id}/role/`, body);

export const deactivateUser = (id) =>
  api.patch(`/auth/admin-users/${id}/deactivate/`);

export const reactivateUser = (id) =>
  api.patch(`/auth/admin-users/${id}/reactivate/`);