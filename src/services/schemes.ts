import api from "./axiosInstance";
import type { Paginated, UUID } from "@/types/common";
import type {
  CreateProviderRequest,
  Cycle,
  PublishSchemeResponse,
  Scheme,
  SchemeActiveResponse,
  SchemeField,
  SchemeProvider,
  SchemeWriteRequest,
} from "@/types/scheme";

export const getSchemes = () =>
  api.get<Paginated<Scheme>>("/schemes/");

export const createScheme = (body: SchemeWriteRequest) =>
  api.post<Scheme>("/schemes/", body);

export const publishScheme = (id: UUID) =>
  api.post<PublishSchemeResponse>(`/schemes/${id}/publish/`);

export const closeScheme = (id: UUID) =>
  api.post<SchemeActiveResponse>(`/schemes/${id}/close/`);

export const getScheme = (id: UUID) =>
  api.get<Scheme>(`/schemes/${id}/`);

export const updateScheme = (id: UUID, body: Partial<SchemeWriteRequest>) =>
  api.patch<Scheme>(`/schemes/${id}/`, body);

export const reopenScheme = (id: UUID) =>
  api.post<SchemeActiveResponse>(`/schemes/${id}/reopen/`);

export const getSchemeFields = (id: UUID) =>
  api.get<SchemeField[]>(`/schemes/${id}/fields/`);

export const getCycles = () =>
  api.get<Paginated<Cycle>>("/schemes/cycles/");

// TESTING FOR PROVIDERS

export const getProviders = () =>
  api.get<Paginated<SchemeProvider>>("/schemes/providers/");

export const createProvider = (body: CreateProviderRequest) =>
  api.post<SchemeProvider>("/schemes/providers/", body);

export const deleteProvider = (id: UUID) =>
  api.delete<void>(`/schemes/providers/${id}/`);