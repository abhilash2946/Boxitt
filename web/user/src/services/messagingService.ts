import { supabase } from './supabase';

export interface ChatRoom {
  id: string;
  type: 'temporary_match' | 'permanent_direct' | 'permanent_group';
  match_id?: string;
  name?: string;
  avatar_url?: string;
  created_by?: string;
  format_capacity: number;
  is_readonly: boolean;
  match_end_time?: string;
  created_at: string;
  unread_count?: number;
  last_message?: string;
  last_message_time?: string;
  members_count?: number;
  members?: ChatMember[];
}

export interface ChatMember {
  id: string;
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_via?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  last_read_at?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'live_score' | 'rsvp_status' | 'payment_card' | 'location_card' | 'system';
  content: string;
  payload_json?: any;
  created_at: string;
  sender_username?: string;
  sender_display_name?: string;
  sender_avatar_url?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

function parseMatchEndTimeFromName(name?: string): Date | null {
  if (!name) return null;
  const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const dateStr = dateMatch[1]; // e.g. "2026-10-09"

  // Match range e.g. "11:00 PM - 12:00 AM" or "10:00 PM - 11:00 PM"
  const rangeMatch = name.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (rangeMatch) {
    const startStr = rangeMatch[1].trim();
    const endStr = rangeMatch[2].trim();

    const startDate = new Date(`${dateStr} ${startStr}`);
    const endDate = new Date(`${dateStr} ${endStr}`);

    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      // Overnight slot check: if end time is <= start time (e.g. 11:00 PM -> 12:00 AM), it ends on the next calendar day
      if (endDate.getTime() <= startDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }
      return endDate;
    }
  }

