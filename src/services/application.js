import api from "./axiosInstance";

export const submitApplication = (body) =>
  api.post("/applications/submit/", body);

export const getApplications = () =>
  api.get("/applications/");

export const submitWaiver = (id) =>
  api.post(`/applications/${id}/waiver/`);

export const reviewApplication = (id, body) =>
  api.post(`/applications/${id}/review/`, body);