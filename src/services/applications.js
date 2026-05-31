import api from "./axiosInstance";

export const submitApplication = (body) =>
  api.post("/applications/submit/", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getApplications = () =>
  api.get("/applications/");

export const getApplication = (id) =>
  api.get(`/applications/${id}/`);

export const submitWaiver = (id) =>
  api.post(`/applications/${id}/waiver/`);

export const reviewApplication = (id, body) =>
  api.post(`/applications/${id}/review/`, body);