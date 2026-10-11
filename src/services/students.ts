import api from "./axiosInstance";
import type { Paginated, UUID } from "@/types/common";
import type {
  BankDetail,
  BankDetailUpdate,
  Student,
  StudentStats,
  VerifyStudentRequest,
  VerifyStudentResponse,
} from "@/types/student";

type JsonBody = Record<string, unknown>;

export const getStudentProfile = () =>
  api.get<Student>("/students/me/");

// No PATCH handler exists for /students/me/ on the backend (expected 405).
export const updateStudentProfile = (body: JsonBody) =>
  api.patch<unknown>("/students/me/", body);

export const getStudentStats = () =>
  api.get<StudentStats>("/students/stats/");

export const getStudents = (page: number = 1) =>
  api.get<Paginated<Student>>("/students/", { params: { page } });

export const getStudentById = (id: UUID) =>
  api.get<Student>(`/students/${id}/`);

// No backend handler exists for this endpoint (expected 404).
export const getAcademicRecords = () =>
  api.get<unknown>("/students/academic-records/");

// No backend handler exists for this endpoint (expected 404).
export const addAcademicRecord = (body: JsonBody) =>
  api.post<unknown>("/students/academic-records/", body);

export const getBankDetail = () =>
  api.get<BankDetail>("/students/bank/");

export const updateBankDetail = (data: BankDetailUpdate) =>
  api.patch<BankDetail>("/students/bank/", data);

// No backend handler exists for this endpoint (expected 405).
export const addBankDetail = (body: JsonBody) =>
  api.post<unknown>("/students/bank-detail/", body);

export const verifyStudent = (id: UUID, body: VerifyStudentRequest) =>
  api.patch<VerifyStudentResponse>(`/students/${id}/verify/`, body);