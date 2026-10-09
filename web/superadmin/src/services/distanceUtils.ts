/**
 * Calculates the distance between two points in kilometers using the Haversine formula.
 */
export const calculateDistance = (lat1: any, lon1: any, lat2: any, lon2: any): number => {
  const p1 = { lat: parseFloat(lat1), lon: parseFloat(lon1) };
  const p2 = { lat: parseFloat(lat2), lon: parseFloat(lon2) };

  if (isNaN(p1.lat) || isNaN(p1.lon) || isNaN(p2.lat) || isNaN(p2.lon)) {
    return Infinity;
  }

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(p2.lat - p1.lat);
  const dLon = deg2rad(p2.lon - p1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(p1.lat)) * Math.cos(deg2rad(p2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

export const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)} km`;
};
