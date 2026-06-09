import api from "./axiosInstance";

export const getSchemes = () =>
  api.get("/schemes/");

export const createScheme = (body) =>
  api.post("/schemes/", body);

export const publishScheme = (id) =>
  api.post(`/schemes/${id}/publish/`);

export const closeScheme = (id) =>
  api.post(`/schemes/${id}/close/`);

export const getScheme = (id) => 
  api.get(`/schemes/${id}/`);

export const updateScheme = (id, body) => 
  api.patch(`/schemes/${id}/`, body);

export const reopenScheme = (id) =>
  api.post(`/schemes/${id}/reopen/`);

export const getSchemeFields = (id) =>
  api.get(`/schemes/${id}/fields/`);