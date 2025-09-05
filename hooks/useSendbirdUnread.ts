"use client";

import { useEffect, useRef, useState } from "react";
import SendbirdChat from "@sendbird/chat";
import { GroupChannelModule, GroupChannelHandler, type GroupChannel } from "@sendbird/chat/groupChannel";

type ConnectInfo = {
  ok: boolean;
  appId?: string;
  userId?: string;
  accessToken?: string | null;
  channelUrl?: string;
  error?: string;
};

export function useSendbirdUnread(fireId: number, chatOpen: boolean) {
  const sbRef = useRef<any>(null);
  const channelRef = useRef<GroupChannel | null>(null);
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const handlerIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info: ConnectInfo = await fetch(`/api/fires/${fireId}/chat/connect`, { cache: "no-store" }).then((r) => r.json());
        if (cancelled || !info?.ok || !info.appId || !info.userId || !info.channelUrl) return;

        const sb = await SendbirdChat.init({ appId: info.appId, modules: [new GroupChannelModule()] });
        sbRef.current = sb;
        await sb.connect(info.userId, info.accessToken || undefined);
        const ch = await sb.groupChannel.getChannel(info.channelUrl);
        if (cancelled) return;
        channelRef.current = ch;
        setCount((ch as any).unreadMessageCount || 0);

        const handlerId = `fire-${fireId}-unread-${Math.random().toString(36).slice(2)}`;
        handlerIdRef.current = handlerId;
        const handler = new GroupChannelHandler({
          onMessageReceived: (channel) => {
            if (channel.url === ch.url) setCount((channel as any).unreadMessageCount || 0);
          },
          onUserMarkedRead: (channel) => {
            if (channel.url === ch.url) setCount((channel as any).unreadMessageCount || 0);
          },
          onUnreadMemberStatusUpdated: (channel) => {
            if (channel.url === ch.url) setCount((channel as any).unreadMessageCount || 0);
          },
          onChannelChanged: (channel) => {
            if (channel.url === ch.url) setCount((channel as any).unreadMessageCount || 0);
          },
        });
        sb.groupChannel.addGroupChannelHandler(handlerId, handler);
        setReady(true);
      } catch (_) {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      const sb = sbRef.current as any;
      if (sb && handlerIdRef.current) {
        try { sb.groupChannel.removeGroupChannelHandler(handlerIdRef.current); } catch {}
      }
      // Keep the connection; do not disconnect to avoid flicker with the chat UI instance
    };
  }, [fireId]);

  useEffect(() => {
    if (chatOpen && channelRef.current) {
      try { channelRef.current.markAsRead(); } catch {}
      setCount(0);
    }
  }, [chatOpen]);

  return { count, ready };
}
