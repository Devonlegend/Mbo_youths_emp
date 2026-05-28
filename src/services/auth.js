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