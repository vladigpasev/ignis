"use client";

import { useEffect, useRef, useState } from "react";
import SendbirdChat from "@sendbird/chat";
import { GroupChannelModule, GroupChannelHandler } from "@sendbird/chat/groupChannel";

type ConnectInfo = {
  ok: boolean;
  appId?: string;
  userId?: string;
  accessToken?: string | null;
  channelUrl?: string;
};

export function useSendbirdUnreadMany(connectUrls: string[], chatOpen: boolean, activeConnectUrl?: string | null) {
  const sbRef = useRef<any>(null);
  const credRef = useRef<{ appId: string; userId: string; accessToken?: string } | null>(null);
  const handlerIdsRef = useRef<string[]>([]);
  const channelsRef = useRef<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({}); // keyed by connectUrl
  const connectToChannelUrlRef = useRef<Record<string, string>>({});
  const channelToConnectUrlRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch connect info for all
        const infos: ConnectInfo[] = await Promise.all(
          connectUrls.map((u) => fetch(u, { cache: "no-store" }).then((r) => r.json()).catch(() => null))
        );
        const valid = infos.filter((x) => x && x.ok && x.appId && x.userId && x.channelUrl) as Required<ConnectInfo>[];
        if (cancelled || valid.length === 0) return;

        // Init SB once
        const appId = valid[0].appId!;
        const userId = valid[0].userId!;
        const accessToken = valid[0].accessToken || undefined;
        const sb = sbRef.current || await SendbirdChat.init({ appId, modules: [new GroupChannelModule()] });
        sbRef.current = sb;
        credRef.current = { appId, userId, accessToken };
        if (!sb.currentUser) {
          try { await sb.connect(userId, accessToken); } catch {}
        }

        // Load channels and set handlers
        // Map connectUrl <-> channelUrl
        const toCh: Record<string, string> = {};
        const toConn: Record<string, string> = {};
        for (let i = 0; i < valid.length; i++) {
          const connUrl = connectUrls[i];
          const chUrl = valid[i].channelUrl!;
          toCh[connUrl] = chUrl;
          toConn[chUrl] = connUrl;
        }
        connectToChannelUrlRef.current = toCh;
        channelToConnectUrlRef.current = toConn;

        channelsRef.current = await Promise.all(valid.map(v => sb.groupChannel.getChannel(v.channelUrl!)));
        const nextCounts: Record<string, number> = {};
        channelsRef.current.forEach((ch: any) => {
          const cu = channelToConnectUrlRef.current[ch.url];
          if (cu) nextCounts[cu] = ch.unreadMessageCount || 0;
        });
        if (!cancelled) setCounts(nextCounts);

        // Handlers
        handlerIdsRef.current.forEach((id) => { try { sb.groupChannel.removeGroupChannelHandler(id); } catch {} });
        handlerIdsRef.current = [];
        channelsRef.current.forEach((ch: any) => {
          const id = `unread-many-${ch.url}-${Math.random().toString(36).slice(2)}`;
          const handler = new GroupChannelHandler({
            onMessageReceived: (channel) => {
              if (channel.url === ch.url) {
                const key = channelToConnectUrlRef.current[channel.url];
                if (key) setCounts((c) => ({ ...c, [key]: (channel as any).unreadMessageCount || 0 }));
              }
            },
            onUserMarkedRead: (channel) => {
              if (channel.url === ch.url) {
                const key = channelToConnectUrlRef.current[channel.url];
                if (key) setCounts((c) => ({ ...c, [key]: (channel as any).unreadMessageCount || 0 }));
              }
            },
            onUnreadMemberStatusUpdated: (channel) => {
              if (channel.url === ch.url) {
                const key = channelToConnectUrlRef.current[channel.url];
                if (key) setCounts((c) => ({ ...c, [key]: (channel as any).unreadMessageCount || 0 }));
              }
            },
            onChannelChanged: (channel) => {
              if (channel.url === ch.url) {
                const key = channelToConnectUrlRef.current[channel.url];
                if (key) setCounts((c) => ({ ...c, [key]: (channel as any).unreadMessageCount || 0 }));
              }
            },
          });
          sb.groupChannel.addGroupChannelHandler(id, handler);
          handlerIdsRef.current.push(id);
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
      const sb = sbRef.current;
      if (sb && handlerIdsRef.current.length) {
        handlerIdsRef.current.forEach((id) => { try { sb.groupChannel.removeGroupChannelHandler(id); } catch {} });
      }
    };
  }, [JSON.stringify(connectUrls)]);

  // Mark only the active channel as read when chat opens or active tab changes
  useEffect(() => {
    if (!chatOpen) return;
    if (!activeConnectUrl) return;
    const run = async () => {
      const sb = sbRef.current;
      if (!sb) return;
      // ensure connection
      if (!sb.currentUser && credRef.current) {
        try { await sb.connect(credRef.current.userId, credRef.current.accessToken); } catch {}
      }
      const chUrl = connectToChannelUrlRef.current[activeConnectUrl];
      if (!chUrl) return;
      const ch = channelsRef.current.find((c: any) => c.url === chUrl);
      if (!ch) return;
      try { await ch.markAsRead(); } catch {}
      setCounts((c) => ({ ...c, [activeConnectUrl]: 0 }));
    };
    run();
  }, [chatOpen, activeConnectUrl]);

  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  return { counts, total };
}
