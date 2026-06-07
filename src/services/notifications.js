import api from "./axiosInstance";

export const getNotifications = () =>
  api.get("/notifications/");

export const markNotificationRead = (id) =>
  api.post(`/notifications/${id}/read/`);

export const markAllNotificationsRead = () =>
  api.post("/notifications/read-all/");

export const dismissNotification = (id) =>
  api.delete(`/notifications/${id}/`);

export const clearAllNotifications = () =>
  api.delete("/notifications/clear/");