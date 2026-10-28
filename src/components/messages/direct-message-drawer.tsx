'use client';

import React, { useEffect, useState } from 'react';
import {
  Inbox,
  MessageSquare,
  Send,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { ConversationItem, DirectMessageItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export interface DirectMessageDrawerProps {
  circleId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string | null;
  activeConversationId?: string | null;
  onSelectConversation?: (convoId: string | null) => void;
}

export function DirectMessageDrawer({
  circleId,
  isOpen,
  onClose,
  currentUserId,
  activeConversationId,
  onSelectConversation,
}: DirectMessageDrawerProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvo, setActiveConvo] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Load conversations when drawer opens
  useEffect(() => {
    if (!isOpen || !circleId) return;

    let cancelled = false;
    async function fetchConvos() {
      try {
        setLoading(true);
        const res = await fetch(`/api/circles/${circleId}/messages/conversations`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setConversations(data.conversations || []);
          }
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchConvos();
    return () => {
      cancelled = true;
    };
  }, [isOpen, circleId]);

  // Sync active conversation
  useEffect(() => {
    if (activeConversationId) {
      const match = conversations.find((c) => c.id === activeConversationId);
      if (match) {
        setActiveConvo(match);
      }
    }
  }, [activeConversationId, conversations]);

  // Load messages when an active conversation is selected
  useEffect(() => {
    if (!activeConvo || !circleId) return;

    let cancelled = false;
    async function fetchMessages() {
      try {
        const res = await fetch(
          `/api/circles/${circleId}/messages/conversations/${activeConvo!.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setMessages(data.messages || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    }

    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [activeConvo, circleId]);

  // Send message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConvo || !messageInput.trim() || sending) return;

    try {
      setSending(true);
      const res = await fetch(
        `/api/circles/${circleId}/messages/conversations/${activeConvo.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: messageInput.trim() }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setMessageInput('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-stone-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-800" />
            <h3 className="text-sm font-bold text-stone-900">
              {activeConvo ? 'Conversation' : 'Direct Messages'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active Conversation View */}
        {activeConvo ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Thread Header with back button */}
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 bg-stone-50/30 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveConvo(null);
                  if (onSelectConversation) onSelectConversation(null);
                }}
                className="text-stone-500 hover:text-stone-900 font-medium"
              >
                ← Back to Inbox
              </button>
              <span className="font-semibold text-stone-800">
                {activeConvo.participants
                  .filter((p) => p.user_id !== currentUserId)
                  .map((p) => p.user?.display_name || p.user?.username || 'Member')
                  .join(', ') || 'Direct Chat'}
              </span>
            </div>

            {/* Contextual Listing Banner */}
            {activeConvo.listing && (
              <div className="border-b border-stone-100 bg-emerald-50/60 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">
                      {activeConvo.listing.title}
                    </h4>
                    <p className="text-[11px] font-mono text-emerald-800">
                      {activeConvo.listing.price_amount !== null
                        ? `$${Number(activeConvo.listing.price_amount).toFixed(2)}`
                        : 'Free / Contact'}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-mono text-stone-600 border border-emerald-200">
                  {activeConvo.listing.listing_type}
                </span>
              </div>
            )}

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  No messages yet. Send a note to get the conversation started!
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === currentUserId;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-emerald-900 text-white rounded-br-xs'
                            : 'bg-stone-100 text-stone-800 rounded-bl-xs'
                        }`}
                      >
                        {m.body}
                      </div>
                      <span className="mt-1 text-[10px] text-stone-400">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="border-t border-stone-200 p-3 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a direct message..."
                  className="flex-1 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                />
                <Button size="sm" type="submit" disabled={sending || !messageInput.trim()}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Conversations List View */
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="py-12 text-center text-xs text-stone-400">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                <Inbox className="mx-auto h-8 w-8 text-stone-300" />
                <h4 className="mt-3 text-xs font-bold text-stone-700">No Messages Yet</h4>
                <p className="mt-1 text-[11px] text-stone-500">
                  Connect directly with sellers or members to start a conversation.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {conversations.map((convo) => {
                  const otherUser = convo.participants.find((p) => p.user_id !== currentUserId);
                  const name =
                    otherUser?.user?.display_name || otherUser?.user?.username || 'Member';
                  const hasUnread = (convo.unread_count || 0) > 0;

                  return (
                    <button
                      key={convo.id}
                      type="button"
                      onClick={() => {
                        setActiveConvo(convo);
                        if (onSelectConversation) onSelectConversation(convo.id);
                      }}
                      className={`w-full text-left rounded-xl p-3 transition-colors flex items-center justify-between border ${
                        hasUnread
                          ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                          : 'border-stone-100 bg-stone-50/40 hover:bg-stone-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600 font-bold text-xs overflow-hidden">
                          {otherUser?.user?.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={otherUser.user.avatar_url}
                              alt={name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-stone-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-stone-900 truncate">
                            {name}
                          </h4>
                          <p className="text-[11px] text-stone-500 truncate">
                            {convo.listing ? `Listing: ${convo.listing.title}` : 'Direct Message'}
                          </p>
                        </div>
                      </div>

                      {hasUnread && (
                        <span className="rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-mono font-bold text-white">
                          {convo.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
