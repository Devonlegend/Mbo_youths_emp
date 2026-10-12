import api from "./axiosInstance";
import type { Paginated, UUID } from "@/types/common";
import type {
  Appeal,
  AppealListParams,
  Award,
  AwardActionRequest,
  AwardListParams,
  AwardsExportParams,
  AwardsPage,
  DisburseRequest,
  Installment,
  RenewalQueueItem,
  RenewalQueueParams,
  ReviewAppealRequest,
  VerifyInstallmentRequest,
} from "@/types/award";

// ── Student ─────────────────────────────────────────────────────────────────

// Plain array, not paginated.
export const getMyAwards = () =>
  api.get<Award[]>("/awards/mine/");

// Full detail with the installment timeline (owner or staff).
export const getAward = (id: UUID) =>
  api.get<Award>(`/awards/${id}/`);

// Body is multipart: cgpa, cgpa_scale, level, transcript (file).
export const renewAward = (id: UUID, body: FormData) =>
  api.post<Installment>(`/awards/${id}/renew/`, body, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// Body is multipart: reason, evidence (file). Returns 201.
export const submitAwardAppeal = (id: UUID, body: FormData) =>
  api.post<Appeal>(`/awards/${id}/appeal/`, body, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// ── Staff (verifier and above) ──────────────────────────────────────────────

export const getAwards = (page: number = 1, params: AwardListParams = {}) =>
  api.get<AwardsPage>("/awards/", { params: { page, ...params } });

export const getRenewalQueue = (
  page: number = 1,
  params: RenewalQueueParams = {}
) =>
  api.get<Paginated<RenewalQueueItem>>("/awards/renewals/", {
    params: { page, ...params },
  });

export const verifyInstallment = (id: UUID, body: VerifyInstallmentRequest) =>
  api.post<RenewalQueueItem>(`/awards/installments/${id}/verify/`, body);

export const getAppeals = (page: number = 1, params: AppealListParams = {}) =>
  api.get<Paginated<Appeal>>("/awards/appeals/", {
    params: { page, ...params },
  });

export const reviewAppeal = (id: UUID, body: ReviewAppealRequest) =>
  api.post<Appeal>(`/awards/appeals/${id}/review/`, body);

export const downloadAwardsCsv = (params: AwardsExportParams = {}) =>
  api.get<Blob>("/awards/export/", {
    params: { ...params, export: "csv" },
    responseType: "blob",
  });

// ── Admin only ──────────────────────────────────────────────────────────────

export const disburseInstallment = (id: UUID, body: DisburseRequest = {}) =>
  api.post<Installment>(`/awards/installments/${id}/disburse/`, body);

export const suspendAward = (id: UUID, body: AwardActionRequest = {}) =>
  api.post<Award>(`/awards/${id}/suspend/`, body);

export const terminateAward = (id: UUID, body: AwardActionRequest = {}) =>
  api.post<Award>(`/awards/${id}/terminate/`, body);