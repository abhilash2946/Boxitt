import { supabase } from './supabase';
import { handleError } from './errorHandler';

/**
 * Get average rating for a specific location
 */
export const getLocationAverageRating = async (locationId: string): Promise<number> => {
  try {
    if (!locationId) {
      console.warn('getLocationAverageRating: locationId is required');
      return 0;
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('location_id', locationId);

    if (error) {
      console.error('Error getting location average rating:', error);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    const totalRating = data.reduce((sum, row) => sum + (row.rating || 0), 0);
    return Number((totalRating / data.length).toFixed(1));
  } catch (error) {
    const appError = handleError(error);
    console.error(appError.message);
    return 0;
  }
};

/**
 * Recalculate and store the average rating in the locations table
 */
export const syncLocationRating = async (locationId: string): Promise<void> => {
  try {
    const avg = await getLocationAverageRating(locationId);

    const { error } = await supabase
      .from('locations')
      .update({ rating: avg })
      .eq('id', locationId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to sync location rating:', error);
  }
};

/**
 * Get average rating for a specific match
 */
export const getMatchAverageRating = async (matchId: string): Promise<number> => {
  try {
    if (!matchId) {
      console.warn('getMatchAverageRating: matchId is required');
      return 0;
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('match_id', matchId);

    if (error) {
      console.error('Error getting match average rating:', error);
      return 0;
    }

    if (!data || data.length === 0) return 0;

    const totalRating = data.reduce((sum, row) => sum + (row.rating || 0), 0);
    return Number((totalRating / data.length).toFixed(1));
  } catch (error) {
    const appError = handleError(error);
    console.error(appError.message);
    return 0;
  }
};

/**
 * Get rating count for a specific location
 */
export const getLocationRatingCount = async (locationId: string): Promise<number> => {
  try {
    if (!locationId) {
      console.warn('getLocationRatingCount: locationId is required');
      return 0;
    }

    const { count, error } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId);

    if (error) {
      console.error('Error getting location rating count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    const appError = handleError(error);
    console.error(appError.message);
    return 0;
  }
};

/**
 * Check if user has already rated a specific match
 */
export const hasUserRatedMatch = async (matchId: string, userId: string): Promise<boolean> => {
  try {
    if (!matchId || !userId) {
      console.warn('hasUserRatedMatch: matchId and userId are required');
      return false;
    }

    const { count, error } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', matchId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error checking if user has rated match:', error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    const appError = handleError(error);
    console.error(appError.message);
    return false;
  }
};

/**
 * Get ratings breakdown for a location (count of each star rating)
 */
export const getLocationRatingsBreakdown = async (locationId: string): Promise<{
  oneStar: number;
  twoStar: number;
  threeStar: number;
  fourStar: number;
  fiveStar: number;
}> => {
  try {
    if (!locationId) {
      console.warn('getLocationRatingsBreakdown: locationId is required');
      return {
        oneStar: 0,
        twoStar: 0,
        threeStar: 0,
        fourStar: 0,
        fiveStar: 0
      };
    }

    const breakdown = {
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0
    };

    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('location_id', locationId);

    if (error) {
      console.error('Error getting location ratings breakdown:', error);
      return breakdown;
    }

    if (!data) return breakdown;

    data.forEach(row => {
      const rating = row.rating;
      switch (rating) {
        case 1: breakdown.oneStar++; break;
        case 2: breakdown.twoStar++; break;
        case 3: breakdown.threeStar++; break;
        case 4: breakdown.fourStar++; break;
        case 5: breakdown.fiveStar++; break;
      }
    });

    return breakdown;
  } catch (error) {
    const appError = handleError(error);
    console.error(appError.message);
    return {
      oneStar: 0,
      twoStar: 0,
      threeStar: 0,
      fourStar: 0,
      fiveStar: 0
    };
  }
};
