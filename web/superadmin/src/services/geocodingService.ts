export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeAddressDetails {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  hamlet?: string;
  town?: string;
  city_district?: string;
  county?: string;
  city?: string;
  locality?: string;
  state?: string;
  country?: string;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  addressDetails: GeocodeAddressDetails;
}

export interface ReverseGeocodeResult {
  address: string;
  fullAddress: string;
  rawAddress: GeocodeAddressDetails;
  displayName?: string;
}

export const geocodingService = {
  /**
   * Geocodes an address string into coordinates and address details.
   * Uses Nominatim with fallback to Photon API for CORS reliability.
   */
  async searchAddress(query: string): Promise<GeocodeResult | null> {
    if (!query || !query.trim()) return null;
    const cleanQuery = query.trim();

    // Primary: Nominatim (no custom headers to avoid CORS preflight OPTIONS rejection)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const item = data[0];
          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
            addressDetails: item.address || {}
          };
        }
      }
    } catch (e) {
      console.warn("Nominatim search failed, attempting fallback...", e);
    }

    // Fallback: Photon API (OpenStreetMap-backed, fully CORS-enabled)
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanQuery)}&limit=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const feature = data.features[0];
          const [lon, lat] = feature.geometry.coordinates;
          const props = feature.properties || {};
          const nameParts = [
            props.name,
            props.street,
            props.district || props.suburb,
            props.city || props.county,
            props.state,
            props.country
          ].filter(Boolean);
          const displayName = nameParts.join(', ');
          return {
            latitude: lat,
            longitude: lon,
            displayName: displayName || cleanQuery,
            addressDetails: {
              road: props.street,
              neighbourhood: props.district,
              suburb: props.suburb,
              city: props.city,
              county: props.county,
              state: props.state,
              country: props.country,
              locality: props.city || props.district || props.suburb
            }
          };
        }
      }
    } catch (e) {
      console.warn("Photon search fallback failed:", e);
    }

    return null;
  },

  /**
   * Reverse geocodes coordinates into address details.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    // Primary: Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const addr: GeocodeAddressDetails = data.address;
          const village = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet;
          const mandal = addr.city_district || addr.county || addr.town;
          const parts: string[] = [];
          if (village) parts.push(village);
          if (mandal) parts.push(mandal.toLowerCase().includes('mandal') ? mandal : `${mandal} Mandal`);
          const conciseAddress = Array.from(new Set(parts)).join(', ');

          const fullParts: string[] = [];
          if (addr.house_number) fullParts.push(`H.No ${addr.house_number}`);
          if (addr.road) fullParts.push(addr.road);
          if (addr.neighbourhood) fullParts.push(addr.neighbourhood);
          if (addr.suburb) fullParts.push(addr.suburb);
          if (addr.village) fullParts.push(addr.village);
          if (addr.hamlet) fullParts.push(addr.hamlet);
          if (addr.town) fullParts.push(addr.town);
          if (mandal) fullParts.push(mandal.toLowerCase().includes('mandal') ? mandal : `${mandal} Mandal`);
          if (addr.city && !fullParts.includes(addr.city)) fullParts.push(addr.city);
          if (addr.state) fullParts.push(addr.state);
          const fullAddressStr = fullParts.join(', ');

          return {
            address: conciseAddress || fullAddressStr || data.display_name,
            fullAddress: fullAddressStr || data.display_name,
            rawAddress: addr,
            displayName: data.display_name
          };
        }
      }
    } catch (e) {
      console.warn("Nominatim reverse geocode failed, attempting fallback...", e);
    }

    // Fallback 1: Photon API (CORS-enabled)
    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const props = data.features[0].properties || {};
          const village = props.name || props.district || props.suburb;
          const mandal = props.city || props.county;
          const parts: string[] = [];
          if (village) parts.push(village);
          if (mandal) parts.push(mandal.toLowerCase().includes('mandal') ? mandal : `${mandal} Mandal`);
          const conciseAddress = Array.from(new Set(parts)).join(', ');

          const fullParts = [
            props.name,
            props.housenumber,
            props.street,
            props.district || props.suburb,
            props.city || props.county,
            props.state,
            props.country
          ].filter(Boolean);
          const fullAddressStr = fullParts.join(', ');

          const addrDetails: GeocodeAddressDetails = {
            house_number: props.housenumber,
            road: props.street,
            neighbourhood: props.district,
            suburb: props.suburb,
            city: props.city,
            county: props.county,
            state: props.state,
            country: props.country,
            locality: props.city || props.district || props.suburb
          };

          return {
            address: conciseAddress || fullAddressStr,
            fullAddress: fullAddressStr,
            rawAddress: addrDetails,
            displayName: fullAddressStr
          };
        }
      }
    } catch (e) {
      console.warn("Photon reverse geocode fallback failed:", e);
    }

    // Fallback 2: BigDataCloud (CORS-enabled)
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const village = data.locality || data.city;
          const mandal = data.principalSubdivision;
          const parts: string[] = [];
          if (village) parts.push(village);
          if (mandal) parts.push(mandal);
          const conciseAddress = parts.join(', ');
          const fullAddressStr = [data.locality, data.city, data.principalSubdivision, data.countryName].filter(Boolean).join(', ');
          return {
            address: conciseAddress || fullAddressStr,
            fullAddress: fullAddressStr,
            rawAddress: {
              city: data.city,
              locality: data.locality,
              state: data.principalSubdivision,
              country: data.countryName
            }
          };
        }
      }
    } catch (e) {
      console.warn("BigDataCloud reverse geocode fallback failed:", e);
    }

    return null;
  },

  /**
   * Geocodes an address string into latitude and longitude.
   */
  async getCoordinates(address: string, location: string): Promise<Coordinates | null> {
    const fullAddress = `${address}, ${location}`;
    let result = await this.searchAddress(fullAddress);
    if (result) {
      return { latitude: result.latitude, longitude: result.longitude };
    }
    if (location) {
      result = await this.searchAddress(location);
      if (result) {
        return { latitude: result.latitude, longitude: result.longitude };
      }
    }
    return null;
  }
};
