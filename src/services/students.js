import api from "./axiosInstance";

export const getStudentProfile = () =>
  api.get("/students/me/");

export const updateStudentProfile = (body) =>
  api.patch("/students/me/", body);

export const getStudentStats = () =>
  api.get("/students/stats/");

export const getStudents = () =>
  api.get("/students/");

export const getStudentById = (id) =>
  api.get(`/students/${id}/`);

export const getAcademicRecords = () =>
  api.get("/students/academic-records/");

export const addAcademicRecord = (body) =>
  api.post("/students/academic-records/", body);

export const getBankDetail = () =>
  api.get("/students/bank-detail/");

export const addBankDetail = (body) =>
  api.post("/students/bank-detail/", body);