import axios from 'axios'

// Base URL — points to your Django server
const BASE_URL = 'http://127.0.0.1:8000'

// Create axios instance with defaults
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh JWT on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
        const newAccess = res.data.access
        localStorage.setItem('access_token', newAccess)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ─────────────────────────────────────────────────────────
export const authAPI = {
  register:     (data) => api.post('/auth/register/', data),
  login:        (data) => api.post('/auth/login/', data),
  me:           ()     => api.get('/auth/me/'),
  logout:       (data) => api.post('/auth/logout/', data),
  refreshToken: (data) => api.post('/auth/token/refresh/', data),
}

// ── Students ──────────────────────────────────────────────────────
export const studentAPI = {
  list:             ()            => api.get('/students/'),
  detail:           (id)         => api.get(`/students/${id}/`),
  update:           (id, data)   => api.patch(`/students/${id}/`, data),
  stats:            ()           => api.get('/students/stats/'),
  checkEligibility: (id, params) => api.get(`/students/${id}/eligibility-check/`, { params }),
  myProfile:        ()           => api.get('/students/me/'),
  updateMyProfile:  (data)       => api.patch('/students/me/', data),
}

// ── Academic Records ──────────────────────────────────────────────
export const academicAPI = {
  list:   ()       => api.get('/students/academic-records/'),
  create: (data)   => api.post('/students/academic-records/', data),
  update: (id, data) => api.patch(`/students/academic-records/${id}/`, data),
}

// ── Bank Details ──────────────────────────────────────────────────
export const bankAPI = {
  get:    ()     => api.get('/students/bank-detail/'),
  save:   (data) => api.post('/students/bank-detail/', data),
  update: (data) => api.patch('/students/bank-detail/', data),
}

// ── Schemes ───────────────────────────────────────────────────────
export const schemeAPI = {
  list:    (params) => api.get('/schemes/', { params }),
  detail:  (id)     => api.get(`/schemes/${id}/`),
  create:  (data)   => api.post('/schemes/', data),
  update:  (id, data) => api.patch(`/schemes/${id}/`, data),
  publish: (id)     => api.post(`/schemes/${id}/publish/`),
  close:   (id)     => api.post(`/schemes/${id}/close/`),
}

// ── Applications ──────────────────────────────────────────────────
export const applicationAPI = {
  list:         (params)     => api.get('/applications/', { params }),
  detail:       (id)         => api.get(`/applications/${id}/`),
  submit:       (data)       => api.post('/applications/submit/', data),
  submitWaiver: (id)         => api.post(`/applications/${id}/waiver/`),
  review:       (id, data)   => api.post(`/applications/${id}/review/`, data),
  myList:       ()           => api.get('/applications/mine/'),
  flagged:      ()           => api.get('/applications/flagged/'),
  history:      (id)         => api.get(`/applications/${id}/history/`),
}

// ── Disbursements ─────────────────────────────────────────────────
export const disbursementAPI = {
  list:      ()       => api.get('/disbursements/'),
  detail:    (id)     => api.get(`/disbursements/${id}/`),
  create:    (data)   => api.post('/disbursements/', data),
  authorize: (id)     => api.post(`/disbursements/${id}/authorize/`),
}

// ── Verification ──────────────────────────────────────────────────
export const verificationAPI = {
  verifyNIN:   (data) => api.post('/verification/nin/', data),
  resolveBank: (data) => api.post('/verification/bank/', data),
  getBanks:    ()     => api.get('/verification/banks/'),
}

// ── Audit ─────────────────────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/audit/', { params }),
}

export default api