  const timeMatch = name.match(/-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if (timeMatch) {
    const endStr = timeMatch[1].trim();
    const parsed = new Date(`${dateStr} ${endStr}`);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const parsedDate = new Date(`${dateStr}T23:59:59`);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export const messagingService = {
  /** Create or fetch a single temporary match room for challenges/joinables */
  async createMatchRoom(
    matchId: string,
    hostId: string,
    acceptorId?: string | null,
    roomName?: string,
    formatCapacity: number = 10
  ): Promise<ChatRoom | null> {
    try {
      if (!matchId) return null;

      // Fetch all existing rooms for this match_id safely without PostgREST maybeSingle error
      const { data: existingRooms } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      let targetRoom: ChatRoom | null = (existingRooms && existingRooms.length > 0) ? (existingRooms[0] as ChatRoom) : null;

      // Clean up extra duplicate rooms from Supabase DB if multiple exist
      if (existingRooms && existingRooms.length > 1) {
        const extraRoomIds = existingRooms.slice(1).map(r => r.id);
        await supabase.from('chat_rooms').delete().in('id', extraRoomIds);
      }

      if (!targetRoom) {
        // Create new single room
        const { data: newRoom, error: createErr } = await supabase
          .from('chat_rooms')
          .insert({
            type: 'temporary_match',
            match_id: matchId,
            name: roomName || 'Match Group',
            created_by: hostId || null,
            format_capacity: formatCapacity
          })
          .select()
          .single();

        if (createErr || !newRoom) {
          console.error('Error creating chat room row:', createErr);
          return null;
        }
        targetRoom = newRoom as ChatRoom;
      } else {
        // Update room name to include full timing if missing
        if (roomName && targetRoom.name !== roomName) {
          await supabase.from('chat_rooms').update({ name: roomName }).eq('id', targetRoom.id);
          targetRoom.name = roomName;
        }
      }

      // Add members safely
      if (targetRoom?.id) {
        if (hostId) {
          await supabase.from('chat_room_members').upsert([
            { room_id: targetRoom.id, user_id: hostId, role: 'admin', joined_via: 'host' }
          ], { onConflict: 'room_id, user_id' });
        }

        if (acceptorId && acceptorId.trim().length > 0) {
          await supabase.from('chat_room_members').upsert([
            { room_id: targetRoom.id, user_id: acceptorId, role: 'member', joined_via: 'invite' }
          ], { onConflict: 'room_id, user_id' });
        }

        // Ensure default system messages exist for initial group creation & member additions
        try {
          const { data: existingSysMsgs } = await supabase
            .from('chat_messages')
            .select('id, content, payload_json')
            .eq('room_id', targetRoom.id)
            .eq('message_type', 'system');

          let hostName = 'Host';
          if (hostId) {
            const { data: hostProfile } = await supabase
              .from('user_profiles')
              .select('display_name, username')
              .eq('id', hostId)
              .maybeSingle();
            if (hostProfile) {
              hostName = hostProfile.display_name || ((hostProfile.username && hostProfile.username.toLowerCase() !== 'player') ? hostProfile.username : 'Host');
            }
          }

          const hasGroupCreated = existingSysMsgs?.some(m =>
            m.payload_json?.type === 'group_created' || m.content?.includes('Group created for')
          );

          if (!hasGroupCreated) {
            // Extract timing and date from roomName or targetRoom.name
            let timingAndDate = '';
            const currentName = roomName || targetRoom.name || '';
            const matchParen = currentName.match(/\(([^)]+)\)/);
            if (matchParen) {
              timingAndDate = matchParen[1].trim();
            } else {
              timingAndDate = currentName;
            }

            let matchTypeLabel = 'match';
            if (currentName.toLowerCase().includes('joinable')) {
              matchTypeLabel = 'joinable match';
            } else if (currentName.toLowerCase().includes('challenge')) {
              matchTypeLabel = 'challenge';
            } else {
              const { data: bookingCheck } = await supabase
                .from('bookings')
                .select('is_joinable')
                .eq('id', targetRoom.match_id || matchId)
                .maybeSingle();

              if (bookingCheck?.is_joinable) {
                matchTypeLabel = 'joinable match';
              } else {
                matchTypeLabel = 'challenge';
              }
            }

            const creationMsg = timingAndDate
              ? `Group created for ${matchTypeLabel} at ${timingAndDate}`
              : `Group created for ${matchTypeLabel}`;

            await supabase.from('chat_messages').insert({
              room_id: targetRoom.id,
              sender_id: hostId || 'system',
              message_type: 'system',
              content: creationMsg,
              payload_json: { type: 'group_created', host_id: hostId, timing: timingAndDate, match_type: matchTypeLabel }
            });

            if (hostId) {
              localStorage.setItem(`chat_read_${targetRoom.id}`, new Date().toISOString());
            }
          }

          if (acceptorId && acceptorId.trim().length > 0) {
            const hasAddedMsg = existingSysMsgs?.some(m =>
              (m.payload_json?.type === 'member_added' && String(m.payload_json?.added_user_id) === String(acceptorId)) ||
              (m.content && m.content.includes('was added by'))
            );

            if (!hasAddedMsg) {
              let acceptorName = 'Player';
              const { data: accProfile } = await supabase
                .from('user_profiles')
                .select('display_name, username')
                .eq('id', acceptorId)
                .maybeSingle();
              if (accProfile) {
                acceptorName = accProfile.display_name || ((accProfile.username && accProfile.username.toLowerCase() !== 'player') ? accProfile.username : 'Player');
              }

              await supabase.from('chat_messages').insert({
                room_id: targetRoom.id,
                sender_id: hostId || 'system',
                message_type: 'system',
                content: `${acceptorName} was added by ${hostName}`,
                payload_json: {
                  type: 'member_added',
                  added_user_id: acceptorId,
                  host_id: hostId,
                  host_name: hostName,
                  added_name: acceptorName
                }
              });
            }
          }
        } catch (sysMsgErr) {
          console.error('Error inserting system default message:', sysMsgErr);
        }
      }

      return targetRoom;
    } catch (err) {
      console.error('Error in createMatchRoom:', err);
      return null;
    }
  },

  /** Auto-sync active/booked matches into chat_rooms for current user (Non-blocking background worker) */
  async syncMatchRoomsForUser(currentUserId: string): Promise<void> {
    try {
      if (!currentUserId) return;

      // Get deleted rooms / matches list from local storage
      let deletedIds: string[] = [];
      try {
        const key = `deleted_chat_rooms_${currentUserId}`;
        deletedIds = JSON.parse(localStorage.getItem(key) || '[]');
      } catch (e) {
        deletedIds = [];
      }

      // 1. Fetch user-specific challenges safely without column selection errors
      const { data: challenges, error: chalErr } = await supabase
        .from('challenges')
        .select('*')
        .or(`challenger_id.eq.${currentUserId},accepted_by.eq.${currentUserId}`);

      if (!chalErr && challenges && challenges.length > 0) {
        const userChallenges = challenges.filter(c =>
          c.accepted_by && !deletedIds.includes(c.id)
        );

        await Promise.all(userChallenges.map(async (c) => {
          const slotTime = c.slot_time || c.time || '';
          const roomName = `${c.sport || 'Cricket'} Challenge Match (${c.date || ''}${slotTime ? ' ' + slotTime : ''})`;
          await this.createMatchRoom(c.id, c.challenger_id, c.accepted_by, roomName, 10);
        }));
      }

      // 2. Fetch joinable matches relevant to user safely
      const { data: bookings, error: bkErr } = await supabase
        .from('bookings')
        .select('*, join_requests(*)')
        .eq('is_joinable', true);

      if (!bkErr && bookings && bookings.length > 0) {
        const userBookings = bookings.filter(b => !deletedIds.includes(b.id));

        await Promise.all(userBookings.map(async (b) => {
          const reqs = Array.isArray(b.join_requests) ? b.join_requests : [];
          const approvedReqs = reqs.filter((r: any) => {
            const st = String(r?.status || '').toLowerCase();
            return st === 'accepted' || st === 'approved' || st === 'confirmed';
          });

          const isHost = String(b.user_id) === String(currentUserId);
          const isApprovedRequester = approvedReqs.some((r: any) => String(r?.requester_id || r?.userId) === String(currentUserId));

          if (isHost || isApprovedRequester) {
            const slotTime = b.slot_time || b.time || b.slotTime || '';
            const roomName = `JOINABLE ${b.sport || 'Sports'} Match (${b.date || ''}${slotTime ? ' ' + slotTime : ''})`;

            const room = await this.createMatchRoom(b.id, b.user_id, null, roomName, b.max_players || 10);

            if (room && approvedReqs.length > 0) {
              await Promise.all(approvedReqs.map(async (req: any) => {
                const reqId = req.requester_id || req.userId;
                if (reqId) {
                  await supabase.from('chat_room_members').upsert([
                    { room_id: room.id, user_id: reqId, role: 'member', joined_via: 'invite' }
                  ], { onConflict: 'room_id, user_id' });
                }
              }));
            }
          }
        }));
      }
    } catch (err) {
      console.error('Error syncing match rooms:', err);
    }
  },

  /** Clear all messages in a chat room */
  async clearChatMessages(roomId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('room_id', roomId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error clearing chat messages:', err);
      return false;
    }
  },

  /** Delete a chat room and all its messages/members from Supabase completely */
  async deleteChatRoom(roomId: string, currentUserId?: string): Promise<boolean> {
    try {
      if (!roomId) return false;

      // Fetch target room details to capture match_id
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('id, match_id')
        .eq('id', roomId)
        .maybeSingle();

      // Record in local storage to prevent syncMatchRoomsForUser from resurrecting it
      if (currentUserId) {
        try {
          const key = `deleted_chat_rooms_${currentUserId}`;
          const existing: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          if (!existing.includes(roomId)) existing.push(roomId);
          if (room?.match_id && !existing.includes(room.match_id)) existing.push(room.match_id);
          localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {
          console.error('Error saving deleted room key:', e);
        }
      }

      // 1. Delete all messages associated with room
      await supabase
        .from('chat_messages')
        .delete()
        .eq('room_id', roomId);

      // 2. Delete all member records for room
      await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', roomId);

      // 3. Delete the chat_rooms row itself
      const { error: roomErr } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', roomId);

      if (roomErr) {
        console.error('Error deleting chat_rooms row:', roomErr);
        return false;
      }

      // 4. If this was a match room, purge any duplicate room rows for same match_id
      if (room?.match_id) {
        const { data: dupes } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('match_id', room.match_id);

        if (dupes && dupes.length > 0) {
          const dupIds = dupes.map(d => d.id);
          await supabase.from('chat_messages').delete().in('room_id', dupIds);
          await supabase.from('chat_room_members').delete().in('room_id', dupIds);
          await supabase.from('chat_rooms').delete().in('id', dupIds);
        }
      }

      return true;
    } catch (err) {
      console.error('Error deleting chat room:', err);
      return false;
    }
  },

  /** Fetch all chat rooms for current user with fast batch loading */
  async getRoomsForUser(currentUserId: string, skipSync: boolean = false): Promise<ChatRoom[]> {
    try {
      if (!currentUserId) return [];

      // Run sync in background without blocking instant UI load
      if (!skipSync) {
        this.syncMatchRoomsForUser(currentUserId).catch(e => console.error('Background sync err:', e));
      }

      // Check local storage for deleted rooms/matches
      let deletedIds: string[] = [];
      try {
        const key = `deleted_chat_rooms_${currentUserId}`;
        deletedIds = JSON.parse(localStorage.getItem(key) || '[]');
      } catch (e) {
        deletedIds = [];
      }

      const { data: memberEntries, error: memberErr } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', currentUserId);

      if (memberErr || !memberEntries || memberEntries.length === 0) return [];

      const rawRoomIds = Array.from(new Set(memberEntries.map(m => m.room_id)));
      const roomIds = rawRoomIds.filter(id => !deletedIds.includes(id));

      if (roomIds.length === 0) return [];

      const { data: rooms, error: roomErr } = await supabase
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds);

      if (roomErr || !rooms || rooms.length === 0) return [];

      const validRooms = rooms.filter(r => !deletedIds.includes(r.id) && (!r.match_id || !deletedIds.includes(r.match_id)));
      if (validRooms.length === 0) return [];

      const activeRoomIds = validRooms.map(r => r.id);

      // BATCH QUERY 1: Latest messages for all active room IDs in ONE query
      const { data: allMessages } = await supabase
        .from('chat_messages')
        .select('room_id, content, created_at, sender_id')
        .in('room_id', activeRoomIds)
        .order('created_at', { ascending: false });

      const lastMsgMap = new Map<string, { content: string; created_at: string; sender_id: string }>();
      if (allMessages) {
        for (const msg of allMessages) {
          if (!lastMsgMap.has(msg.room_id)) {
            lastMsgMap.set(msg.room_id, msg);
          }
        }
      }

      // BATCH QUERY 2: Members count and memberships for all active rooms in ONE query
      const { data: allMembers } = await supabase
        .from('chat_room_members')
        .select('room_id, user_id')
        .in('room_id', activeRoomIds);

      const memberCounts = new Map<string, number>();
      const directOtherUserMap = new Map<string, string>();

      if (allMembers) {
        for (const m of allMembers) {
          memberCounts.set(m.room_id, (memberCounts.get(m.room_id) || 0) + 1);
          if (m.user_id !== currentUserId) {
            directOtherUserMap.set(m.room_id, m.user_id);
          }
        }
      }

      // BATCH QUERY 3: User profiles for 1-on-1 direct chats in ONE query
      const otherUserIds = Array.from(new Set(Array.from(directOtherUserMap.values())));
      const profileMap = new Map<string, { username?: string; display_name?: string; avatar_url?: string }>();

      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', otherUserIds);

        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.id, p);
          }
        }
      }

