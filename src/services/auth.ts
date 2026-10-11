import api from "./axiosInstance";
import type { MessageResponse, Paginated, UUID } from "@/types/common";
import type { AuthUser } from "@/types/user";
import type { AuditLogEntry } from "@/types/audit";
import type {
  LoginRequest,
  LoginResponse,
  OtpEmailRequest,
  OtpVerifyRequest,
  PasswordResetConfirmBody,
  PasswordResetRequestBody,
  PasswordResetVerifyBody,
  RegisterResponse,
} from "@/types/auth";

type JsonBody = Record<string, unknown>;

export const register = (formData: FormData) =>
  api.post<RegisterResponse>("/auth/register/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const login = (body: LoginRequest) =>
  api.post<LoginResponse>("/auth/login/", body);

export const otpSend = (body: OtpEmailRequest) =>
  api.post<MessageResponse>("/auth/otp/send/", body);

export const otpVerify = (body: OtpVerifyRequest) =>
  api.post<MessageResponse>("/auth/otp/verify/", body);

export const otpResend = (body: OtpEmailRequest) =>
  api.post<MessageResponse>("/auth/otp/resend/", body);

export const getMe = () =>
  api.get<AuthUser>("/auth/me/");

export const refreshToken = () =>
  api.post<MessageResponse>("/auth/token/refresh/");

export const logout = () =>
  api.post<MessageResponse>("/auth/logout/");

export const forgotPasswordRequest = (body: PasswordResetRequestBody) =>
  api.post<MessageResponse>("/auth/password/reset/request/", body);

export const forgotPasswordVerifyOtp = (body: PasswordResetVerifyBody) =>
  api.post<MessageResponse>("/auth/password/reset/verify/", body);

export const forgotPasswordReset = (body: PasswordResetConfirmBody) =>
  api.post<MessageResponse>("/auth/password/reset/confirm/", body);

export const getAuditLogs = (page: number = 1) =>
  api.get<Paginated<AuditLogEntry>>("/audit/", { params: { page } });

// The five admin-user endpoints below have no matching route on the backend
// (accounts/urls.py does not define them), so they are expected to return 404.
// Left unchanged; their bodies and responses stay `unknown`.
export const getAdminUsers = () =>
  api.get<unknown>("/auth/admin-users/");

export const createAdminUser = (body: JsonBody) =>
  api.post<unknown>("/auth/admin-users/create/", body);

export const updateUserRole = (id: UUID, body: JsonBody) =>
  api.patch<unknown>(`/auth/admin-users/${id}/role/`, body);

export const deactivateUser = (id: UUID) =>
  api.patch<unknown>(`/auth/admin-users/${id}/deactivate/`);

export const reactivateUser = (id: UUID) =>
  api.patch<unknown>(`/auth/admin-users/${id}/reactivate/`);