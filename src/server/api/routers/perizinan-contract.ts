/** Astra's admin leave-request PATCH payload for reopening a rejection. */
export function buildPendingLeaveRequestReset() {
  return {
    approval_status: "pending" as const,
    status: false,
    rejection_reason: null,
    rejected_at: null,
  };
}
