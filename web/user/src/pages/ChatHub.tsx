import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Pin, Send, Paperclip, CheckCheck, Users,
  X, UserPlus, UserMinus, Trash2, Lock, ShieldCheck, ChevronLeft, MapPin, Check, Clock, UserCheck,
  MoreVertical, Eraser, Zap, Navigation, Trophy, CreditCard
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';
import { messagingService, ChatRoom, ChatMessage, ChatMember } from '../services/messagingService';
import { friendService, FriendProfile } from '../services/friendService';
import UserProfileModal from '../components/UserProfileModal';
import Modal from '../components/Modal';
import { forceScrollTop } from '../utils/scroll';

interface ChatHubProps {
  currentUser: any;
  onBack?: () => void;
}

export const ChatHub: React.FC<ChatHubProps> = ({ currentUser, onBack }) => {
  const { theme } = useTheme();

  // State
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'matches' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchUserResults, setGlobalSearchUserResults] = useState<FriendProfile[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showGroupDrawer, setShowGroupDrawer] = useState(false); // Laptop 3rd column toggle
  const [activeMenuRoomId, setActiveMenuRoomId] = useState<string | null>(null); // 3-dots dropdown state
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false); // Quick messages dropdown state

  // Linked match financial info from payments table
  const [linkedMatchInfo, setLinkedMatchInfo] = useState<{
    type: 'challenge' | 'matchmaking' | 'none';
    lose_to_pay?: boolean;
    amount?: number;
    advance_price?: number;
    max_players?: number;
    myPaid?: number;
    otherPaid?: number;
    totalPaid?: number;
  } | null>(null);

  // Connect & Profile Modal state
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [matchArenaLocation, setMatchArenaLocation] = useState<{
    arenaName: string;
    address: string;
    mapsUrl: string;
  } | null>(null);
  const [connectStatus, setConnectStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none');
  const [inspectingUserProfile, setInspectingUserProfile] = useState<any | null>(null);

  // Mobile navigation state
  const [mobileView, setMobileView] = useState<'list' | 'detail' | 'info'>('list');

  // Custom Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDanger?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDanger: false,
    onConfirm: () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Search & add user state
  const [searchFriendsQuery, setSearchFriendsQuery] = useState('');
  const [searchFriendResults, setSearchFriendResults] = useState<FriendProfile[]>([]);

  // Create Group Modal State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<FriendProfile[]>([]);
  const [searchGroupFriendsQuery, setSearchGroupFriendsQuery] = useState('');
  const [searchGroupFriendsResults, setSearchGroupFriendsResults] = useState<FriendProfile[]>([]);

  const handleSearchGroupFriends = async (query: string) => {
    setSearchGroupFriendsQuery(query);
    if (!query.trim() || !currentUser?.id) {
      setSearchGroupFriendsResults([]);
      return;
    }
    const res = await friendService.searchUsersByUsername(query, currentUser.id);
    const existingSelectedIds = new Set(selectedFriendsForGroup.map(s => s.id));
    setSearchGroupFriendsResults(res.filter(u => !existingSelectedIds.has(u.id)));
  };

  const handleCreatePersonalGroup = async () => {
    if (!groupNameInput.trim()) {
      alert('Please enter a group name');
      return;
    }
    if (!currentUser?.id) return;

    setCreateGroupLoading(true);
    try {
      const memberIds = selectedFriendsForGroup.map(f => f.id);
      const newRoom = await messagingService.createPersonalGroup(currentUser.id, groupNameInput, memberIds);
      if (newRoom) {
        setShowCreateGroupModal(false);
        setGroupNameInput('');
        setSelectedFriendsForGroup([]);
        setSearchGroupFriendsQuery('');
        setSearchGroupFriendsResults([]);
        await loadRooms();
        setActiveRoom(newRoom);
        loadMessagesAndMembers(newRoom.id);
      } else {
        alert('Failed to create group. Please try again.');
      }
    } catch (e) {
      console.error('Error creating group:', e);
      alert('Failed to create group.');
    } finally {
      setCreateGroupLoading(false);
    }
  };

  // Auto-scroll ref for inner messages container
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Keep main page window scrolled to top when room changes
  useEffect(() => {
    return forceScrollTop();
  }, [activeRoom?.id]);

  // Auto-scroll ONLY the inner chat messages container to bottom on message updates or active room switch
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      // Multi-pass reset in case of images or layout shifts
      const raf = requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [messages, activeRoom?.id]);

  // Monotonic status progression helper (prevents flashing backwards from read -> sent)
  const getMonotonicStatus = (current?: string, next?: string): 'sending' | 'sent' | 'delivered' | 'read' => {
    const rank: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3 };
    const rCurrent = rank[current || 'sent'] ?? 1;
    const rNext = rank[next || 'sent'] ?? 1;
    return (rNext >= rCurrent ? next : current) as any;
  };

  // WhatsApp-style message delivery/read status tick renderer
  const renderMessageStatus = (msg: ChatMessage) => {
    if (msg.sender_id !== currentUser?.id) return null;

    if (msg.id.startsWith('temp-') || msg.status === 'sending') {
      return <Clock className="w-3 h-3 text-white/70 animate-pulse shrink-0" />;
    }

    if (msg.status === 'read') {
      return <CheckCheck className="w-3 h-3 text-sky-300 shrink-0" />;
    }

    if (msg.status === 'delivered') {
      return <CheckCheck className="w-3 h-3 text-white/80 shrink-0" />;
    }

    // Default for sent messages: Single Grey Tick
    return <Check className="w-3 h-3 text-white/70 shrink-0" />;
  };

  useEffect(() => {
    let isMounted = true;

    const initLoad = async () => {
      setLoading(true);
      await loadRooms();
      if (isMounted) setLoading(false);
    };

    initLoad();

    const handleFocus = () => loadRooms();
    window.addEventListener('focus', handleFocus);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        loadRooms();
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
      subscription.unsubscribe();
    };
  }, [currentUser]);

  // Global user search by @username or name
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const currentId = currentUser?.id || '';
      friendService.searchUsersByUsername(searchQuery, currentId).then(res => {
        setGlobalSearchUserResults(res);
      });
    } else {
      setGlobalSearchUserResults([]);
    }
  }, [searchQuery, currentUser?.id]);

  // Global Realtime listener for mark as delivered when app is open
  useEffect(() => {
    if (!currentUser?.id) return;

    const globalChannel = supabase
      .channel(`global_user_delivery_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          if (newMsg.sender_id !== currentUser.id) {
            const isActiveRoom = activeRoom?.id === newMsg.room_id;
            if (isActiveRoom) {
              messagingService.markRoomAsRead(newMsg.room_id, currentUser.id);
            } else {
              messagingService.markRoomAsDelivered(newMsg.room_id, currentUser.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [currentUser?.id, activeRoom?.id]);

  // Realtime messages & read receipts subscription for active room
  useEffect(() => {
    if (!activeRoom?.id || !currentUser?.id) return;

    const channelName = `room_realtime_${activeRoom.id}`;
    const roomChannel = supabase.channel(channelName);

    roomChannel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          if (newMsg.room_id === activeRoom.id) {
            const isFromMe = newMsg.sender_id === currentUser.id;

            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;

              if (newMsg.message_type === 'system') {
                const isDupSys = prev.some(m =>
                  m.message_type === 'system' &&
                  m.content === newMsg.content &&
                  m.payload_json?.type === newMsg.payload_json?.type &&
                  String(m.payload_json?.added_user_id || '') === String(newMsg.payload_json?.added_user_id || '')
                );
                if (isDupSys) return prev;
              }

              const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.sender_id === newMsg.sender_id && m.content === newMsg.content);
              const msgWithStatus: ChatMessage = {
                ...newMsg,
                status: isFromMe ? (newMsg.status || 'sent') : 'read'
              };

              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = {
                  ...msgWithStatus,
                  sender_username: prev[tempIndex].sender_username || newMsg.sender_username,
                  status: getMonotonicStatus(prev[tempIndex].status, msgWithStatus.status)
                };
                return updated;
              }

              return [...prev, msgWithStatus];
            });

            // If message is from someone else, mark room as read and broadcast read status to sender!
            if (!isFromMe) {
              messagingService.markRoomAsRead(activeRoom.id, currentUser.id);
              roomChannel.send({
                type: 'broadcast',
                event: 'chat_room_read',
                payload: {
                  room_id: activeRoom.id,
                  user_id: currentUser.id,
                  read_at: new Date().toISOString()
                }
              });
            }
          }

          // Update room list last message and unread count
          setRooms(prevRooms =>
            prevRooms.map(r => {
              if (r.id === newMsg.room_id) {
                const isCurrentActive = activeRoom?.id === r.id;
                return {
                  ...r,
                  last_message: newMsg.content,
                  last_message_time: newMsg.created_at,
                  unread_count: isCurrentActive ? 0 : ((r.unread_count || 0) + 1)
                };
              }
              return r;
            })
          );
        }
      )
      .on('broadcast', { event: 'chat_room_read' }, (payload) => {
        const p = payload.payload || {};
        if (p.room_id === activeRoom.id && p.user_id !== currentUser.id) {
          const readTime = new Date(p.read_at || Date.now()).getTime();
          setMessages(prev => prev.map(m => {
            if (m.sender_id === currentUser.id) {
              const mTime = new Date(m.created_at).getTime();
              if (mTime <= readTime) {
                return { ...m, status: 'read' };
              }
            }
            return m;
          }));
        }
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const updatedMsg = payload.new as ChatMessage;
          if (updatedMsg.room_id === activeRoom.id) {
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, status: getMonotonicStatus(m.status, updatedMsg.status) } : m));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Immediately mark room as read and broadcast read status upon subscribing
          messagingService.markRoomAsRead(activeRoom.id, currentUser.id);
          roomChannel.send({
            type: 'broadcast',
            event: 'chat_room_read',
            payload: {
              room_id: activeRoom.id,
              user_id: currentUser.id,
              read_at: new Date().toISOString()
            }
          });
        }
      });

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [activeRoom?.id, currentUser?.id]);

  useEffect(() => {
    if (activeRoom?.id && currentUser?.id) {
      loadMessagesAndMembers(activeRoom.id);
      checkConnectionStatus(activeRoom);
      messagingService.markRoomAsRead(activeRoom.id, currentUser.id);
      setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, unread_count: 0 } : r));
    }
  }, [activeRoom?.id, currentUser?.id]);

  const checkConnectionStatus = async (room: ChatRoom) => {
    if (room.type !== 'permanent_direct' || !currentUser?.id) {
      setIsConnected(true);
      setConnectStatus('accepted');
      return;
    }
    const mbrs = await messagingService.getRoomMembers(room.id);
    const other = mbrs.find(m => m.user_id !== currentUser.id);
    if (!other) {
      setIsConnected(true);
      setConnectStatus('accepted');
      return;
    }

    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${other.user_id}),and(user_id_1.eq.${other.user_id},user_id_2.eq.${currentUser.id})`)
      .maybeSingle();

    if (!friendship || friendship.status !== 'accepted') {
      setIsConnected(false);
      if (friendship && friendship.status === 'pending') {
        if (friendship.user_id_1 === currentUser.id) {
          setConnectStatus('pending_sent');
        } else {
          setConnectStatus('pending_received');
        }
      } else {
        setConnectStatus('none');
      }
    } else {
      setIsConnected(true);
      setConnectStatus('accepted');
    }
  };

  const loadRooms = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = currentUser?.id || authData?.user?.id || sessionData?.session?.user?.id;

      if (!userId) return;

      const data = await messagingService.getRoomsForUser(userId);
      setRooms(data);

      // Never auto-open any chat; preserve user's explicit selection if already open
      if (data.length > 0) {
        setActiveRoom(prev => {
          if (!prev) return null;
          return data.find(r => r.id === prev.id) || prev;
        });
      }
    } catch (e) {
      console.error('Error in loadRooms:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMessagesAndMembers = async (roomId: string, showLoading: boolean = true) => {
    if (showLoading) setMessagesLoading(true);
    const msgs = await messagingService.getMessages(roomId, currentUser?.id, 30);
    const mbrs = await messagingService.getRoomMembers(roomId);
    setMembers(mbrs);

    // Fetch linked match financial details and payments table records
    if (activeRoom?.match_id) {
      try {
        let myPaid = 0;
        let otherPaid = 0;
        const currentUserId = currentUser?.id || '';

        // Query payments table directly (same as Transactions page)
        const { data: paymentRows } = await supabase
          .from('payments')
          .select('*')
          .or(`challenge_id.eq.${activeRoom.match_id},booking_id.eq.${activeRoom.match_id}`);

        if (paymentRows && paymentRows.length > 0) {
          paymentRows.forEach(p => {
            const amt = Number(p.amount || 0);
            if (String(p.user_id) === String(currentUserId)) {
              myPaid += amt;
            } else {
              otherPaid += amt;
            }
          });
        }

        let arenaLocInfo = {
          arenaName: 'Boxitt Sports Turf, Chowder Guda',
          address: 'Ghatkesar Mandal, Hyderabad',
          mapsUrl: 'https://maps.google.com/?q=Boxitt+Arena'
        };

        const { data: chal } = await supabase
          .from('challenges')
          .select('*')
          .eq('id', activeRoom.match_id)
          .maybeSingle();

        if (chal) {
          const locId = chal.box_id || chal.location_id || chal.locationId;
          if (locId) {
            const { data: loc } = await supabase
              .from('locations')
              .select('name, address, latitude, longitude')
              .eq('id', locId)
              .maybeSingle();
            if (loc) {
              const name = loc.name || 'Boxitt Sports Turf';
              const addr = loc.address || 'Hyderabad';
              const maps = loc.latitude && loc.longitude ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}` : `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + addr)}`;
              arenaLocInfo = { arenaName: name, address: addr, mapsUrl: maps };
            }
          }
          const totalAmt = Number(chal.amount || 0);
          const advAmt = Number(chal.advance_price || Math.round(totalAmt / 2));
          const effectiveMyPaid = myPaid === 0 && String(currentUserId) === String(chal.challenger_id) ? advAmt : myPaid;
          setLinkedMatchInfo({
            type: 'challenge',
            lose_to_pay: !!chal.lose_to_pay,
            amount: totalAmt,
            advance_price: advAmt,
            myPaid: effectiveMyPaid,
            otherPaid,
            totalPaid: effectiveMyPaid + otherPaid
          });
        } else {
          const { data: bk } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', activeRoom.match_id)
            .maybeSingle();

          if (bk) {
            const locId = bk.box_id || bk.location_id || bk.locationId;
            if (locId) {
              const { data: loc } = await supabase
                .from('locations')
                .select('name, address, latitude, longitude')
                .eq('id', locId)
                .maybeSingle();
              if (loc) {
                const name = loc.name || 'Boxitt Sports Turf';
                const addr = loc.address || 'Hyderabad';
                const maps = loc.latitude && loc.longitude ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}` : `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + addr)}`;
                arenaLocInfo = { arenaName: name, address: addr, mapsUrl: maps };
              }
            }
            const bkAdv = Number(bk.advance_paid || bk.advancePaid || 0);
            const effectiveMyPaid = myPaid === 0 && String(currentUserId) === String(bk.user_id) ? bkAdv : myPaid;
            setLinkedMatchInfo({
              type: 'matchmaking',
              amount: Number(bk.amount || bk.total_price || 0),
              max_players: Number(bk.max_players || 10),
              myPaid: effectiveMyPaid,
              otherPaid,
              totalPaid: effectiveMyPaid + otherPaid
            });
          } else {
            setLinkedMatchInfo(null);
          }
        }
        setMatchArenaLocation(arenaLocInfo);
      } catch (e) {
        console.error('Error fetching linked match details:', e);
        setLinkedMatchInfo(null);
        setMatchArenaLocation(null);
      }
    } else {
      setLinkedMatchInfo(null);
      setMatchArenaLocation(null);
    }

    setMessages(prev => {
      const pendingTemps = prev.filter(m => m.id.startsWith('temp-') && !msgs.some(dbM => dbM.sender_id === m.sender_id && dbM.content === m.content));
      const dbMsgsHydrated = msgs.map(m => {
        const existing = prev.find(p => p.id === m.id);
        return {
          ...m,
          status: (existing?.status === 'read' || m.status === 'read') ? 'read' : (m.status || existing?.status || 'sent')
        } as ChatMessage;
      });
      return [...dbMsgsHydrated, ...pendingTemps];
    });
    if (showLoading) setMessagesLoading(false);
  };

  const requestClearChat = (roomId: string) => {
    setActiveMenuRoomId(null);
    setShowHeaderMenu(false);
    setConfirmModalState({
      isOpen: true,
      title: 'Clear Messages',
      message: 'Are you sure you want to clear all messages in this chat? All message history in this chat room will be erased.',
      confirmText: 'Clear Messages',
      cancelText: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        const ok = await messagingService.clearChatMessages(roomId);
        if (ok) {
          if (activeRoom?.id === roomId) {
            setMessages([]);
          }
          setRooms(prev => prev.map(r => r.id === roomId ? { ...r, last_message: 'No messages yet' } : r));
        }
        setConfirmLoading(false);
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const requestDeleteChat = (roomId: string) => {
    setActiveMenuRoomId(null);
    setShowHeaderMenu(false);
    setConfirmModalState({
      isOpen: true,
      title: 'Delete Chat Room',
      message: 'Are you sure you want to delete this chat room permanently from the database? All messages and chat records will be deleted completely.',
      confirmText: 'Delete Chat',
      cancelText: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        setConfirmLoading(true);
        const userId = currentUser?.id || '';
        const ok = await messagingService.deleteChatRoom(roomId, userId);
        if (ok) {
          setRooms(prev => prev.filter(r => r.id !== roomId));
          if (activeRoom?.id === roomId) {
            setActiveRoom(null);
            setMobileView('list');
          }
        }
        setConfirmLoading(false);
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleStartDirectChat = async (targetUser: FriendProfile) => {
    if (!currentUser?.id) return;
    const room = await messagingService.getOrCreateDirectRoom(currentUser.id, targetUser.id);
    if (room) {
      await loadRooms();
      setMessages([]);
      setMessagesLoading(true);
      setActiveRoom(room);
      setMobileView('detail');
      setSearchQuery('');
      setGlobalSearchUserResults([]);
    }
  };

  const handleConnectRequest = async () => {
    if (!activeRoom || !currentUser?.id) return;
    const otherMember = members.find(m => m.user_id !== currentUser.id);
    if (!otherMember) return;

    await friendService.sendFriendRequest(currentUser.id, otherMember.user_id);

    try {
      const handleName = currentUser.display_name || currentUser.username || 'A player';
      await supabase.from('notifications').insert([
        {
          user_id: otherMember.user_id,
          title: 'NEW CONNECT REQUEST',
          message: `${handleName} sent you a Connect Request in Chat.`,
          is_read: false,
          data: {
            type: 'chat_connect_request',
            sender_id: currentUser.id
          }
        }
      ]);
    } catch (e) {
      console.error('Error sending connect notification:', e);
    }

    const otherName = otherMember.display_name || otherMember.username || 'user';
    const senderName = currentUser.display_name || currentUser.username || 'user';
    await messagingService.sendMessage(
      activeRoom.id,
      currentUser.id,
      `🤝 Connect request sent to ${otherName}`,
      'system',
      {
        type: 'connect_request',
        sender_id: currentUser.id,
        sender_name: senderName,
        recipient_name: otherName
      }
    );

    setIsConnected(false);
    setConnectStatus('pending_sent');
    loadMessagesAndMembers(activeRoom.id);
  };

  const handleAcceptConnectRequest = async () => {
    if (!activeRoom || !currentUser?.id) return;
    const otherMember = members.find(m => m.user_id !== currentUser.id);
    if (!otherMember) return;

    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${otherMember.user_id}),and(user_id_1.eq.${otherMember.user_id},user_id_2.eq.${currentUser.id})`)
      .maybeSingle();

    if (friendship) {
      await friendService.acceptFriendRequest(friendship.id);
    }

    const otherName = otherMember.display_name || otherMember.username || 'user';
    await messagingService.sendMessage(activeRoom.id, currentUser.id, `🟢 You and ${otherName} are now connected!`, 'system');

    setIsConnected(true);
    setConnectStatus('accepted');
    loadMessagesAndMembers(activeRoom.id);
  };

  const handleUnconnectRequest = async () => {
    if (!activeRoom || !currentUser?.id) return;
    const otherMember = members.find(m => m.user_id !== currentUser.id);
    if (!otherMember) return;

    const otherName = otherMember.display_name || otherMember.username || 'user';

    setConfirmModalState({
      isOpen: true,
      title: 'UNCONNECT DIRECT CHAT',
      message: `Are you sure you want to unconnect with ${otherName}? This will unfriend them and restore the message limit.`,
      confirmText: 'Unconnect',
      cancelText: 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        await friendService.removeFriend(currentUser.id, otherMember.user_id);
        await messagingService.sendMessage(
          activeRoom.id,
          currentUser.id,
          `🔴 You and ${otherName} are no longer connected.`,
          'system'
        );
        setIsConnected(false);
        setConnectStatus('none');
        loadMessagesAndMembers(activeRoom.id);
      }
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeRoom || !currentUser?.id) return;
    const text = inputMessage.trim();
    setInputMessage('');

    // Instant Optimistic Message Bubble (0ms Delay)
    const tempId = `temp-${Date.now()}`;
    const senderName = currentUser.display_name || currentUser.username || 'you';
    const optimisticMsg: ChatMessage = {
      id: tempId,
      room_id: activeRoom.id,
      sender_id: currentUser.id,
      message_type: 'text',
      content: text,
      created_at: new Date().toISOString(),
      sender_username: senderName,
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setRooms(prevRooms =>
      prevRooms.map(r => r.id === activeRoom.id ? { ...r, last_message: text, last_message_time: optimisticMsg.created_at } : r)
    );

    // Send to Supabase asynchronously in background
    const ok = await messagingService.sendMessage(activeRoom.id, currentUser.id, text, 'text');
    if (!ok) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      loadMessagesAndMembers(activeRoom.id, false);
    }
  };

  const handleSendQuickAction = async (type: 'rsvp' | 'location' | 'score' | 'payment', label: string, payload: any = {}) => {
    if (!activeRoom || !currentUser?.id) return;
    setShowQuickMenu(false);

    let msgType: 'text' | 'live_score' | 'rsvp_status' | 'payment_card' | 'location_card' = 'rsvp_status';
    let contentText = label;

    if (type === 'location') {
      msgType = 'location_card' as any;
      const aName = matchArenaLocation?.arenaName || 'Boxitt Sports Turf, Chowder Guda';
      const aAddr = matchArenaLocation?.address || 'Ghatkesar Mandal, Hyderabad';
      const aMaps = matchArenaLocation?.mapsUrl || 'https://maps.google.com/?q=Boxitt+Arena';
      contentText = `📍 ${aName} Location`;
      payload = {
        arenaName: aName,
        address: aAddr,
        mapsUrl: aMaps
      };
    } else if (type === 'score') {
      msgType = 'live_score';
      contentText = '🏆 Match Score Update: 42/2 (4.2 overs)';
    } else if (type === 'payment') {
      msgType = 'payment_card';
      const myPaid = linkedMatchInfo?.myPaid || 0;
      const otherPaid = linkedMatchInfo?.otherPaid || 0;
      const totalPaid = myPaid + otherPaid;

      if (linkedMatchInfo?.type === 'challenge') {
        const total = linkedMatchInfo.amount || 0;
        const remainingTotal = Math.max(0, total - totalPaid);
        const myRemainingShare = Math.max(0, Math.round(remainingTotal / 2));

        if (linkedMatchInfo.lose_to_pay) {
          contentText = `💳 Loser-Pays Challenge: ₹${myPaid} Paid • ₹${remainingTotal} Remaining`;
          payload = {
            mode: 'loser_pays',
            title: 'Loser-Pays Challenge',
            totalAmount: total,
            totalPaid,
            myPaid,
            otherPaid,
            remainingTotal,
            myRemainingShare: remainingTotal,
            text: `Total Court Fee: ₹${total} | Total Paid: ₹${totalPaid}. You Paid: ₹${myPaid}. Match loser pays remaining ₹${remainingTotal}.`
          };
        } else {
          contentText = `💳 Equal Challenge Split: ₹${myPaid} Paid • ₹${myRemainingShare} Remaining`;
          payload = {
            mode: 'equal_split',
            title: 'Equal Challenge Fee Split',
            totalAmount: total,
            totalPaid,
            myPaid,
            otherPaid,
            remainingTotal,
            myRemainingShare,
            text: `Total Court Fee: ₹${total} | Total Paid: ₹${totalPaid}. You Paid: ₹${myPaid}. Your Remaining Share to Pay: ₹${myRemainingShare} (Half-Half).`
          };
        }
      } else if (linkedMatchInfo?.type === 'matchmaking') {
        const total = linkedMatchInfo.amount || 0;
        const slots = linkedMatchInfo.max_players || 10;
        const ticketPrice = Math.round(total / slots);
        const myRemainingShare = Math.max(0, ticketPrice - myPaid);

        contentText = `💳 Matchmaking Ticket: ₹${myPaid} Paid • ₹${myRemainingShare} Remaining`;
        payload = {
          mode: 'matchmaking',
          title: 'Matchmaking Ticket Price',
          totalAmount: total,
          perPlayer: ticketPrice,
          maxPlayers: slots,
          totalPaid,
          myPaid,
          remainingTotal: Math.max(0, total - totalPaid),
          myRemainingShare,
          text: `Slot Ticket Price: ₹${ticketPrice} | You Paid: ₹${myPaid}. Total Court Fee Paid: ₹${totalPaid} / ₹${total}.`
        };
      } else {
        contentText = `💳 Turf Fee Summary: ₹${myPaid} Paid`;
        payload = {
          mode: 'custom',
          title: 'Turf Fee Breakdown',
          myPaid,
          text: `You have paid ₹${myPaid} towards court booking.`
        };
      }
    } else {
      const name = currentUser.display_name || currentUser.username || 'A player';
      contentText = `${name} updated RSVP: ${label}`;
    }

    // Instant Optimistic Message Bubble for Quick Actions (0ms Delay)
    const tempId = `temp-${Date.now()}`;
    const senderName = currentUser.display_name || currentUser.username || 'you';
    const optimisticMsg: ChatMessage = {
      id: tempId,
      room_id: activeRoom.id,
      sender_id: currentUser.id,
      message_type: msgType as any,
      content: contentText,
      payload_json: payload,
      created_at: new Date().toISOString(),
      sender_username: senderName,
      status: 'sending'
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setRooms(prevRooms =>
      prevRooms.map(r => r.id === activeRoom.id ? { ...r, last_message: contentText, last_message_time: optimisticMsg.created_at } : r)
    );

    const ok = await messagingService.sendMessage(activeRoom.id, currentUser.id, contentText, msgType as any, payload);
    if (!ok) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      loadMessagesAndMembers(activeRoom.id, false);
    }
  };

  const handleAddMember = async (targetUserId: string) => {
    if (!activeRoom || !currentUser?.id) return;
    const res = await messagingService.addMemberToRoom(activeRoom.id, targetUserId, currentUser.id);
    if (res.success) {
      loadMessagesAndMembers(activeRoom.id);
      setSearchFriendsQuery('');
      setSearchFriendResults([]);
    } else {
      alert(res.message);
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!activeRoom || !currentUser?.id) return;
    const ok = await messagingService.kickMember(activeRoom.id, targetUserId, currentUser.id);
    if (ok) {
      loadMessagesAndMembers(activeRoom.id);
    }
  };

  const handleSearchFriends = async (query: string) => {
    setSearchFriendsQuery(query);
    if (!query.trim() || !currentUser?.id) {
      setSearchFriendResults([]);
      return;
    }
    const res = await friendService.searchUsersByUsername(query, currentUser.id);
    setSearchFriendResults(res);
  };

  const filteredRooms = rooms.filter(r => {
    if (filter === 'unread' && (!r.unread_count || r.unread_count === 0)) return false;
    if (filter === 'matches' && r.type !== 'temporary_match') return false;
    if (filter === 'groups' && r.type !== 'permanent_group') return false;
    if (searchQuery) {
      return (r.name || 'Chat').toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Calculate 1-message inquiry limit for non-connected direct chats
  const mySentMessagesInRoom = messages.filter(m => m.sender_id === currentUser?.id && m.message_type === 'text').length;
  const isDirectChat = activeRoom?.type === 'permanent_direct';
  const isMessageLimitReached = isDirectChat && !isConnected && mySentMessagesInRoom >= 1;

  const otherMember = members.find(m => m.user_id !== currentUser?.id);
  const activeRoomTitle = activeRoom?.name || (otherMember ? (otherMember.display_name || otherMember.username || 'Boxitt Chat') : 'Boxitt Chat');

  return (
    <div className="w-full h-screen flex bg-background overflow-hidden text-text-primary">
      {/* ========================================================= */}
      {/* LEFT PANEL: Chat List (Visible on Laptop or Mobile 'list') */}
      {/* ========================================================= */}
      <div className={`w-full lg:w-96 border-r flex flex-col shrink-0 ${
        mobileView !== 'list' ? 'hidden lg:flex' : 'flex'
      }`} style={{ borderColor: theme.colors.border }}>

        {/* Header & Filter Pills */}
        <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center justify-between">
            {onBack && (
              <button onClick={onBack} className="lg:hidden p-2 rounded-xl hover:bg-background-secondary">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-black italic tracking-wider uppercase">Messages</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="px-2.5 py-1 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:opacity-90 shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                <span>+ Group</span>
              </button>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-black text-accent text-xs shrink-0">
                {rooms.length}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              placeholder="Search or start a chat (@username)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-background-secondary border border-border text-xs focus:outline-none focus:border-accent"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {(['all', 'unread', 'matches', 'groups'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  filter === f ? 'bg-accent text-white shadow-md' : 'bg-background-secondary opacity-60 hover:opacity-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Global User Search Results */}
        {globalSearchUserResults.length > 0 && (
          <div className="p-3 border-b bg-accent/5 space-y-2" style={{ borderColor: theme.colors.border }}>
            <span className="text-[9px] font-black uppercase tracking-widest text-accent block">
              Global Players
            </span>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {globalSearchUserResults.map(u => {
                const rawUsername = (u.username && u.username.toLowerCase() !== 'player') ? u.username : '';
                const cleanName = u.display_name || rawUsername || 'User';
                const handleTag = `@${(rawUsername || cleanName).toLowerCase().replace(/\s+/g, '_')}`;

                return (
                  <div
                    key={u.id}
                    onClick={() => handleStartDirectChat(u)}
                    className="p-2.5 rounded-xl bg-background hover:bg-background-secondary border border-border flex items-center justify-between cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-black text-xs shrink-0 overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="User" className="w-full h-full object-cover" />
                        ) : (
                          <span>{cleanName.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black italic uppercase truncate">{cleanName}</p>
                        <p className="text-[10px] opacity-60 truncate">{handleTag}</p>
                      </div>
                    </div>
                    <UserPlus className="w-4 h-4 text-accent shrink-0 ml-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Room Items List */}
        <div className="flex-1 overflow-y-auto space-y-1 p-2">
          {loading ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-3 rounded-2xl bg-background-secondary/40 border border-border/40 animate-pulse flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-background-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 bg-background-secondary rounded-lg" />
                    <div className="h-2.5 w-1/2 bg-background-secondary rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12 opacity-40 text-xs font-black uppercase tracking-widest">
              No chats found
            </div>
          ) : (
            filteredRooms.map(room => {
              const isSelected = activeRoom?.id === room.id;
              const isMatch = room.type === 'temporary_match';
              const isMenuOpen = activeMenuRoomId === room.id;

              return (
                <div
                  key={room.id}
                  onClick={() => {
                    if (activeRoom?.id !== room.id) {
                      setMessages([]); // Clears old room messages immediately on switch
                      setMessagesLoading(true);
                    }
                    setActiveRoom(room);
                    setMobileView('detail');
                    setRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count: 0 } : r));
                  }}
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border relative group ${
                    isSelected ? 'bg-accent/15 border-accent shadow-sm' : 'border-transparent hover:bg-background-secondary/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-background-secondary border border-border flex items-center justify-center relative overflow-hidden shrink-0">
                    {room.avatar_url ? (
                      <img src={room.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : isMatch ? (
                      <Users className="w-5 h-5 text-accent" />
                    ) : (
                      <Users className="w-5 h-5 opacity-40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black italic text-xs uppercase truncate">
                        {room.name || (isMatch ? 'Match Lobby' : 'Direct Chat')}
                      </h4>
                      <span className="text-[9px] font-bold opacity-40">
                        {room.last_message_time ? new Date(room.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-[11px] opacity-60 truncate font-medium flex-1">
                        {room.last_message}
                      </p>
                      {!!room.unread_count && room.unread_count > 0 ? (
                        <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[9px] font-black flex items-center justify-center shrink-0 shadow-md">
                          {room.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* 3-Dots Action Button for Card */}
                  <div className="relative shrink-0 flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuRoomId(isMenuOpen ? null : room.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-all"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Card Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-8 z-50 w-44 bg-background border border-border rounded-xl shadow-2xl p-1.5 space-y-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestClearChat(room.id);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2"
                        >
                          <Eraser className="w-3.5 h-3.5 text-amber-400" />
                          <span>Clear Messages</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteChat(room.id);
                          }}
                          className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold text-error hover:bg-error/10 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-error" />
                          <span>Delete Chat</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MIDDLE PANEL: Active Chat Area */}
      {/* ========================================================= */}
      <div className={`flex-1 flex flex-col min-w-0 bg-background ${
        mobileView === 'list' ? 'hidden lg:flex' : mobileView === 'info' ? 'hidden lg:flex' : 'flex'
      }`}>
        {activeRoom ? (
          <>
            {/* Top Bar Header */}
            <div
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setShowGroupDrawer(!showGroupDrawer);
                } else {
                  setMobileView('info');
                }
              }}
              className="p-3 border-b flex items-center justify-between cursor-pointer bg-background-secondary/30 hover:bg-background-secondary/60 transition-all select-none relative"
              style={{ borderColor: theme.colors.border }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMobileView('list');
                  }}
                  className="lg:hidden p-1.5 rounded-xl hover:bg-background-secondary"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (otherMember) {
                      setInspectingUserProfile({
                        id: otherMember.user_id,
                        username: otherMember.username,
                        display_name: otherMember.display_name,
                        avatar_url: otherMember.avatar_url
                      });
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-black text-xs hover:scale-105 transition-all overflow-hidden"
                >
                  {activeRoom.avatar_url || otherMember?.avatar_url ? (
                    <img src={activeRoom.avatar_url || otherMember?.avatar_url} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-black italic text-sm uppercase truncate">
                    {activeRoomTitle}
                  </h3>
                  <p className="text-[10px] font-bold opacity-50 uppercase tracking-wider">
                    {members.length} Members • Tap for Info / Profile
                  </p>
                </div>
              </div>

              {/* Top Header Actions (3-Dots Menu) */}
              <div className="flex items-center gap-2">
                {/* Header 3-Dots Menu */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHeaderMenu(!showHeaderMenu);
                    }}
                    className="p-2 rounded-xl hover:bg-background-secondary text-text-secondary hover:text-text-primary transition-all"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {showHeaderMenu && (
                    <div className="absolute right-0 top-10 z-50 w-48 bg-background border border-border rounded-xl shadow-2xl p-1.5 space-y-1">
                      {isDirectChat && (
                        connectStatus === 'pending_received' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptConnectRequest();
                              setShowHeaderMenu(false);
                            }}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-emerald-400"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Accept Connect</span>
                          </button>
                        ) : isConnected ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnconnectRequest();
                              setShowHeaderMenu(false);
                            }}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold hover:bg-red-500/10 flex items-center gap-2 text-red-400"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Unconnect / Unfriend</span>
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectRequest();
                              setShowHeaderMenu(false);
                            }}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-emerald-400"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Connect / Invite</span>
                          </button>
                        )
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestClearChat(activeRoom.id);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2"
                      >
                        <Eraser className="w-3.5 h-3.5 text-amber-400" />
                        <span>Clear Messages</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteChat(activeRoom.id);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold text-error hover:bg-error/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-error" />
                        <span>Delete Chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background-secondary/20 via-background to-background">
              {messagesLoading ? (
                <div className="p-4 space-y-4">
                  <div className="flex justify-start">
                    <div className="w-48 h-12 rounded-2xl bg-background-secondary/60 border border-border/40 animate-pulse" />
                  </div>
                  <div className="flex justify-end">
                    <div className="w-56 h-14 rounded-2xl bg-accent/20 border border-accent/30 animate-pulse" />
                  </div>
                  <div className="flex justify-start">
                    <div className="w-40 h-10 rounded-2xl bg-background-secondary/60 border border-border/40 animate-pulse" />
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 opacity-40 text-xs font-black uppercase tracking-widest">
                  No messages yet. Say hello! 👋
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === currentUser?.id;
                  const isSystem = msg.message_type === 'system';

                  if (isSystem) {
                    let displayContent = msg.content;
                    if (msg.payload_json?.type === 'member_added') {
                      if (String(msg.payload_json?.added_user_id) === String(currentUser?.id)) {
                        displayContent = `You were added by ${msg.payload_json?.host_name || 'Host'}`;
                      } else {
                        displayContent = `${msg.payload_json?.added_name || 'A player'} was added by ${msg.payload_json?.host_name || 'Host'}`;
                      }
                    } else if (msg.payload_json?.type === 'group_created' || msg.content.includes('Group created for')) {
                      const isJoinable = activeRoom?.name?.toLowerCase().includes('joinable') || msg.content.toLowerCase().includes('joinable');
                      if (isJoinable) {
                        displayContent = msg.content
                          .replace(/Group created for challenge/i, 'Group created for joinable match')
                          .replace(/Group created for match/i, 'Group created for joinable match');
                      } else {
                        displayContent = msg.content;
                      }
                    } else if (msg.payload_json?.type === 'connect_request' || msg.content.includes('Connect request')) {
                      if (msg.sender_id === currentUser?.id) {
                        displayContent = `🤝 Connect request sent to ${msg.payload_json?.recipient_name || otherMember?.display_name || otherMember?.username || 'user'}`;
                      } else {
                        const senderDisplayName = msg.sender_display_name || msg.sender_username || msg.payload_json?.sender_name || 'User';
                        displayContent = `🤝 Connect request received from ${senderDisplayName}`;
                      }
                    }
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <span className="px-3 py-1.5 rounded-full bg-background-secondary border border-border text-[9px] font-black uppercase tracking-widest opacity-80 text-center px-4 max-w-sm">
                          {displayContent}
                        </span>
                      </div>
                    );
                  }

                  // Render Location Card (High-Contrast Dark Theme)
                  if (msg.message_type === ('location_card' as any)) {
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2`}>
                        <div className="p-4 rounded-3xl bg-slate-900 border border-emerald-500/50 shadow-2xl space-y-3 max-w-xs text-white relative">
                          <div className="flex items-center gap-2 text-emerald-400">
                            <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                            <span className="font-black italic text-xs uppercase tracking-wider">Boxitt Arena Location</span>
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{msg.payload_json?.arenaName || 'Boxitt Sports Turf'}</p>
                            <p className="text-[10px] text-emerald-300 font-bold mt-0.5">Chowder Guda, Ghatkesar Mandal</p>
                          </div>
                          <button
                            onClick={() => window.open(msg.payload_json?.mapsUrl || 'https://maps.google.com/?q=Boxitt+Arena', '_blank')}
                            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all"
                          >
                            <Navigation className="w-3.5 h-3.5 fill-white" />
                            <span>Open Google Maps</span>
                          </button>
                          <div className="flex items-center justify-end gap-1 pt-1 opacity-70 text-[8px] font-bold text-slate-300">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {renderMessageStatus(msg)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render RSVP Status Card (High Contrast)
                  if (msg.message_type === 'rsvp_status') {
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2`}>
                        <div className="p-3.5 rounded-2xl bg-slate-900 border border-accent/50 shadow-md space-y-1 max-w-xs text-white">
                          <span className="text-[9px] font-black uppercase tracking-widest text-accent block">Player RSVP Update</span>
                          <p className="text-xs font-bold text-white">{msg.content}</p>
                          <div className="flex items-center justify-end gap-1 pt-1 opacity-70 text-[8px] font-bold text-slate-300">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {renderMessageStatus(msg)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render Live Scorecard (High Contrast)
                  if (msg.message_type === 'live_score') {
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2`}>
                        <div className="p-4 rounded-3xl bg-slate-900 border border-blue-500/50 shadow-2xl space-y-2 max-w-xs text-white">
                          <div className="flex items-center gap-2 text-blue-400">
                            <Trophy className="w-5 h-5 text-blue-400 shrink-0" />
                            <span className="font-black italic text-xs uppercase tracking-wider">Live Match Scorecard</span>
                          </div>
                          <p className="text-sm font-black text-white">{msg.content}</p>
                          <div className="flex items-center justify-end gap-1 pt-1 opacity-70 text-[8px] font-bold text-slate-300">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {renderMessageStatus(msg)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Render Payment Split Card (High-Contrast Slate Container)
                  if (msg.message_type === 'payment_card') {
                    const p = msg.payload_json || {};
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} my-2`}>
                        <div className="p-4 rounded-3xl bg-slate-900 border border-amber-500/50 shadow-2xl space-y-3 max-w-xs text-white">
                          <div className="flex items-center gap-2 text-amber-400">
                            <CreditCard className="w-5 h-5 text-amber-400 shrink-0" />
                            <span className="font-black italic text-xs uppercase tracking-wider">{p.title || 'Turf Fee Breakdown'}</span>
                          </div>

                          <div>
                            <p className="text-sm font-black text-white">{msg.content}</p>
                            <p className="text-[10px] text-slate-300 font-medium mt-1 leading-relaxed">{p.text}</p>
                          </div>

                          {/* High-Contrast Table Box */}
                          <div className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider space-y-1.5">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Court Price:</span>
                              <span className="text-white font-bold">₹{p.totalAmount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Your Paid Amount:</span>
                              <span className="text-emerald-400 font-black">₹{p.myPaid || 0}</span>
                            </div>
                            <div className="flex justify-between pt-1.5 border-t border-slate-800 font-black text-xs">
                              <span className="text-amber-300">Your Remaining Share:</span>
                              <span className="text-amber-400 font-black">₹{p.myRemainingShare ?? p.remainingTotal ?? 0}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1 pt-1 opacity-70 text-[8px] font-bold text-slate-300">
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {renderMessageStatus(msg)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const senderName = (msg.sender_username && msg.sender_username.toLowerCase() !== 'player') ? msg.sender_username : (msg.sender_display_name || 'user');

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <span className="text-[9px] font-black uppercase tracking-wider opacity-50 mb-1 ml-1">
                          @{senderName.toLowerCase().replace(/\s+/g, '_')}
                        </span>
                      )}

                      <div
                        className={`max-w-[80%] md:max-w-[60%] p-3 rounded-2xl text-xs font-medium shadow-sm relative ${
                          isMe
                            ? 'bg-accent text-white rounded-br-none'
                            : 'bg-background-secondary border border-border rounded-bl-none text-text-primary'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.content}</p>

                        <div className="flex items-center justify-end gap-1 mt-1 opacity-70 text-[8px] font-bold">
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {renderMessageStatus(msg)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Text Input Bar or 1-Message Inquiry Limit / Read-Only Banner */}
            {activeRoom.is_readonly ? (
              <div className="p-4 bg-background-secondary border-t flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-textDisabled" style={{ borderColor: theme.colors.border }}>
                <Lock className="w-4 h-4" />
                <span>Match completed. Read-only.</span>
              </div>
            ) : isMessageLimitReached ? (
              <div className="p-4 bg-accent/10 border-t flex flex-col items-center justify-center gap-2 text-center" style={{ borderColor: theme.colors.border }}>
                {connectStatus === 'pending_sent' ? (
                  <p className="text-xs font-black uppercase tracking-widest text-accent">
                    🔒 Connect request pending. Waiting for {otherMember?.display_name || 'user'} to accept.
                  </p>
                ) : connectStatus === 'pending_received' ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
                      🤝 {otherMember?.display_name || 'user'} sent you a Connect Request.
                    </p>
                    <button
                      onClick={handleAcceptConnectRequest}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:scale-105 transition-all"
                    >
                      🤝 Accept Connect Request
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-widest text-accent">
                      🔒 1-Message inquiry limit reached. Connect to send more messages.
                    </p>
                    <button
                      onClick={handleConnectRequest}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:scale-105 transition-all"
                    >
                      🤝 Send Connect Request
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3 border-t bg-background-secondary/20 flex items-center gap-2 relative" style={{ borderColor: theme.colors.border }}>
                {/* Quick Actions Button (Zap / ⚡) - Custom Options for 1v1 vs Match/Group Chats */}
                <div className="relative">
                  <button
                    onClick={() => setShowQuickMenu(!showQuickMenu)}
                    className={`p-2.5 rounded-xl border transition-all ${
                      showQuickMenu ? 'bg-accent text-white border-accent' : 'bg-background-secondary border-border text-accent hover:bg-background-secondary/80'
                    }`}
                    title="Quick Messages & Arena Sharing"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                  </button>

                  {/* Quick Actions Dropdown Menu */}
                  {showQuickMenu && (
                    <div className="absolute left-0 bottom-12 z-50 w-64 bg-background border border-border rounded-2xl shadow-2xl p-2 space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-accent px-2 py-1 block border-b border-border/40">
                        {isDirectChat ? '1V1 Quick Inquiry Messages' : 'Quick Messages & Media'}
                      </span>

                      {isDirectChat ? (
                        <>
                          <button
                            onClick={() => {
                              setShowQuickMenu(false);
                              setInputMessage("👋 Interested in playing a match?");
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2"
                          >
                            <span>👋 Interested in playing a match?</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowQuickMenu(false);
                              setInputMessage("🏟️ Which box/turf should we book?");
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2"
                          >
                            <span>🏟️ Which box should we book?</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowQuickMenu(false);
                              setInputMessage("📅 What time works best for you?");
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2"
                          >
                            <span>📅 What time works best?</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowQuickMenu(false);
                              setInputMessage("⚡ Want to challenge me?");
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-amber-400"
                          >
                            <span>⚡ Want to challenge?</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSendQuickAction('rsvp', "I'm In 🟢")}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2"
                          >
                            <span>🟢 I'm In</span>
                          </button>

                          <button
                            onClick={() => handleSendQuickAction('rsvp', "Can't Make It 🔴")}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-error"
                          >
                            <span>🔴 Can't Make It</span>
                          </button>

                          <button
                            onClick={() => handleSendQuickAction('rsvp', "Running 5 Mins Late ⏳")}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-amber-400"
                          >
                            <span>⏳ Running 5 Mins Late</span>
                          </button>

                          <button
                            onClick={() => handleSendQuickAction('location', 'Share Arena Location')}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-emerald-400 border-t border-border/40 pt-2"
                          >
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            <span>📍 Share Boxitt Arena Location</span>
                          </button>

                          <button
                            onClick={() => handleSendQuickAction('score', 'Share Live Score')}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-accent"
                          >
                            <Trophy className="w-3.5 h-3.5 text-accent" />
                            <span>🏆 Share Match Score</span>
                          </button>

                          <button
                            onClick={() => handleSendQuickAction('payment', 'Request Fee Split')}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs font-bold hover:bg-background-secondary flex items-center gap-2 text-amber-400"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                            <span>💳 Request Turf Fee Split</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-background-secondary border border-border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-accent"
                />

                <button
                  onClick={handleSendMessage}
                  className="p-2.5 rounded-xl bg-accent text-white shadow-md hover:scale-105 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center opacity-40">
            <Users className="w-16 h-16 mb-4" />
            <h3 className="font-black italic uppercase text-sm tracking-wider">Select a conversation to start chatting</h3>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Group Info Drawer (Laptop Toggle OR Mobile 'info') */}
      {/* ========================================================= */}
      <AnimatePresence>
        {(showGroupDrawer || mobileView === 'info') && activeRoom && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className={`w-full lg:w-80 border-l bg-background-secondary/30 flex flex-col shrink-0 ${
              mobileView === 'info' ? 'flex' : 'hidden lg:flex'
            }`}
            style={{ borderColor: theme.colors.border }}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: theme.colors.border }}>
              <h3 className="font-black italic uppercase text-sm tracking-wider">Group Info</h3>
              <button
                onClick={() => {
                  setShowGroupDrawer(false);
                  setMobileView('detail');
                }}
                className="p-1.5 rounded-xl hover:bg-background-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Capacity Info */}
            <div className="p-4 border-b flex flex-col items-center text-center gap-2" style={{ borderColor: theme.colors.border }}>
              <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent overflow-hidden">
                {activeRoom.avatar_url ? (
                  <img src={activeRoom.avatar_url} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8" />
                )}
              </div>

              <h4 className="font-black italic uppercase text-base">{activeRoomTitle}</h4>
              <p className="text-[10px] font-black uppercase tracking-wider text-accent">
                Capacity: {members.length} / {activeRoom.format_capacity} Players
              </p>
            </div>

            {/* Add Member Search */}
            <div className="p-4 border-b space-y-2" style={{ borderColor: theme.colors.border }}>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Add Teammate by Username</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search @username..."
                  value={searchFriendsQuery}
                  onChange={(e) => handleSearchFriends(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs focus:outline-none focus:border-accent"
                />
              </div>

              {searchFriendResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 mt-2 bg-background border border-border rounded-xl p-2 shadow-lg">
                  {searchFriendResults.map(friend => {
                    const cleanName = friend.display_name || ((friend.username && friend.username.toLowerCase() !== 'player') ? friend.username : 'User');
                    return (
                      <div
                        key={friend.id}
                        onClick={() => handleAddMember(friend.id)}
                        className="p-2 rounded-lg hover:bg-background-secondary flex items-center justify-between cursor-pointer text-xs"
                      >
                        <span className="font-bold truncate">{cleanName}</span>
                        <UserPlus className="w-3.5 h-3.5 text-accent" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <h5 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-3">
                Members ({members.length})
              </h5>

              {members.map(member => {
                const isHost = member.role === 'admin';
                const canKick = members.find(m => m.user_id === currentUser?.id)?.role === 'admin' && member.user_id !== currentUser?.id;
                const cleanName = member.display_name || ((member.username && member.username.toLowerCase() !== 'player') ? member.username : 'User');

                return (
                  <div key={member.id} className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                    <div
                      onClick={() => setInspectingUserProfile({
                        id: member.user_id,
                        username: member.username,
                        display_name: member.display_name,
                        avatar_url: member.avatar_url
                      })}
                      className="min-w-0 cursor-pointer hover:underline flex items-center gap-2"
                    >
                      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-black text-[10px] shrink-0 overflow-hidden">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="M" className="w-full h-full object-cover" />
                        ) : (
                          <span>{cleanName.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-black italic text-xs uppercase truncate">
                          {cleanName}
                        </p>
                        {isHost && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                            Group Admin
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons beside player name in Group/Direct Info */}
                    {member.user_id !== currentUser?.id && (
                      <div className="flex items-center gap-1">
                        {isDirectChat && (
                          isConnected ? (
                            <button
                              onClick={() => handleUnconnectRequest()}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-1 text-xs font-bold"
                              title="Unconnect / Unfriend"
                            >
                              <UserMinus className="w-4 h-4 text-red-500" />
                            </button>
                          ) : connectStatus === 'pending_received' ? (
                            <button
                              onClick={() => handleAcceptConnectRequest()}
                              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-1 text-xs font-bold"
                              title="Accept Connect Request"
                            >
                              <UserCheck className="w-4 h-4 text-emerald-500" />
                            </button>
                          ) : connectStatus === 'pending_sent' ? (
                            <span className="p-1.5 text-amber-400" title="Connect Request Pending">
                              <Clock className="w-4 h-4 text-amber-400" />
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConnectRequest()}
                              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-1 text-xs font-bold"
                              title="Send Connect Request"
                            >
                              <UserPlus className="w-4 h-4 text-emerald-500" />
                            </button>
                          )
                        )}

                        {!isDirectChat && canKick && (
                          <button
                            onClick={() => handleKickMember(member.user_id)}
                            className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-all"
                            title="Kick player"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile View Modal */}
      {inspectingUserProfile && (
        <UserProfileModal
          userProfile={inspectingUserProfile}
          onClose={() => setInspectingUserProfile(null)}
        />
      )}

      {/* Custom Confirmation Modal */}
      {confirmModalState.isOpen && (
        <AnimatePresence>
          <Modal onClose={() => !confirmLoading && setConfirmModalState(prev => ({ ...prev, isOpen: false }))}>
            <div className="flex flex-col items-center text-center p-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4 border shadow-sm"
                style={{
                  backgroundColor: confirmModalState.isDanger ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  borderColor: confirmModalState.isDanger ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                  color: confirmModalState.isDanger ? '#ef4444' : '#f59e0b'
                }}
              >
                {confirmModalState.isDanger ? <Trash2 className="w-7 h-7 text-red-500" /> : <Eraser className="w-7 h-7 text-amber-500" />}
              </div>

              <h3 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: theme.colors.textPrimary }}>
                {confirmModalState.title}
              </h3>

              <p className="text-sm font-medium leading-relaxed mb-6 max-w-sm" style={{ color: theme.colors.textSecondary }}>
                {confirmModalState.message}
              </p>

              <div className="flex items-center justify-end gap-3 w-full pt-4 border-t" style={{ borderColor: theme.colors.border }}>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all border hover:opacity-80 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderColor: theme.colors.border,
                    color: theme.colors.textPrimary
                  }}
                >
                  {confirmModalState.cancelText}
                </button>

                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={confirmModalState.onConfirm}
                  className="flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all shadow-md hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  style={{
                    backgroundColor: confirmModalState.isDanger ? '#ef4444' : theme.colors.accentPrimary,
                    color: '#ffffff'
                  }}
                >
                  {confirmLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {confirmModalState.isDanger && <Trash2 className="w-3.5 h-3.5" />}
                      <span>{confirmModalState.confirmText}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </Modal>
        </AnimatePresence>
      )}

      {/* Create Personal Group Modal */}
      {showCreateGroupModal && (
        <Modal onClose={() => !createGroupLoading && setShowCreateGroupModal(false)}>
          <div className="p-6 space-y-5 max-w-md w-full">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: theme.colors.border }}>
              <div className="flex items-center gap-2 text-accent">
                <Users className="w-5 h-5" />
                <h3 className="font-black italic uppercase text-base tracking-wider">Create Personal Group</h3>
              </div>
            </div>

            {/* Group Name Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Group Name</label>
              <input
                type="text"
                placeholder="e.g. Weekend Cricket Squad"
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background-secondary border border-border text-xs focus:outline-none focus:border-accent font-bold"
              />
            </div>

            {/* Selected Members Chips */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Selected Members ({selectedFriendsForGroup.length})</label>
              {selectedFriendsForGroup.length === 0 ? (
                <p className="text-[11px] opacity-40 italic">No members selected yet. Search and add below.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedFriendsForGroup.map(friend => {
                    const cleanName = friend.display_name || friend.username || 'User';
                    return (
                      <span key={friend.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-[10px] font-bold">
                        <span>{cleanName}</span>
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-red-500"
                          onClick={() => setSelectedFriendsForGroup(prev => prev.filter(p => p.id !== friend.id))}
                        />
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add Member Search Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Add Players by Username</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input
                  type="text"
                  placeholder="Search player username..."
                  value={searchGroupFriendsQuery}
                  onChange={(e) => handleSearchGroupFriends(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-background-secondary border border-border text-xs focus:outline-none focus:border-accent"
                />
              </div>

              {searchGroupFriendsResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto border border-border rounded-xl bg-background p-1 space-y-1">
                  {searchGroupFriendsResults.map(friend => {
                    const cleanName = friend.display_name || friend.username || 'User';
                    return (
                      <div
                        key={friend.id}
                        onClick={() => {
                          setSelectedFriendsForGroup(prev => [...prev, friend]);
                          setSearchGroupFriendsResults(prev => prev.filter(p => p.id !== friend.id));
                        }}
                        className="p-2 rounded-lg hover:bg-background-secondary cursor-pointer flex items-center justify-between text-xs"
                      >
                        <span className="font-bold truncate">{cleanName}</span>
                        <UserPlus className="w-3.5 h-3.5 text-accent shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-background-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createGroupLoading || !groupNameInput.trim()}
                onClick={handleCreatePersonalGroup}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-50"
              >
                {createGroupLoading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChatHub;