      const now = new Date().getTime();

      const hydratedRooms: (ChatRoom | null)[] = validRooms.map((room) => {
        let isReadonly = room.is_readonly;
        if (room.type === 'temporary_match') {
          const endTime = room.match_end_time ? new Date(room.match_end_time) : parseMatchEndTimeFromName(room.name);
          if (endTime) {
            const matchEndTimeMs = endTime.getTime();
            const hoursPassed = (now - matchEndTimeMs) / (1000 * 3600);

            if (hoursPassed >= 24) {
              this.deleteChatRoom(room.id, currentUserId).catch(e => console.error('Purge err:', e));
              return null;
            }

            if (hoursPassed >= 1 && !isReadonly) {
              isReadonly = true;
              supabase.from('chat_rooms').update({ is_readonly: true }).eq('id', room.id).then(() => {});
            } else if (hoursPassed < 1 && isReadonly) {
              // Self-Correction: If room was mistakenly set to readonly before match end time, un-lock it
              isReadonly = false;
              supabase.from('chat_rooms').update({ is_readonly: false }).eq('id', room.id).then(() => {});
            }
          }
        }

        const lastMsg = lastMsgMap.get(room.id);
        const lastReadTime = localStorage.getItem(`chat_read_${room.id}`);
        const roomMessages = (allMessages || []).filter(m => m.room_id === room.id && String(m.sender_id) !== String(currentUserId));
        let unreadCount = 0;

        if (lastReadTime) {
          const lastReadMs = new Date(lastReadTime).getTime();
          unreadCount = roomMessages.filter(m => new Date(m.created_at).getTime() > lastReadMs).length;
        } else {
          unreadCount = roomMessages.length;
        }

        let roomName = room.name;
        let avatarUrl = undefined;
        let otherUserId: string | null = null;

        if (room.type === 'permanent_direct') {
          otherUserId = directOtherUserMap.get(room.id) || null;
          if (otherUserId) {
            const otherProfile = profileMap.get(otherUserId);
            if (otherProfile) {
              const cleanName = otherProfile.display_name || ((otherProfile.username && otherProfile.username.toLowerCase() !== 'player') ? otherProfile.username : 'User');
              roomName = cleanName;
              avatarUrl = otherProfile.avatar_url;
            }
          }
        }

        let formattedLastMsg = lastMsg ? lastMsg.content : 'No messages yet';
        if (lastMsg && (roomName || room.name)?.toLowerCase().includes('joinable')) {
          formattedLastMsg = formattedLastMsg
            .replace(/Group created for challenge/i, 'Group created for joinable match')
            .replace(/Group created for match/i, 'Group created for joinable match');
        }

        return {
          ...room,
          name: roomName || 'Chat',
          avatar_url: avatarUrl,
          is_readonly: isReadonly,
          other_user_id: otherUserId,
          last_message: formattedLastMsg,
          last_message_time: lastMsg ? lastMsg.created_at : room.created_at,
          members_count: memberCounts.get(room.id) || 0,
          unread_count: unreadCount
        } as ChatRoom & { other_user_id?: string };
      });

