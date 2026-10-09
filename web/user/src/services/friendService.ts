import { supabase } from './supabase';

export interface FriendProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  phone_number?: string;
  status?: 'pending' | 'accepted' | 'blocked';
}

export interface FriendshipRecord {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  friend_profile?: FriendProfile;
}

export const friendService = {
  /** Search user by @username or display name */
  async searchUsersByUsername(query: string, currentUserId: string): Promise<FriendProfile[]> {
    if (!query.trim()) return [];
    const cleanQuery = query.replace('@', '').trim();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .neq('id', currentUserId)
      .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return [];
    }

    return (data || []) as FriendProfile[];
  },

  /** Send a Friend Request */
  async sendFriendRequest(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id_1: currentUserId,
          user_id_2: targetUserId,
          status: 'pending'
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to send friend request:', err);
      return false;
    }
  },

  /** Accept a Friend Request */
  async acceptFriendRequest(friendshipId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      return false;
    }
  },

  /** Remove Friend / Unconnect */
  async removeFriend(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${targetUserId}),and(user_id_1.eq.${targetUserId},user_id_2.eq.${currentUserId})`);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to remove friend / unconnect:', err);
      return false;
    }
  },

  /** Fetch User's Friends List */
  async getFriendsList(currentUserId: string): Promise<FriendshipRecord[]> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Hydrate profiles
      const friendUserIds = data.map(f => f.user_id_1 === currentUserId ? f.user_id_2 : f.user_id_1);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', friendUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return data.map(f => {
        const otherId = f.user_id_1 === currentUserId ? f.user_id_2 : f.user_id_1;
        return {
          ...f,
          friend_profile: profileMap.get(otherId)
        };
      });
    } catch (err) {
      console.error('Failed to fetch friends list:', err);
      return [];
    }
  }
};
