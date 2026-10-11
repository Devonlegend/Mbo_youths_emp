import api from "./axiosInstance";
import type {
  BanksResponse,
  ResolveBankRequest,
  ResolveBankResponse,
} from "@/types/verification";

type JsonBody = Record<string, unknown>;

// No backend route exists for /verification/nin/ (expected 404).
export const verifyNIN = (body: JsonBody) =>
  api.post<unknown>("/verification/nin/", body);

export const verifyBank = (body: ResolveBankRequest) =>
  api.post<ResolveBankResponse>("/verification/bank/", body);

export const getBanks = () =>
  api.get<BanksResponse>("/verification/banks/");

// No backend route exists for /verification/upload/ (expected 404).
// Application documents are uploaded as part of the submit request.
export const uploadDocument = (formData: FormData) =>
  api.post<unknown>("/verification/upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });