import { supabase } from './supabase';
import { Pricing } from '../types';

export type { Pricing };

export const getPricingForLocation = async (locationId: string): Promise<Pricing[]> => {
  const { data, error } = await supabase
    .from('box_pricing')
    .select('*')
    .eq('location_id', locationId)
    .order('duration_hours');

  if (error) {
    console.error('Error fetching pricing:', error);
    throw error;
  }

  return (data || []).map(p => ({
    id: p.id,
    locationId: p.location_id,
    courtId: p.court_id,
    durationHours: p.duration_hours,
    price: p.price,
    advancePrice: p.advance_price,
    label: p.label,
    category: p.category,
    ruleType: p.rule_type,
    dayOfWeek: p.day_of_week,
    specificDate: p.specific_date
  }));
};

export const upsertPricing = async (pricing: Pricing): Promise<Pricing> => {
  const dbPricing: any = {
    location_id: pricing.locationId,
    court_id: pricing.courtId,
    duration_hours: pricing.durationHours,
    price: pricing.price,
    advance_price: pricing.advancePrice,
    category: pricing.category,
    rule_type: pricing.ruleType,
    day_of_week: pricing.dayOfWeek,
    specific_date: pricing.specificDate
  };

  if (pricing.id) dbPricing.id = pricing.id;

  const { data, error } = await supabase
    .from('box_pricing')
    .upsert(dbPricing, { onConflict: 'location_id,court_id,duration_hours,category,rule_type,day_of_week,specific_date' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting pricing:', error);
    throw error;
  }

  return {
    id: data.id,
    locationId: data.location_id,
    courtId: data.court_id,
    durationHours: data.duration_hours,
    price: data.price,
    advancePrice: data.advance_price,
    label: data.label,
    category: data.category,
    ruleType: data.rule_type,
    dayOfWeek: data.day_of_week,
    specificDate: data.specific_date
  };
};

export const deletePricing = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('box_pricing')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting pricing:', error);
    throw error;
  }
};

export const deletePricingByCourt = async (courtId: string): Promise<void> => {
  const { error } = await supabase
    .from('box_pricing')
    .delete()
    .eq('court_id', courtId);

  if (error) {
    console.error('Error deleting pricing by court:', error);
    throw error;
  }
};
