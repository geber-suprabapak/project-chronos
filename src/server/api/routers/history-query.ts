export function buildAttendanceListPath(
  resource: "attendance" | "attendances",
  userId?: string,
): string {
  const params = new URLSearchParams({ limit: "100" });

  if (userId) {
    params.set("user_id", userId);
  }

  return `/v1/admin/${resource}?${params.toString()}`;
}

export function buildAttendanceDateListPath(
  resource: "attendance" | "attendances",
  date: string,
): string {
  const params = new URLSearchParams({ date, limit: "100" });
  return `/v1/admin/${resource}?${params.toString()}`;
}

export function buildLeaveRequestsListPath(
  resource: "leave-requests" | "permits",
  userId?: string,
): string {
  const params = new URLSearchParams();

  if (userId) {
    params.set("user_id", userId);
  }

  const query = params.toString();
  return `/v1/admin/${resource}${query ? `?${query}` : ""}`;
}
