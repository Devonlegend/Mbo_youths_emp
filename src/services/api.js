import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

// -- HELPERS --

function getToken() {
  return localStorage.getItem("access_token");
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach token to every request automatically
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// -- AUTH --

export const register = (body) =>
  // body: { email, phone_number, password, role }
  api.post("/auth/register/", body);

export const login = (body) =>
  // body: { email, password } → returns { otp_required: true }
  api.post("/auth/login/", body);

export const otpLogin = (body) =>
  // body: { email, code } → returns simplejwt tokens
  api.post("/auth/otp/login/", body);

export const getMe = () =>
  // returns user profile + role
  api.get("/auth/me/");

// -- STUDENTS --

export const getStudentProfile = () => api.get("/students/me/");
export const updateStudentProfile = (body) => api.patch("/students/me/", body);
export const getStudentStats = () => api.get("/students/stats/");
export const getAcademicRecords = () => api.get("/students/academic-records/");
export const addAcademicRecord = (body) => api.post("/students/academic-records/", body);
export const getBankDetail = () => api.get("/students/bank-detail/");
export const addBankDetail = (body) =>
  // Paystack name verification runs automatically
  api.post("/students/bank-detail/", body);

// -- SCHEMES --

export const getSchemes = () => api.get("/schemes/");
export const createScheme = (body) =>
  // Admin only
  api.post("/schemes/", body);
export const publishScheme = (id) => api.post(`/schemes/${id}/publish/`);
export const closeScheme = (id) => api.post(`/schemes/${id}/close/`);

// -- APPLICATIONS --

export const submitApplication = (body) =>
  // body: { scheme_id }
  api.post("/applications/submit/", body);
export const submitWaiver = (id) => api.post(`/applications/${id}/waiver/`);
export const reviewApplication = (id, body) =>
  // body: { approve: boolean, notes: string }
  api.post(`/applications/${id}/review/`, body);

// -- VERIFICATION --

export const verifyNIN = (body) =>
  // body: { nin }
  api.post("/verification/nin/", body);
export const verifyBank = (body) =>
  // body: { account_number, bank_code }
  api.post("/verification/bank/", body);
export const getBanks = () => api.get("/verification/banks/");

export default api;