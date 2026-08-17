import api from "./axiosInstance";

export const submitApplication = (body) =>
  api.post("/applications/submit/", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });


export const getApplications = (page = 1, params = {}) =>
  api.get("/applications/", { params: { page, ...params } });

export const getApplication = (id) =>
  api.get(`/applications/${id}/`);

export const submitWaiver = (id) =>
  api.post(`/applications/${id}/waiver/`);

export const reviewApplication = (id, body) =>
  api.post(`/applications/${id}/review/`, body);

export const getMyApplications = () =>
  api.get("/applications/mine/");

export const getSchemesOverview = () =>
  api.get("/applications/schemes-overview/");

export const publishSchemeApprovals = (schemeId) =>
  api.post(`/applications/publish/${schemeId}/`);

export const getApplicationsByScheme = (schemeId, status) =>
  api.get(`/applications/by-scheme/${schemeId}/`, {
    params: status ? { status } : {},
  });

export const getApprovedList = (schemeId) =>
  api.get("/applications/approved-list/", { params: { scheme: schemeId } });

export const downloadApprovedListCsv = (schemeId, ward) =>
  api.get("/applications/approved-list/", {
    params: {
      scheme: schemeId,
      ward: ward || undefined,
      export: "csv",
    },
    responseType: "blob",
  });