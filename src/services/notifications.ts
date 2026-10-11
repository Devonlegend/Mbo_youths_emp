import api from "./axiosInstance";
import type { MessageResponse, UUID } from "@/types/common";
import type { AppNotification } from "@/types/notification";

export const getNotifications = () =>
  api.get<AppNotification[]>("/notifications/");

export const markNotificationRead = (id: UUID) =>
  api.post<MessageResponse>(`/notifications/${id}/read/`);

export const markAllNotificationsRead = () =>
  api.post<MessageResponse>("/notifications/read-all/");

export const dismissNotification = (id: UUID) =>
  api.delete<MessageResponse>(`/notifications/${id}/`);

export const clearAllNotifications = () =>
  api.delete<MessageResponse>("/notifications/clear/");