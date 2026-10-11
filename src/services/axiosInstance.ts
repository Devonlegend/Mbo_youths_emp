import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE_URL = "/api/proxy";

// Axios request config plus our own retry flag
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _isRetry?: boolean;
}

interface QueuedRequest {
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // sends httpOnly cookies with every request
});

const PUBLIC_AUTH_PATHS = [
  "/auth/login/",
  "/auth/register/",
  "/auth/otp/send/",
  "/auth/otp/resend/",
  "/auth/otp/verify/",
  "/auth/password/reset/request/",
  "/auth/password/reset/verify/",
  "/auth/password/reset/confirm/",
];

function isPublicAuthRequest(url: string): boolean {
  return PUBLIC_AUTH_PATHS.some((path) => url === path || url.startsWith(path));
}

// ── TOKEN REFRESH INTERCEPTOR ──────────────────────────────────────────
// When any request comes back with 401 (token expired), this interceptor:
// 1. Calls /auth/token/refresh/ to get a new access token (sets new cookie)
// 2. Retries the original request automatically
// 3. If refresh also fails (refresh token expired) → sends user to login
//
// _isRetry flag prevents infinite loops — if the retry also 401s, we stop.

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

function processQueue(error: unknown): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  // Any 2xx response — pass straight through
  (response) => response,

  // Any error response
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    // Only handle 401 and only if we haven't already retried this request
    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._isRetry ||
      isPublicAuthRequest(originalRequest.url ?? "") ||
      originalRequest.url === "/auth/token/refresh/" ||
      originalRequest.url === "/auth/me/"
    ) {
      return Promise.reject(error);
    }

    // If a refresh is already in progress, queue this request until done
    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    // Mark this request as retried so we don't loop
    originalRequest._isRetry = true;
    isRefreshing = true;

    try {
      // Ask backend to rotate the access cookie using the refresh cookie
      await api.post("/auth/token/refresh/");

      // Refresh succeeded — process any queued requests
      processQueue(null);

      // Retry the original request with the new cookie
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh token is also expired — clear queue and send to login
      processQueue(refreshError);
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;