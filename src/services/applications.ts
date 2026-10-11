import api from "./axiosInstance";
import type { MessageResponse, Paginated, UUID } from "@/types/common";
import type {
  Application,
  ApplicationListItem,
  ApplicationListParams,
  ApplicationStatus,
  ApplicationsByScheme,
  ApprovedListResponse,
  PublishApprovalsResponse,
  ReviewApplicationRequest,
  ReviewApplicationResponse,
  SchemesOverviewItem,
  SubmitApplicationResponse,
} from "@/types/application";

// Body is multipart: a `payload` text part (see SubmitApplicationPayload)
// plus each document as a file part.
export const submitApplication = (body: FormData) =>
  api.post<SubmitApplicationResponse>("/applications/submit/", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getApplications = (
  page: number = 1,
  params: ApplicationListParams = {}
) =>
  api.get<Paginated<ApplicationListItem>>("/applications/", {
    params: { page, ...params },
  });

export const getApplication = (id: UUID) =>
  api.get<Application>(`/applications/${id}/`);

export const submitWaiver = (id: UUID) =>
  api.post<MessageResponse>(`/applications/${id}/waiver/`);

export const reviewApplication = (id: UUID, body: ReviewApplicationRequest) =>
  api.post<ReviewApplicationResponse>(`/applications/${id}/review/`, body);

export const getMyApplications = () =>
  api.get<Paginated<ApplicationListItem>>("/applications/mine/");

export const getSchemesOverview = () =>
  api.get<SchemesOverviewItem[]>("/applications/schemes-overview/");

export const publishSchemeApprovals = (schemeId: UUID) =>
  api.post<PublishApprovalsResponse>(`/applications/publish/${schemeId}/`);

export const getApplicationsByScheme = (
  schemeId: UUID,
  status?: ApplicationStatus
) =>
  api.get<ApplicationsByScheme>(`/applications/by-scheme/${schemeId}/`, {
    params: status ? { status } : {},
  });

export const getApprovedList = (schemeId: UUID) =>
  api.get<ApprovedListResponse>("/applications/approved-list/", {
    params: { scheme: schemeId },
  });

export const downloadApprovedListCsv = (schemeId: UUID, ward?: string) =>
  api.get<Blob>("/applications/approved-list/", {
    params: {
      scheme: schemeId,
      ward: ward || undefined,
      export: "csv",
    },
    responseType: "blob",
  });