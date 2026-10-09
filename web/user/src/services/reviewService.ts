import { supabase } from './supabase';
import { handleError } from './errorHandler';
import { syncLocationRating } from './ratingService';

/**
 * Interface for Review
 */
export interface Review {
  id: string;
  location_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}

/**
 * Fetch all reviews for a location
 */
export const getReviews = async (locationId: string): Promise<Review[]> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles(full_name, avatar_url)')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Fetch a specific user's review for a location
 */
export const getUserReview = async (locationId: string, userId: string): Promise<Review | null> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('location_id', locationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Create or update a review
 */
export const saveReview = async (
  locationId: string,
  userId: string,
  rating: number,
  comment: string
): Promise<Review> => {
  try {
    // Check if review exists
    const existing = await getUserReview(locationId, userId);

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('reviews')
        .update({ rating, comment, created_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          location_id: locationId,
          user_id: userId,
          rating,
          comment,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Sync location rating in background
    syncLocationRating(locationId);

    return result;
  } catch (error) {
    throw handleError(error);
  }
};
