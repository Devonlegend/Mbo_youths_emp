import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // ← needed for httpOnly cookies to work
});

// -- AUTH --

export const register = (formData) =>
  // formData: multipart/form-data with all fields + files
  api.post("/auth/register/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const login = (body) =>
  // body: { email, password } → returns { otp_required: true, email }
  api.post("/auth/login/", body);

export const otpSend = (body) =>
  // body: { email }
  api.post("/auth/otp/send/", body);

export const otpVerify = (body) =>
  // body: { email, code } → sets httpOnly cookies
  api.post("/auth/otp/verify/", body);

export const otpResend = (body) =>
  // body: { email }
  api.post("/auth/otp/resend/", body);

export const getMe = () =>
  api.get("/auth/me/");

export const refreshToken = () =>
  api.post("/auth/token/refresh/");

export const logout = () =>
  api.post("/auth/logout/");

// -- STUDENTS --

export const getStudentProfile = () => api.get("/students/me/");
export const updateStudentProfile = (body) => api.patch("/students/me/", body);
export const getStudentStats = () => api.get("/students/stats/");
export const getAcademicRecords = () => api.get("/students/academic-records/");
export const addAcademicRecord = (body) => api.post("/students/academic-records/", body);
export const getBankDetail = () => api.get("/students/bank-detail/");
export const addBankDetail = (body) => api.post("/students/bank-detail/", body);

// -- SCHEMES --

export const getSchemes = () => api.get("/schemes/");
export const createScheme = (body) => api.post("/schemes/", body);
export const publishScheme = (id) => api.post(`/schemes/${id}/publish/`);
export const closeScheme = (id) => api.post(`/schemes/${id}/close/`);

// -- APPLICATIONS --

export const submitApplication = (body) => api.post("/applications/submit/", body);
export const submitWaiver = (id) => api.post(`/applications/${id}/waiver/`);
export const reviewApplication = (id, body) => api.post(`/applications/${id}/review/`, body);

// -- VERIFICATION --

export const verifyNIN = (body) => api.post("/verification/nin/", body);
export const verifyBank = (body) => api.post("/verification/bank/", body);
export const getBanks = () => api.get("/verification/banks/");

// -- FORGOT PASSWORD --
export const forgotPasswordRequest = (body) =>
  // body: { email } → sends OTP to that email
  api.post("/auth/password/reset/request/", body);

export const forgotPasswordVerifyOtp = (body) =>
  // body: { email, code } → confirms OTP is valid
  api.post("/auth/password/reset/verify/", body);

export const forgotPasswordReset = (body) =>
  // body: { email, code, new_password } → resets the password
  api.post("/auth/password/reset/confirm/", body);

export default api;