import { supabase } from './supabase';
import { GameZonePlatform, GameZoneResource, GameZoneGame, GameZoneBlockout, GameZoneResourceStatus } from '../types';

export const gameZoneService = {
  // Fetch platforms for a location
  getPlatforms: async (locationId: string): Promise<GameZonePlatform[]> => {
    try {
      const { data, error } = await supabase
        .from('game_zone_platforms')
        .select('*')
        .eq('location_id', locationId)
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching game zone platforms:', err);
      return [];
    }
  },

  // Fetch resources (stations) for a location or platform
  getResources: async (locationId: string, platformId?: string): Promise<GameZoneResource[]> => {
    try {
      let query = supabase
        .from('game_zone_resources')
        .select('*')
        .eq('location_id', locationId);

      if (platformId) {
        query = query.eq('platform_id', platformId);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching game zone resources:', err);
      return [];
    }
  },

  // Fetch games catalog for a location or platform type
  getGames: async (locationId: string, platformType?: string): Promise<GameZoneGame[]> => {
    try {
      let query = supabase
        .from('game_zone_games')
        .select('*')
        .eq('location_id', locationId);

      if (platformType) {
        query = query.or(`platform_type.eq.${platformType},platform_type.is.null`);
      }

      const { data, error } = await query.order('title');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching game zone games:', err);
      return [];
    }
  },

  // Fetch active blockouts for resources at a location
  getBlockouts: async (locationId: string): Promise<GameZoneBlockout[]> => {
    try {
      const { data, error } = await supabase
        .from('game_zone_blockouts')
        .select('*')
        .eq('location_id', locationId);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching game zone blockouts:', err);
      return [];
    }
  },

  // Admin Management Functions
  createPlatform: async (platform: Partial<GameZonePlatform>): Promise<GameZonePlatform | null> => {
    try {
      const { data, error } = await supabase
        .from('game_zone_platforms')
        .insert([platform])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating platform:', err);
      return null;
    }
  },

  createResource: async (resource: Partial<GameZoneResource>): Promise<GameZoneResource | null> => {
    try {
      const { data, error } = await supabase
        .from('game_zone_resources')
        .insert([resource])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating resource:', err);
      return null;
    }
  },

  updateResourceStatus: async (resourceId: string, status: GameZoneResourceStatus): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_zone_resources')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', resourceId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating resource status:', err);
      return false;
    }
  },

  updateResource: async (resourceId: string, updates: Partial<GameZoneResource>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_zone_resources')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', resourceId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error updating resource:', err);
      return false;
    }
  },

  deleteResource: async (resourceId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_zone_resources')
        .delete()
        .eq('id', resourceId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting resource:', err);
      return false;
    }
  },

  deletePlatform: async (platformId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_zone_platforms')
        .delete()
        .eq('id', platformId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting platform:', err);
      return false;
    }
  },

  createGame: async (game: Partial<GameZoneGame>): Promise<GameZoneGame | null> => {
    try {
      const { data, error } = await supabase
        .from('game_zone_games')
        .insert([game])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating game:', err);
      return null;
    }
  },

  deleteGame: async (gameId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_zone_games')
        .delete()
        .eq('id', gameId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting game:', err);
      return false;
    }
  },

  createBlockout: async (blockout: Partial<GameZoneBlockout>): Promise<GameZoneBlockout | null> => {
    try {
      const { data, error } = await supabase
        .from('game_zone_blockouts')
        .insert([blockout])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating blockout:', err);
      return null;
    }
  },

  deleteBlockout: async (blockoutId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('game_zone_blockouts')
        .delete()
        .eq('id', blockoutId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting blockout:', err);
      return false;
    }
  }
};
