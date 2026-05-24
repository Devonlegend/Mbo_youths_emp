const BASE_URL = "http://127.0.0.1:8000";

//-- HELPERS --

function getToken() {
  return localStorage.getItem("access_token");
}

async function request(method, path, body = null, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = `Bearer ${getToken()}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// --AUTH --

export const register = (body) =>
  // body: { email, phone_number, password, role }
  request("POST", "/auth/register/", body);

export const login = (body) =>
  // body: { email, password } → returns { otp_required: true }
  request("POST", "/auth/login/", body);

export const otpLogin = (body) =>
  // body: { email, code } → returns simplejwt tokens
  request("POST", "/auth/otp/login/", body);

export const getMe = () =>
  // returns user profile + role
  request("GET", "/auth/me/", null, true);

// --STUDENTS --

export const getStudentProfile = () =>
  request("GET", "/students/me/", null, true);

export const updateStudentProfile = (body) =>
  request("PATCH", "/students/me/", body, true);

export const getStudentStats = () =>
  request("GET", "/students/stats/", null, true);

export const getAcademicRecords = () =>
  request("GET", "/students/academic-records/", null, true);

export const addAcademicRecord = (body) =>
  request("POST", "/students/academic-records/", body, true);

export const getBankDetail = () =>
  request("GET", "/students/bank-detail/", null, true);

export const addBankDetail = (body) =>
  // Paystack name verification runs automatically
  request("POST", "/students/bank-detail/", body, true);

// -- SCHEMES --

export const getSchemes = () =>
  request("GET", "/schemes/", null, true);

export const createScheme = (body) =>
  // Admin only
  request("POST", "/schemes/", body, true);

export const publishScheme = (id) =>
  request("POST", `/schemes/${id}/publish/`, null, true);

export const closeScheme = (id) =>
  request("POST", `/schemes/${id}/close/`, null, true);

// -- APPLICATIONS --

export const submitApplication = (body) =>
  // body: { scheme_id }
  request("POST", "/applications/submit/", body, true);

export const submitWaiver = (id) =>
  request("POST", `/applications/${id}/waiver/`, null, true);

export const reviewApplication = (id, body) =>
  // body: { approve: boolean, notes: string }
  request("POST", `/applications/${id}/review/`, body, true);

// -- VERIFICATION --

export const verifyNIN = (body) =>
  // body: { nin }
  request("POST", "/verification/nin/", body, true);

export const verifyBank = (body) =>
  // body: { account_number, bank_code }
  request("POST", "/verification/bank/", body, true);

export const getBanks = () =>
  // returns list of Nigerian banks
  request("GET", "/verification/banks/", null, true);