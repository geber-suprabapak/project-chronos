export interface AstraLocation {
  id: string;
  school_id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export function sortAstraLocations(
  locations: readonly AstraLocation[],
): AstraLocation[] {
  return [...locations].sort((a, b) => {
    const aCreatedAt = a.created_at ? Date.parse(a.created_at) : Number.NaN;
    const bCreatedAt = b.created_at ? Date.parse(b.created_at) : Number.NaN;
    const aHasCreatedAt = Number.isFinite(aCreatedAt);
    const bHasCreatedAt = Number.isFinite(bCreatedAt);

    if (aHasCreatedAt && bHasCreatedAt && aCreatedAt !== bCreatedAt) {
      return aCreatedAt - bCreatedAt;
    }
    if (aHasCreatedAt !== bHasCreatedAt) {
      return aHasCreatedAt ? -1 : 1;
    }

    return a.id.localeCompare(b.id);
  });
}

export function getAstraDefaultLocation(
  locations: readonly AstraLocation[],
): AstraLocation | undefined {
  return sortAstraLocations(locations)[0];
}

export function getAstraPrimaryLocation(
  locations: readonly AstraLocation[],
): AstraLocation | undefined {
  const ordered = sortAstraLocations(locations);
  return ordered.find((location) => location.is_active) ?? ordered[0];
}

export function findAstraLocationByUiId(
  locations: readonly AstraLocation[],
  uiId: number,
): AstraLocation | undefined {
  const ordered = sortAstraLocations(locations);
  const legacyIdMatch = ordered.find(
    (location) => location.id === String(uiId),
  );
  return legacyIdMatch ?? ordered[uiId - 1];
}

export function getAstraLocationUiId(
  locations: readonly AstraLocation[],
  astraId: string,
): number | undefined {
  const index = sortAstraLocations(locations).findIndex(
    (location) => location.id === astraId,
  );
  return index >= 0 ? index + 1 : undefined;
}

export function isAstraDefaultLocation(
  locations: readonly AstraLocation[],
  astraId: string,
): boolean {
  return getAstraDefaultLocation(locations)?.id === astraId;
}

export function mapAstraLocations(locations: readonly AstraLocation[]) {
  return sortAstraLocations(locations).map((location, index) =>
    mapAstraLocation(location, index + 1),
  );
}

export function mapAstraLocation(loc: AstraLocation, indexFallback?: number) {
  const safeId =
    indexFallback !== undefined && indexFallback >= 1
      ? Math.floor(indexFallback)
      : 1;

  return {
    id: safeId,
    astraId: loc.id,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    distance: loc.radius_meters,
    isActive: loc.is_active,
    createdAt: loc.created_at ? new Date(loc.created_at) : new Date(),
    updatedAt: loc.updated_at ? new Date(loc.updated_at) : new Date(),
  };
}
