export interface ScheduleUpdateFields {
  mulaiMasuk?: string;
  selesaiMasuk?: string;
  mulaiPulang?: string;
  selesaiPulang?: string;
  kompensasiWaktu?: number;
  isActive?: boolean;
}

/**
 * Translate only fields the Chronos admin explicitly changed into Astra's
 * schedule-update contract. In particular, do not send identity/day fields
 * when updating an existing schedule by its Astra UUID.
 */
export function buildScheduleUpdatePayload(data: ScheduleUpdateFields) {
  const payload: Record<string, string | number | boolean> = {};

  if (data.mulaiMasuk !== undefined) payload.start_time = data.mulaiMasuk;
  if (data.selesaiMasuk !== undefined) payload.end_time = data.selesaiMasuk;
  if (data.mulaiPulang !== undefined) {
    payload.start_checkout = data.mulaiPulang;
  }
  if (data.selesaiPulang !== undefined) {
    payload.end_checkout = data.selesaiPulang;
  }
  if (data.kompensasiWaktu !== undefined) {
    payload.grace_period_minutes = data.kompensasiWaktu;
  }
  if (data.isActive !== undefined) payload.is_active = data.isActive;

  return payload;
}
