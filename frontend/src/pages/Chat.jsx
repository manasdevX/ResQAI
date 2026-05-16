import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Send, Search, MessageCircle, Users, Circle, ArrowLeft, Trash2, Reply, X, Hash } from 'lucide-react';

// ── Role badge ─────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  admin:           'bg-red-500/20 text-red-400 border-red-500/30',
  responder:       'bg-orange-500/20 text-orange-400 border-orange-500/30',
  shelter_manager: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  citizen:         'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const RoleBadge = ({ role }) => (
  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${ROLE_COLORS[role] || ROLE_COLORS.citizen}`}>
    {role?.replace('_', ' ')}
  </span>
);

// ── Avatar ─────────────────────────────────────────────────────────────────────
const Avatar = ({ name = '?', avatar, size = 'md', isOnline }) => {
  const sz   = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm';
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const hue  = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div className="relative shrink-0">
      {avatar
        ? <img src={avatar} alt={name} className={`${sz} rounded-full object-cover`} />
        : <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white`}
            style={{ background: `hsl(${hue},60%,40%)` }}>{initials}</div>
      }
      {isOnline !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${isOnline ? 'bg-green-400' : 'bg-zinc-600'}`} />
      )}
    </div>
  );
};

// ── Message bubble ─────────────────────────────────────────────────────────────
const Bubble = ({ msg, isMine, onReply, onDelete, canDelete }) => {
  const [hover, setHover] = useState(false);
  const isDeleted = msg.content === '[Message deleted]';
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`flex gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!isMine && <Avatar name={msg.sender?.name || '?'} avatar={msg.sender?.avatar} size="sm" />}

      <div className={`max-w-[70%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMine && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-semibold text-zinc-300">{msg.sender?.name}</span>
            <RoleBadge role={msg.sender?.role} />
          </div>
        )}

        {/* Reply preview */}
        {msg.replyTo && (
          <div className={`text-xs px-2.5 py-1.5 rounded-lg border-l-2 border-blue-500 bg-zinc-800/60 text-zinc-400 max-w-full truncate ${isMine ? 'self-end' : ''}`}>
            ↩ {msg.replyTo.content || 'Original message'}
          </div>
        )}

        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
          isDeleted
            ? 'italic text-zinc-500 bg-zinc-800/40 border border-zinc-700/40'
            : isMine
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-100 border border-zinc-700/50 rounded-tl-sm'
        }`}>
          {msg.content}
        </div>

        <div className={`flex items-center gap-1 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-zinc-600">{time}</span>
          {msg.isEdited && <span className="text-[10px] text-zinc-600">(edited)</span>}
        </div>
      </div>

      {/* Action buttons on hover */}
      {!isDeleted && hover && (
        <div className={`flex items-center gap-1 self-center ${isMine ? 'flex-row-reverse' : ''}`}>
          <button onClick={() => onReply(msg)}
            className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition">
            <Reply className="w-3 h-3" />
          </button>
          {canDelete && (
            <button onClick={() => onDelete(msg._id)}
              className="p-1 rounded-lg bg-zinc-800 hover:bg-red-900/50 border border-zinc-700 hover:border-red-800 text-zinc-400 hover:text-red-400 transition">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── Typing indicator ───────────────────────────────────────────────────────────
const TypingIndicator = ({ name }) => (
  <div className="flex items-center gap-2 px-4 py-1">
    <div className="flex gap-1">
      {[0,1,2].map(i => (
        <span key={i} className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
    <span className="text-xs text-zinc-500">{name} is typing…</span>
  </div>
);

// ── Main Chat page ─────────────────────────────────────────────────────────────
const Chat = () => {
  const { user, api }  = useAuth();
  const socket         = useSocket();

  // Conversations list state
  const [users,       setUsers]       = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unread,      setUnread]      = useState({});
  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState('people'); // 'people' | 'online'

  // Active DM
  const [activePeer,   setActivePeer]   = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [msgLoading,   setMsgLoading]   = useState(false);
  const [replyTo,      setReplyTo]      = useState(null);
  const [draft,        setDraft]        = useState('');
  const [typingPeers,  setTypingPeers]  = useState({});  // { senderId: name }
  const [sending,      setSending]      = useState(false);

  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const typingTimerRef  = useRef(null);

  // ── Load users + unread counts ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [usersRes, unreadRes] = await Promise.all([
          api.get('/chat/users'),
          api.get('/chat/unread'),
        ]);
        if (!cancelled) {
          setUsers(usersRes.data.users || []);
          setUnread(unreadRes.data.unread || {});
        }
      } catch (err) {
        console.error('[Chat] load error', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [api]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !user) return;

    // Register presence
    socket.emit('chat:join', {
      userId: user._id,
      name:   user.name,
      role:   user.role,
      avatar: user.avatar,
    });

    const handleOnline = (list) => setOnlineUsers(list);

    const handleDM = (msg) => {
      setMessages(prev => {
        // Replace optimistic temp message if present
        if (msg.tempId) {
          const idx = prev.findIndex(m => m._id === msg.tempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = msg;
            return next;
          }
        }
        return [...prev, msg];
      });

      // If not in this conversation → increment unread
      if (msg.sender?._id !== user._id) {
        setActivePeer(curr => {
          if (curr?._id !== msg.sender?._id) {
            setUnread(u => ({ ...u, [msg.sender._id]: (u[msg.sender._id] || 0) + 1 }));
          }
          return curr;
        });
      }
    };

    const handleTyping = ({ senderId, name, isTyping }) => {
      setTypingPeers(prev => {
        if (isTyping) return { ...prev, [senderId]: name };
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    };

    socket.on('chat:onlineUsers', handleOnline);
    socket.on('chat:newDM',       handleDM);
    socket.on('chat:typing',      handleTyping);

    return () => {
      socket.off('chat:onlineUsers', handleOnline);
      socket.off('chat:newDM',       handleDM);
      socket.off('chat:typing',      handleTyping);
    };
  }, [socket, user]);

  // ── Load DM history when peer changes ─────────────────────────────────────
  useEffect(() => {
    if (!activePeer) return;
    let cancelled = false;

    const load = async () => {
      if (!cancelled) {
        setMsgLoading(true);
        setMessages([]);
      }
      try {
        const { data } = await api.get(`/chat/dm/${activePeer._id}`);
        if (!cancelled) setMessages(data.messages || []);

        // Mark as read
        await api.patch(`/chat/dm/${activePeer._id}/read`);
        if (!cancelled) setUnread(u => { const n = { ...u }; delete n[activePeer._id]; return n; });
      } catch (err) {
        console.error('[Chat] history error', err);
      } finally {
        if (!cancelled) setMsgLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [api, activePeer]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!draft.trim() || !activePeer || sending) return;
    const content = draft.trim();
    const tempId  = `temp_${Date.now()}`;

    // Optimistic message
    const optimistic = {
      _id:      tempId,
      sender:   { _id: user._id, name: user.name, role: user.role, avatar: user.avatar },
      recipient: activePeer._id,
      content,
      createdAt: new Date().toISOString(),
      replyTo,
      tempId,
    };
    setMessages(prev => [...prev, optimistic]);
    setDraft('');
    setReplyTo(null);
    setSending(false);

    socket?.emit('chat:sendDM', {
      recipientId: activePeer._id,
      content,
      replyTo: replyTo?._id,
      tempId,
    });

    // Clear typing
    socket?.emit('chat:typing', { recipientId: activePeer._id, isTyping: false });
  }, [draft, activePeer, sending, replyTo, socket, user]);

  // ── Typing emission ────────────────────────────────────────────────────────
  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    if (!activePeer || !socket) return;
    socket.emit('chat:typing', { recipientId: activePeer._id, isTyping: true });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('chat:typing', { recipientId: activePeer._id, isTyping: false });
    }, 2000);
  };

  // ── Delete message ─────────────────────────────────────────────────────────
  const handleDelete = async (msgId) => {
    try {
      await api.delete(`/chat/message/${msgId}`);
      setMessages(prev => prev.map(m =>
        m._id === msgId ? { ...m, content: '[Message deleted]' } : m
      ));
    } catch (err) {
      console.error('[Chat] delete error', err);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const onlineIds    = new Set(onlineUsers.map(u => u.userId));
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const activePeerTyping = activePeer && typingPeers[activePeer._id];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-72 xl:w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold shrink-0">R</div>
            <div>
              <h1 className="text-sm font-bold leading-none">ResQAI Chat</h1>
              <p className="text-[10px] text-zinc-500 mt-0.5">Real-time coordination</p>
            </div>
            <a href="/dashboard" className="ml-auto text-zinc-500 hover:text-zinc-300 transition">
              <ArrowLeft className="w-4 h-4" />
            </a>
          </div>

          {/* My presence */}
          <div className="flex items-center gap-2 p-2 bg-zinc-800/60 rounded-lg">
            <Avatar name={user?.name} avatar={user?.avatar} size="sm" isOnline={true} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name}</p>
              <RoleBadge role={user?.role} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-zinc-800/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search people…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {[['people', <Users className="w-3 h-3" />, 'All'],
            ['online', <Circle className="w-3 h-3 fill-green-400 text-green-400" />, 'Online']
          ].map(([id, icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === id ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}>
              {icon} {label}
              {id === 'online' && (
                <span className="px-1 py-0.5 bg-green-500/20 text-green-400 text-[9px] rounded-full font-bold">
                  {onlineUsers.filter(u => u.userId !== user?._id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto py-1">
          {(activeTab === 'online'
            ? users.filter(u => onlineIds.has(u._id))
            : filteredUsers
          ).map(u => {
            const isOnline = onlineIds.has(u._id);
            const unreadCnt = unread[u._id] || 0;
            const isActive = activePeer?._id === u._id;
            return (
              <button key={u._id} onClick={() => setActivePeer(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-zinc-800/60 transition ${isActive ? 'bg-zinc-800' : ''}`}>
                <Avatar name={u.name} avatar={u.avatar} size="sm" isOnline={isOnline} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate text-zinc-200">{u.name}</p>
                    {unreadCnt > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full shrink-0">
                        {unreadCnt}
                      </span>
                    )}
                  </div>
                  <RoleBadge role={u.role} />
                </div>
              </button>
            );
          })}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-zinc-600 text-xs">No users found</div>
          )}
        </div>
      </aside>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {activePeer ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <Avatar name={activePeer.name} avatar={activePeer.avatar} isOnline={onlineIds.has(activePeer._id)} />
              <div>
                <p className="font-semibold text-zinc-100">{activePeer.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={activePeer.role} />
                  <span className={`text-[10px] ${onlineIds.has(activePeer._id) ? 'text-green-400' : 'text-zinc-500'}`}>
                    {onlineIds.has(activePeer._id) ? '● Online' : '○ Offline'}
                  </span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                <MessageCircle className="w-4 h-4" />
                <span>Direct Message</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {msgLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
                  <MessageCircle className="w-12 h-12 opacity-30" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <Bubble
                    key={msg._id}
                    msg={msg}
                    isMine={msg.sender?._id === user?._id || msg.sender === user?._id}
                    onReply={setReplyTo}
                    onDelete={handleDelete}
                    canDelete={msg.sender?._id === user?._id || msg.sender === user?._id || user?.role === 'admin'}
                  />
                ))
              )}
              {activePeerTyping && <TypingIndicator name={activePeer.name} />}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="flex items-center gap-2 mx-5 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg border-l-2 border-l-blue-500">
                <Reply className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <p className="text-xs text-zinc-400 flex-1 truncate">
                  Replying to <span className="text-zinc-200 font-medium">{replyTo.sender?.name}</span>: {replyTo.content}
                </p>
                <button onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="px-5 py-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Message ${activePeer.name}…`}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition pr-10"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5 text-center">Enter to send · All messages are end-to-end logged for emergency audit</p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
              <Hash className="w-10 h-10 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-zinc-400 font-semibold">Select a person to chat</p>
              <p className="text-sm mt-1 text-zinc-600">Real-time messages between responders, civilians & admins</p>
            </div>
            <div className="flex gap-3 mt-2">
              {onlineUsers.filter(u => u.userId !== user?._id).slice(0, 3).map(u => (
                <button key={u.userId}
                  onClick={() => { const found = users.find(us => us._id === u.userId); if (found) setActivePeer(found); }}
                  className="flex flex-col items-center gap-1.5 p-3 bg-zinc-800/60 rounded-xl border border-zinc-700/40 hover:border-zinc-600 transition">
                  <Avatar name={u.name} avatar={u.avatar} size="sm" isOnline={true} />
                  <span className="text-[10px] text-zinc-400 max-w-[60px] truncate">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
