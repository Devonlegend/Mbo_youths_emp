// Request and response bodies for the /auth/ endpoints.
// Shapes are taken from accounts/views.py.

export interface LoginRequest {
  email: string;
  password: string;
}

/** Login only validates credentials; the OTP step issues the cookies. */
export interface LoginResponse {
  otp_required: boolean;
  email: string;
}

export interface OtpEmailRequest {
  email: string;
}

export interface OtpVerifyRequest {
  email: string;
  code: string;
}

export interface RegisterResponse {
  message: string;
  email: string;
}

export interface PasswordResetRequestBody {
  email: string;
}

export interface PasswordResetVerifyBody {
  email: string;
  code: string;
}

export interface PasswordResetConfirmBody {
  email: string;
  code: string;
  new_password: string;
}