      const filteredHydrated = hydratedRooms.filter(Boolean) as ChatRoom[];

      const sorted = filteredHydrated.sort((a, b) => {
        const timeA = new Date(a.last_message_time || a.created_at).getTime();
        const timeB = new Date(b.last_message_time || b.created_at).getTime();
        return timeB - timeA;
      });

      const finalRooms: ChatRoom[] = [];
      const seenMatchIds = new Set<string>();
      const seenDirectUsers = new Set<string>();

      for (const r of sorted) {
        if (r.type === 'temporary_match' && r.match_id) {
          if (seenMatchIds.has(r.match_id)) {
            this.deleteChatRoom(r.id, currentUserId).catch(e => console.error('Delete dup match room err:', e));
            continue;
          }
          seenMatchIds.add(r.match_id);
        }

        if (r.type === 'permanent_direct' && (r as any).other_user_id) {
          const targetId = (r as any).other_user_id;
          if (seenDirectUsers.has(targetId)) {
            continue;
          }
          seenDirectUsers.add(targetId);
        }

        finalRooms.push(r);
      }

      return finalRooms;
    } catch (err) {
      console.error('Error in getRoomsForUser:', err);
      return [];
    }
  },

  /** Get or create a single 1-on-1 private direct room between friends */
  async getOrCreateDirectRoom(currentUserId: string, friendUserId: string): Promise<ChatRoom | null> {
    try {
      if (!currentUserId || !friendUserId || currentUserId === friendUserId) return null;

      // 1. Find existing room with both members
      const { data: myMemberships } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', currentUserId);

      if (myMemberships && myMemberships.length > 0) {
        const myRoomIds = myMemberships.map(m => m.room_id);

        const { data: friendMemberships } = await supabase
          .from('chat_room_members')
          .select('room_id')
          .eq('user_id', friendUserId)
          .in('room_id', myRoomIds);

        if (friendMemberships && friendMemberships.length > 0) {
          const sharedRoomIds = friendMemberships.map(f => f.room_id);

          const { data: existingDirectRoom } = await supabase
            .from('chat_rooms')
            .select('*')
            .in('id', sharedRoomIds)
            .eq('type', 'permanent_direct')
            .maybeSingle();

          if (existingDirectRoom) {
            return existingDirectRoom as ChatRoom;
          }
        }
      }

      // 2. Create single new direct room
      const { data: newRoom, error: createErr } = await supabase
        .from('chat_rooms')
        .insert({
          type: 'permanent_direct',
          created_by: currentUserId,
          format_capacity: 2
        })
        .select()
        .single();

      if (createErr || !newRoom) throw createErr;

      // Add members
      await supabase.from('chat_room_members').insert([
        { room_id: newRoom.id, user_id: currentUserId, role: 'admin', joined_via: 'invite' },
        { room_id: newRoom.id, user_id: friendUserId, role: 'member', joined_via: 'invite' }
      ]);

      // Insert default system message for direct chat creation
      try {
        let creatorName = 'User';
        let friendName = 'Player';
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, display_name, username')
          .in('id', [currentUserId, friendUserId]);

        if (profs) {
          const pMap = new Map(profs.map(p => [p.id, p]));
          const cP = pMap.get(currentUserId);
          const fP = pMap.get(friendUserId);
          if (cP) creatorName = cP.display_name || ((cP.username && cP.username.toLowerCase() !== 'player') ? cP.username : 'User');
          if (fP) friendName = fP.display_name || ((fP.username && fP.username.toLowerCase() !== 'player') ? fP.username : 'Player');
        }

        await supabase.from('chat_messages').insert({
          room_id: newRoom.id,
          sender_id: currentUserId,
          message_type: 'system',
          content: `${friendName} was added by ${creatorName}`,
          payload_json: {
            type: 'member_added',
            added_user_id: friendUserId,
            host_id: currentUserId,
            host_name: creatorName,
            added_name: friendName
          }
        });

        localStorage.setItem(`chat_read_${newRoom.id}`, new Date().toISOString());
      } catch (sysErr) {
        console.error('Error inserting initial direct message:', sysErr);
      }

      return newRoom as ChatRoom;
    } catch (err) {
      console.error('Error in getOrCreateDirectRoom:', err);
      return null;
    }
  },

  /** Fetch members of a chat room */
  async getRoomMembers(roomId: string): Promise<ChatMember[]> {
    try {
      const { data: members, error } = await supabase
        .from('chat_room_members')
        .select('*')
        .eq('room_id', roomId);

      if (error || !members) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return members.map(m => ({
        ...m,
        username: profileMap.get(m.user_id)?.username,
        display_name: profileMap.get(m.user_id)?.display_name,
        avatar_url: profileMap.get(m.user_id)?.avatar_url
      }));
    } catch (err) {
      console.error('Error fetching room members:', err);
      return [];
    }
  },

  /** Mark room messages as delivered for user in DB */
  async markRoomAsDelivered(roomId: string, userId: string): Promise<void> {
    try {
      if (!roomId || !userId) return;
      await supabase
        .from('chat_messages')
        .update({ status: 'delivered' })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .eq('status', 'sent');
    } catch (err) {
      console.error('Error marking room as delivered:', err);
    }
  },

  /** Mark room as read for user in DB and local storage */
  async markRoomAsRead(roomId: string, userId: string): Promise<void> {
    try {
      if (!roomId || !userId) return;
      const now = new Date().toISOString();
      localStorage.setItem(`chat_read_${roomId}`, now);

      // Permanently update message status in chat_messages table in Supabase DB
      await supabase
        .from('chat_messages')
        .update({ status: 'read' })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .neq('status', 'read');
    } catch (err) {
      console.error('Error marking room as read:', err);
    }
  },

  /** Fetch messages for a chat room with read/delivered status calculation */
  async getMessages(roomId: string, currentUserId?: string, limit: number = 30): Promise<ChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error || !messages) return [];

      const senderIds = Array.from(new Set(messages.map(m => m.sender_id)));
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Query members safely without missing column selection errors
      const { data: mbrs } = await supabase
        .from('chat_room_members')
        .select('user_id')
        .eq('room_id', roomId);

      const otherMembers = (mbrs || []).filter(m => m.user_id !== currentUserId);

      const mappedMessages = messages.map(m => {
        let msgStatus: 'sent' | 'delivered' | 'read' = (m.status as any) || 'sent';

        if (currentUserId && m.sender_id === currentUserId) {
          if (m.status === 'read') {
            msgStatus = 'read';
          } else if (otherMembers.length > 0) {
            msgStatus = 'delivered';
          }
        }

        return {
          ...m,
          sender_username: profileMap.get(m.sender_id)?.username,
          sender_display_name: profileMap.get(m.sender_id)?.display_name,
          sender_avatar_url: profileMap.get(m.sender_id)?.avatar_url,
          status: msgStatus
        };
      });

      // Deduplicate system messages by content / type
      const seenSystemKeys = new Set<string>();
      const finalMessages: ChatMessage[] = [];

      for (const msg of mappedMessages) {
        if (msg.message_type === 'system') {
          const sysType = msg.payload_json?.type || 'sys';
          const addedId = msg.payload_json?.added_user_id || '';
          const key = `${msg.room_id}_${sysType}_${addedId}_${msg.content}`;
          if (seenSystemKeys.has(key)) {
            continue; // Skip duplicate system message
          }
          seenSystemKeys.add(key);
        }
        finalMessages.push(msg);
      }

      return finalMessages;
    } catch (err) {
      console.error('Error fetching messages:', err);
      return [];
    }
  },

  /** Send a text or rich message */
  async sendMessage(roomId: string, senderId: string, content: string, type: 'text' | 'live_score' | 'rsvp_status' | 'payment_card' = 'text', payloadJson: any = {}): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: senderId,
          message_type: type,
          content,
          payload_json: payloadJson
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  },

  /** Create a custom personal group */
  async createPersonalGroup(
    creatorId: string,
    groupName: string,
    memberUserIds: string[]
  ): Promise<ChatRoom | null> {
    try {
      if (!creatorId || !groupName.trim()) return null;

      const cleanGroupName = groupName.trim();

      // 1. Create permanent group room
      const { data: newRoom, error: createErr } = await supabase
        .from('chat_rooms')
        .insert({
          type: 'permanent_group',
          name: cleanGroupName,
          created_by: creatorId,
          format_capacity: 20
        })
        .select()
        .single();

      if (createErr || !newRoom) throw createErr;

      // 2. Fetch creator profile
      let creatorName = 'User';
      const { data: creatorProfile } = await supabase
        .from('user_profiles')
        .select('display_name, username')
        .eq('id', creatorId)
        .maybeSingle();

      if (creatorProfile) {
        creatorName = creatorProfile.display_name || ((creatorProfile.username && creatorProfile.username.toLowerCase() !== 'player') ? creatorProfile.username : 'User');
      }

      // 3. Add creator as admin
      const memberInserts: any[] = [
        { room_id: newRoom.id, user_id: creatorId, role: 'admin', joined_via: 'creator' }
      ];

      // Add other members
      const uniqueMemberIds = Array.from(new Set(memberUserIds)).filter(id => id && id !== creatorId);
      for (const mId of uniqueMemberIds) {
        memberInserts.push({
          room_id: newRoom.id,
          user_id: mId,
          role: 'member',
          joined_via: 'invite'
        });
      }

      await supabase.from('chat_room_members').insert(memberInserts);

      // 4. Initial system message 1: Group created
      await supabase.from('chat_messages').insert({
        room_id: newRoom.id,
        sender_id: creatorId,
        message_type: 'system',
        content: `Group "${cleanGroupName}" created by ${creatorName}`,
        payload_json: { type: 'group_created', host_id: creatorId, host_name: creatorName, group_name: cleanGroupName }
      });

      // 5. Initial system messages for added members
      if (uniqueMemberIds.length > 0) {
        const { data: memberProfiles } = await supabase
          .from('user_profiles')
          .select('id, display_name, username')
          .in('id', uniqueMemberIds);

        const profileMap = new Map((memberProfiles || []).map(p => [p.id, p]));

        for (const mId of uniqueMemberIds) {
          const mProf = profileMap.get(mId);
          const mName = mProf ? (mProf.display_name || ((mProf.username && mProf.username.toLowerCase() !== 'player') ? mProf.username : 'Player')) : 'Player';

          await supabase.from('chat_messages').insert({
            room_id: newRoom.id,
            sender_id: creatorId,
            message_type: 'system',
            content: `${mName} was added by ${creatorName}`,
            payload_json: {
              type: 'member_added',
              added_user_id: mId,
              host_id: creatorId,
              host_name: creatorName,
              added_name: mName
            }
          });
        }
      }

      // 6. Mark read timestamp for creator so creator doesn't get unread badge for own creation
      localStorage.setItem(`chat_read_${newRoom.id}`, new Date().toISOString());

      return newRoom as ChatRoom;
    } catch (err) {
      console.error('Error creating personal group:', err);
      return null;
    }
  },

  /** Add member to room (enforces capacity limit) */
  async addMemberToRoom(roomId: string, targetUserId: string, hostUserId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('format_capacity')
        .eq('id', roomId)
        .single();

      const { count } = await supabase
        .from('chat_room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);

      if (room && count !== null && count >= room.format_capacity) {
        return { success: false, message: `Room capacity limit reached (${room.format_capacity} max players).` };
      }

      const { error } = await supabase
        .from('chat_room_members')
        .insert({
          room_id: roomId,
          user_id: targetUserId,
          role: 'member',
          joined_via: 'invite'
        });

      if (error) throw error;

      // Insert system message for member addition
      try {
        let hostName = 'Host';
        let targetName = 'Player';
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, display_name, username')
          .in('id', [hostUserId, targetUserId]);

        if (profs) {
          const pMap = new Map(profs.map(p => [p.id, p]));
          const hP = pMap.get(hostUserId);
          const tP = pMap.get(targetUserId);
          if (hP) hostName = hP.display_name || ((hP.username && hP.username.toLowerCase() !== 'player') ? hP.username : 'Host');
          if (tP) targetName = tP.display_name || ((tP.username && tP.username.toLowerCase() !== 'player') ? tP.username : 'Player');
        }

        await supabase.from('chat_messages').insert({
          room_id: roomId,
          sender_id: hostUserId,
          message_type: 'system',
          content: `${targetName} was added by ${hostName}`,
          payload_json: {
            type: 'member_added',
            added_user_id: targetUserId,
            host_id: hostUserId,
            host_name: hostName,
            added_name: targetName
          }
        });
      } catch (sysErr) {
        console.error('Error inserting add member system message:', sysErr);
      }

      return { success: true };
    } catch (err) {
      console.error('Error adding member:', err);
      return { success: false, message: 'Failed to add member.' };
    }
  },

  /** Kick member from room (Creator/Host only) */
  async kickMember(roomId: string, targetUserId: string, hostUserId: string): Promise<boolean> {
    try {
      const { data: hostMember } = await supabase
        .from('chat_room_members')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', hostUserId)
        .single();

      if (hostMember?.role !== 'admin') {
        console.error('Only group admin can kick members.');
        return false;
      }

      const { error } = await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', targetUserId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error kicking member:', err);
      return false;
    }
  }
};
