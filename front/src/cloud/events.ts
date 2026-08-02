export const CLOUD_DATA_CHANGED_EVENT = "dartflow:cloud-data-changed";

export function notifyCloudDataChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CLOUD_DATA_CHANGED_EVENT));
}
