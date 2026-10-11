import boundary from '../assets/data/pinamalayan-boundary.json';
import { containsMarkup, sanitizePlainText } from './plainTextInput';

export const PINAMALAYAN_BOUNDARY = boundary;
export const PINAMALAYAN_CENTER = { latitude: 13.0386691, longitude: 121.4801563 };
export const LOCATION_RESTRICTION_MESSAGE = 'Please choose a location within Pinamalayan, Oriental Mindoro.';
export const PINAMALAYAN_VIEWBOX = boundary.bbox.join(','); // west, south, east, north

// Literal browser code: Hermes can stringify compiled functions as [native code].
export const MAP_RING_CHECK_JS = `function(latitude, longitude, ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    var cross = (longitude - xi) * (yj - yi) - (latitude - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && longitude >= Math.min(xi, xj) && longitude <= Math.max(xi, xj)
      && latitude >= Math.min(yi, yj) && latitude <= Math.max(yi, yj)) return true;
    if ((yi > latitude) !== (yj > latitude)
      && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}`;

// Include points on the boundary; exclude holes and neighbouring municipalities.
export function isWithinRing(latitude: number, longitude: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = (longitude - xi) * (yj - yi) - (latitude - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && longitude >= Math.min(xi, xj) && longitude <= Math.max(xi, xj)
      && latitude >= Math.min(yi, yj) && latitude <= Math.max(yi, yj)) return true;
    if ((yi > latitude) !== (yj > latitude)
      && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function isWithinPinamalayan(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const [west, south, east, north] = boundary.bbox;
  if (latitude < south || latitude > north || longitude < west || longitude > east) return false;
  const [outer, ...holes] = boundary.geometry.coordinates;
  return isWithinRing(latitude, longitude, outer) && !holes.some(ring => isWithinRing(latitude, longitude, ring));
}

export function locationSearchText(value: string): string {
  const text = sanitizePlainText(value).replace(/\s+/g, ' ');
  if (containsMarkup(text) || text.length > 120) throw new Error('Enter a place name using plain text, up to 120 characters.');
  return text;
}

export function safeLocationAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = sanitizePlainText(value).replace(/\s+/g, ' ');
  return text && text.length <= 500 && !containsMarkup(text) ? text : null;
}

export interface LocationSearchResult { place_id: string; lat: number; lon: number; display_name: string }

export function filterPinamalayanResults(data: unknown): LocationSearchResult[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item, i) => {
    if (!item || typeof item !== 'object') return [];
    const numeric = (value: unknown) => typeof value === 'number' ? value
      : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    const lat = numeric(item.lat), lon = numeric(item.lon);
    const name = safeLocationAddress(item.display_name);
    return isWithinPinamalayan(lat, lon) && name
      ? [{ place_id: String(item.place_id ?? i), lat, lon, display_name: name }] : [];
  }).slice(0, 5);
}
