export interface AttendanceListFilter {
  userId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}

export function buildAttendanceListPath(
  resource: "attendance" | "attendances",
  filterOrUserId?: string | AttendanceListFilter,
  pagination?: { limit: number; offset: number },
): string {
  const params = new URLSearchParams({
    limit: String(pagination?.limit ?? 100),
  });

  if (pagination) {
    params.set("offset", String(pagination.offset));
  }

  if (filterOrUserId) {
    if (filterOrUserId instanceof Object) {
      if (filterOrUserId.userId) {
        params.set("user_id", filterOrUserId.userId);
      }
      if (filterOrUserId.date) {
        params.set("date", filterOrUserId.date);
      }
      if (filterOrUserId.startDate) {
        params.set("start_date", filterOrUserId.startDate);
      }
      if (filterOrUserId.endDate) {
        params.set("end_date", filterOrUserId.endDate);
      }
    } else {
      params.set("user_id", filterOrUserId);
    }
  }

  return `/v1/admin/${resource}?${params.toString()}`;
}

export function buildAttendanceDateListPath(
  resource: "attendance" | "attendances",
  date: string,
  pagination?: { limit: number; offset: number },
): string {
  const params = new URLSearchParams({
    date,
    limit: String(pagination?.limit ?? 100),
  });
  if (pagination) {
    params.set("offset", String(pagination.offset));
  }
  return `/v1/admin/${resource}?${params.toString()}`;
}

export function buildAttendanceGetPath(
  resource: "attendance" | "attendances",
  id: string,
): string {
  return `/v1/admin/${resource}/${encodeURIComponent(id)}`;
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

export function buildLeaveRequestGetPath(
  resource: "leave-requests" | "permits",
  id: string,
): string {
  return `/v1/admin/${resource}/${encodeURIComponent(id)}`;
}
