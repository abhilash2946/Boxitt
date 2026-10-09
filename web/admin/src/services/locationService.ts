import { supabase } from './supabase';
import { Location, Court } from '../types';
import { geocodingService } from './geocodingService';

export interface LocationWithAdmin extends Location {
  adminUsername?: string;
}

export const locationService = {
  async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*, box_pricing(*), courts(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const locations = (data || []).map(loc => {
      const defaultPricing = loc.box_pricing?.find((p: any) => p.duration_hours === 1 && p.rule_type === 'default' && p.category === 'morning')
                          || loc.box_pricing?.find((p: any) => p.duration_hours === 1 && p.rule_type === 'default');

      const advancePrices = (loc.box_pricing || [])
        .map((p: any) => Number(p.advance_price ?? p.advancePrice))
        .filter((v: number) => !isNaN(v) && v > 0);
      const lowestAdvance = advancePrices.length > 0 ? Math.min(...advancePrices) : 0;

      const mapped = {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        email: loc.email || '',
        imageUrls: loc.image_urls || [],
        minAdvance: loc.min_advance || 0,
        supportedSports: loc.supported_sports || [],
        latitude: loc.latitude,
        longitude: loc.longitude,
        open_hour: loc.open_hour ?? 6,
        close_hour: loc.close_hour ?? 23,
        morning_start: loc.morning_start ?? 6,
        morning_end: loc.morning_end ?? 18,
        night_start: loc.night_start ?? 18,
        night_end: loc.night_end ?? 24,
        description: loc.description,
        rating: loc.rating,
        timings: loc.timings,
        contact: loc.contact || loc.phone || '',
        advanceBookingRequired: loc.advance_booking_required,
        defaultPrice: defaultPricing?.price || 0,
        defaultAdvance: lowestAdvance,
        is_open: loc.is_open ?? true,
        numberOfCourts: loc.number_of_courts || 1,
        maxCapacity: loc.max_capacity ?? 50,
        max_capacity: loc.max_capacity ?? 50,
        courts: (loc.courts || []).map((c: any) => ({
          id: c.id,
          locationId: c.location_id,
          courtNumber: c.court_number,
          name: c.name,
          description: c.description,
          imageUrls: c.image_urls || [],
          open_hour: c.open_hour,
          close_hour: c.close_hour,
          morning_start: c.morning_start,
          morning_end: c.morning_end,
          night_start: c.night_start,
          night_end: c.night_end,
          maxCapacity: c.max_capacity ?? 50,
          max_capacity: c.max_capacity ?? 50
        })).sort((a: Court, b: Court) => a.courtNumber - b.courtNumber)
      };

      // Auto-repair missing coordinates in background
      if (mapped.address && (mapped.latitude === null || mapped.latitude === undefined)) {
        geocodingService.getCoordinates(mapped.address, '').then(coords => {
          if (coords) {
            supabase.from('locations').update({ latitude: coords.latitude, longitude: coords.longitude }).eq('id', mapped.id).then();
          }
        }).catch(() => {});
      }

      return mapped;
    }) as Location[];

    return locations;
  },

  async getLocationById(id: string): Promise<Location | null> {
    const { data, error } = await supabase
      .from('locations')
      .select('*, box_pricing(*), courts(*)')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    const defaultPricing = data.box_pricing?.find((p: any) => p.duration_hours === 1 && p.rule_type === 'default' && p.category === 'morning')
                        || data.box_pricing?.find((p: any) => p.duration_hours === 1 && p.rule_type === 'default');

    const advancePrices = (data.box_pricing || [])
      .map((p: any) => Number(p.advance_price ?? p.advancePrice))
      .filter((v: number) => !isNaN(v) && v > 0);
    const lowestAdvance = advancePrices.length > 0 ? Math.min(...advancePrices) : 0;

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      email: data.email || '',
      imageUrls: data.image_urls || [],
      minAdvance: data.min_advance || 0,
      supportedSports: data.supported_sports || [],
      latitude: data.latitude,
      longitude: data.longitude,
      open_hour: data.open_hour ?? 6,
      close_hour: data.close_hour ?? 23,
      morning_start: data.morning_start ?? 6,
      morning_end: data.morning_end ?? 18,
      night_start: data.night_start ?? 18,
      night_end: data.night_end ?? 24,
      description: data.description,
      rating: data.rating,
      timings: data.timings,
      contact: data.contact || data.phone || '',
      advanceBookingRequired: data.advance_booking_required,
      defaultPrice: defaultPricing?.price || 0,
      defaultAdvance: lowestAdvance,
      is_open: data.is_open ?? true,
      numberOfCourts: data.number_of_courts || 1,
      maxCapacity: data.max_capacity ?? 50,
      max_capacity: data.max_capacity ?? 50,
      courts: (data.courts || []).map((c: any) => ({
        id: c.id,
        locationId: c.location_id,
        courtNumber: c.court_number,
        name: c.name,
        description: c.description,
        imageUrls: c.image_urls || [],
        open_hour: c.open_hour,
        close_hour: c.close_hour,
        morning_start: c.morning_start,
        morning_end: c.morning_end,
        night_start: c.night_start,
        night_end: c.night_end,
        maxCapacity: c.max_capacity ?? 50,
        max_capacity: c.max_capacity ?? 50
      })).sort((a: Court, b: Court) => a.courtNumber - b.courtNumber)
    } as Location;
  },

  async getLocationsWithAdmins(): Promise<LocationWithAdmin[]> {
    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        box_pricing(*),
        courts(*),
        admin_accounts (
          username
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(loc => {
      const defaultPricing = loc.box_pricing?.find((p: any) => p.duration_hours === 1 && p.rule_type === 'default' && p.category === 'morning')
                          || loc.box_pricing?.find((p: any) => p.duration_hours === 1 && p.rule_type === 'default');

      const advancePrices = (loc.box_pricing || [])
        .map((p: any) => Number(p.advance_price ?? p.advancePrice))
        .filter((v: number) => !isNaN(v) && v > 0);
      const lowestAdvance = advancePrices.length > 0 ? Math.min(...advancePrices) : 0;

      return {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        email: loc.email || '',
        imageUrls: loc.image_urls || [],
        minAdvance: loc.min_advance || 0,
        supportedSports: loc.supported_sports || [],
        adminUsername: loc.admin_accounts?.[0]?.username,
        latitude: loc.latitude,
        longitude: loc.longitude,
        open_hour: loc.open_hour ?? 6,
        close_hour: loc.close_hour ?? 23,
        morning_start: loc.morning_start ?? 6,
        morning_end: loc.morning_end ?? 18,
        night_start: loc.night_start ?? 18,
        night_end: loc.night_end ?? 24,
        description: loc.description,
        rating: loc.rating,
        timings: loc.timings,
        contact: loc.contact || loc.phone || '',
        advanceBookingRequired: loc.advance_booking_required,
        defaultPrice: defaultPricing?.price || 0,
        defaultAdvance: lowestAdvance,
        is_open: loc.is_open ?? true,
        numberOfCourts: loc.number_of_courts || 1,
        maxCapacity: loc.max_capacity ?? 50,
        max_capacity: loc.max_capacity ?? 50,
        courts: (loc.courts || []).map((c: any) => ({
          id: c.id,
          locationId: c.location_id,
          courtNumber: c.court_number,
          name: c.name,
          description: c.description,
          imageUrls: c.image_urls || [],
          open_hour: c.open_hour,
          close_hour: c.close_hour,
          morning_start: c.morning_start,
          morning_end: c.morning_end,
          night_start: c.night_start,
          night_end: c.night_end,
          maxCapacity: c.max_capacity ?? 50,
          max_capacity: c.max_capacity ?? 50
        })).sort((a: Court, b: Court) => a.courtNumber - b.courtNumber)
      };
    }) as LocationWithAdmin[];
  },

  async addLocation(loc: Omit<Location, 'id'>): Promise<Location> {
    const newId = crypto.randomUUID();

    // Auto-calculate coordinates if not provided
    let finalLat = loc.latitude;
    let finalLng = loc.longitude;

    if (finalLat === undefined || finalLng === undefined) {
      const coords = await geocodingService.getCoordinates(loc.address, '');
      if (coords) {
        finalLat = finalLat ?? coords.latitude;
        finalLng = finalLng ?? coords.longitude;
      }
    }

    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .insert([{
        id: newId,
        name: loc.name,
        address: loc.address,
        email: loc.email,
        image_urls: loc.imageUrls,
        min_advance: loc.minAdvance,
        supported_sports: loc.supportedSports,
        latitude: finalLat,
        longitude: finalLng,
        open_hour: loc.open_hour ?? 6,
        close_hour: loc.close_hour ?? 23,
        morning_start: loc.morning_start ?? 6,
        morning_end: loc.morning_end ?? 18,
        night_start: loc.night_start ?? 18,
        night_end: loc.night_end ?? 24,
        description: loc.description,
        rating: loc.rating,
        timings: loc.timings,
        contact: loc.contact || loc.phone || '',
        advance_booking_required: loc.advanceBookingRequired,
        is_open: loc.is_open ?? true,
        number_of_courts: loc.numberOfCourts || 1
      }])
      .select()
      .single();

    if (locationError) throw locationError;

    // Create default Court 1
    const { data: courtData, error: courtError } = await supabase
      .from('courts')
      .insert([{
        location_id: locationData.id,
        court_number: 1,
        name: 'Court 1',
        image_urls: []
      }])
      .select();

    if (courtError) {
        console.error("Critical: Initial court creation failed:", courtError.message);
        // We still continue to try adding pricing and admin,
        // but the missing court will need manual fix or via Dashboard update logic.
    }

    const createdCourt1 = courtData?.[0];

    // If more than 1 court requested, create them too
    const extraCourtsCount = (loc.numberOfCourts || 1) - 1;
    if (extraCourtsCount > 0) {
      const extraCourts = Array.from({ length: extraCourtsCount }, (_, i) => ({
        location_id: locationData.id,
        court_number: i + 2,
        name: `Court ${i + 2}`,
        image_urls: []
      }));
      await supabase.from('courts').insert(extraCourts);
    }

    // Add default pricing rules for the new arena (Court 1 if available, otherwise global)
    const defaultPricing = [
      { location_id: locationData.id, court_id: createdCourt1?.id, duration_hours: 1, price: 1000, advance_price: 500, category: 'morning', rule_type: 'default' },
      { location_id: locationData.id, court_id: createdCourt1?.id, duration_hours: 1, price: 1200, advance_price: 600, category: 'night', rule_type: 'default' },
      { location_id: locationData.id, court_id: createdCourt1?.id, duration_hours: 1.5, price: 1500, advance_price: 750, category: 'morning', rule_type: 'default' },
      { location_id: locationData.id, court_id: createdCourt1?.id, duration_hours: 1.5, price: 1800, advance_price: 900, category: 'night', rule_type: 'default' }
    ];

    await supabase.from('box_pricing').insert(defaultPricing);

    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    // Create username from name and the first part of the address (before the first comma)
    const firstAddressPart = loc.address.split(',')[0].trim();
    const arenaUsername = normalize(`${loc.name} ${firstAddressPart}`);

    await supabase.from('admin_accounts').insert([{
        username: arenaUsername,
        password: '1234',
        email: loc.email,
        location_id: locationData.id,
        is_superadmin: false
      }]);

    return {
      id: locationData.id,
      name: locationData.name,
      address: locationData.address,
      email: locationData.email || '',
      imageUrls: locationData.image_urls || [],
      minAdvance: locationData.min_advance || 0,
      supportedSports: locationData.supported_sports || [],
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      open_hour: locationData.open_hour ?? 6,
      close_hour: locationData.close_hour ?? 23,
      morning_start: locationData.morning_start ?? 6,
      morning_end: locationData.morning_end ?? 18,
      night_start: locationData.night_start ?? 18,
      night_end: locationData.night_end ?? 24,
      description: locationData.description,
      rating: locationData.rating,
      timings: locationData.timings,
      contact: data.contact || data.phone || '',
      advanceBookingRequired: locationData.advance_booking_required,
      is_open: locationData.is_open ?? true
    } as Location;
  },

  async deleteLocation(id: string): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async updateLocation(id: string, updates: Partial<Location>): Promise<void> {
    const dbUpdates: any = {};
    console.log("[LocationService] updateLocation updates:", updates);
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.address !== undefined) {
      dbUpdates.address = updates.address;
      // Recalculate coordinates if address changes AND lat/lng not explicitly provided in this update
      if (updates.latitude === undefined && updates.longitude === undefined) {
        const coords = await geocodingService.getCoordinates(updates.address, '');
        if (coords) {
          dbUpdates.latitude = coords.latitude;
          dbUpdates.longitude = coords.longitude;
        }
      }
    }

    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.imageUrls !== undefined) dbUpdates.image_urls = updates.imageUrls;
    if (updates.minAdvance !== undefined) dbUpdates.min_advance = updates.minAdvance;
    if (updates.supportedSports !== undefined) dbUpdates.supported_sports = updates.supportedSports;

    if (updates.open_hour !== undefined) dbUpdates.open_hour = updates.open_hour;
    if (updates.close_hour !== undefined) dbUpdates.close_hour = updates.close_hour;
    if (updates.morning_start !== undefined) dbUpdates.morning_start = updates.morning_start;
    if (updates.morning_end !== undefined) dbUpdates.morning_end = updates.morning_end;
    if (updates.night_start !== undefined) dbUpdates.night_start = updates.night_start;
    if (updates.night_end !== undefined) dbUpdates.night_end = updates.night_end;

    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
    if (updates.contact !== undefined) dbUpdates.contact = updates.contact;
    if (updates.maxCapacity !== undefined) dbUpdates.max_capacity = updates.maxCapacity;
    if (updates.max_capacity !== undefined) dbUpdates.max_capacity = updates.max_capacity;

    if (updates.advanceBookingRequired !== undefined) dbUpdates.advance_booking_required = updates.advanceBookingRequired;
    if (updates.is_open !== undefined) dbUpdates.is_open = updates.is_open;
    if (updates.numberOfCourts !== undefined) {
      dbUpdates.number_of_courts = updates.numberOfCourts;

      // Handle adding/removing courts in database
      const { data: currentCourts } = await supabase.from('courts').select('court_number').eq('location_id', id);
      const existingNumbers = (currentCourts || []).map(c => c.court_number);
      const maxExisting = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;

      if (updates.numberOfCourts > maxExisting) {
        // Add new courts
        const newCourts = [];
        for (let i = maxExisting + 1; i <= updates.numberOfCourts; i++) {
          newCourts.push({
            location_id: id,
            court_number: i,
            name: `Court ${i}`
          });
        }
        if (newCourts.length > 0) await supabase.from('courts').insert(newCourts);
      } else if (updates.numberOfCourts < maxExisting) {
        // Remove extra courts (careful: this might delete bookings if CASCADE is set)
        // Usually we should probably just hide them or mark as inactive, but the plan says manage count.
        // I'll delete them for now as it matches "number of courts" UI.
        await supabase.from('courts').delete().eq('location_id', id).gt('court_number', updates.numberOfCourts);
      }
    }

    console.log("[LocationService] dbUpdates to execute:", dbUpdates);
    const { data, error } = await supabase
      .from('locations')
      .update(dbUpdates)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Failed to update arena details in database. Permission denied by security policy (RLS) or arena record not found.");
    }
  },

  async addCourt(court: Omit<Court, 'id'>): Promise<Court> {
    const { data, error } = await supabase
      .from('courts')
      .insert([{
        location_id: court.locationId,
        court_number: court.courtNumber,
        name: court.name,
        description: court.description,
        image_urls: court.imageUrls,
        open_hour: court.open_hour,
        close_hour: court.close_hour,
        morning_start: court.morning_start,
        morning_end: court.morning_end,
        night_start: court.night_start,
        night_end: court.night_end
      }])
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      locationId: data.location_id,
      courtNumber: data.court_number,
      name: data.name,
      description: data.description,
      imageUrls: data.image_urls || [],
      open_hour: data.open_hour,
      close_hour: data.close_hour,
      morning_start: data.morning_start,
      morning_end: data.morning_end,
      night_start: data.night_start,
      night_end: data.night_end
    };
  },

  async updateCourt(id: string, updates: Partial<Court>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.imageUrls !== undefined) dbUpdates.image_urls = updates.imageUrls;
    if (updates.open_hour !== undefined) dbUpdates.open_hour = updates.open_hour;
    if (updates.close_hour !== undefined) dbUpdates.close_hour = updates.close_hour;
    if (updates.morning_start !== undefined) dbUpdates.morning_start = updates.morning_start;
    if (updates.morning_end !== undefined) dbUpdates.morning_end = updates.morning_end;
    if (updates.night_start !== undefined) dbUpdates.night_start = updates.night_start;
    if (updates.night_end !== undefined) dbUpdates.night_end = updates.night_end;
    if (updates.maxCapacity !== undefined) dbUpdates.max_capacity = updates.maxCapacity;
    if (updates.max_capacity !== undefined) dbUpdates.max_capacity = updates.max_capacity;

    const { data, error } = await supabase
      .from('courts')
      .update(dbUpdates)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Failed to update court details in database. Permission denied by security policy (RLS) or court record not found.");
    }
  },

  async deleteCourt(id: string): Promise<void> {
    const { error } = await supabase
      .from('courts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async resetAdminPassword(locId: string) {
    const { data: location } = await supabase
      .from('locations')
      .select('name, address')
      .eq('id', locId)
      .single();

    if (!location) throw new Error("Location not found");

    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    // Create username from name and the first part of the address (before the first comma)
    const firstAddressPart = location.address.split(',')[0].trim();
    const newUsername = normalize(`${location.name} ${firstAddressPart}`);
    const newPassword = '1234';

    const { error } = await supabase
      .from('admin_accounts')
      .update({ username: newUsername, password: newPassword })
      .eq('location_id', locId);

    if (error) throw error;

    return { username: newUsername, password: newPassword };
  },

  async resetAdminCredentials(locId: string, username: string, password: string) {
    try {
      const { data, error } = await supabase.rpc('update_admin_credentials', {
        p_location_id: locId,
        p_new_username: username.toLowerCase().trim(),
        p_new_password: password.trim()
      });

      if (error) throw error;

      if (data && data.success) {
        return { error: null };
      } else {
        return { error: new Error(data?.message || 'Failed to update credentials') };
      }
    } catch (e: any) {
      return { error: e };
    }
  }
};
