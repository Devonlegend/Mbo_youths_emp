import api from "./axiosInstance";

export const verifyNIN = (body) =>
  api.post("/verification/nin/", body);

export const verifyBank = (body) =>
  api.post("/verification/bank/", body);

export const getBanks = () =>
  api.get("/verification/banks/");

export const uploadDocument = (formData) =>
  api.post("/verification/upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });