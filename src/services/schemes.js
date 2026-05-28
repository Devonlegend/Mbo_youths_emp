import api from "./axiosInstance";

export const getSchemes = () =>
  api.get("/schemes/");

export const createScheme = (body) =>
  api.post("/schemes/", body);

export const publishScheme = (id) =>
  api.post(`/schemes/${id}/publish/`);

export const closeScheme = (id) =>
  api.post(`/schemes/${id}/close/`);