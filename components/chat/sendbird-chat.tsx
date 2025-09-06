"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Lazy-load UI kit on client only to avoid SSR issues
const SendBirdProvider = dynamic(() => import("@sendbird/uikit-react").then(m => m.SendBirdProvider), { ssr: false }) as any;
const Channel = dynamic(() => import("@sendbird/uikit-react").then(m => m.Channel), { ssr: false }) as any;
const ChannelSettings = dynamic(() => import("@sendbird/uikit-react").then(m => m.ChannelSettings), { ssr: false }) as any;
import "@sendbird/uikit-react/dist/index.css";

type ConnectInfo = {
  ok: boolean;
  appId?: string;
  userId?: string;
  nickname?: string | null;
  accessToken?: string | null;
  channelUrl?: string;
  error?: string;
};

export default function SendbirdChat({ fireId, connectUrl }: { fireId?: number; connectUrl?: string }) {
  const [info, setInfo] = useState<ConnectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const url = connectUrl || (fireId != null ? `/api/fires/${fireId}/chat/connect` : "");
        if (!url) throw new Error("Липсва connectUrl");
        const j: ConnectInfo = await fetch(url, { cache: "no-store" }).then(r => r.json());
        if (canceled) return;
        if (!j?.ok) {
          setError(j?.error || "Грешка при свързване към Sendbird.");
          return;
        }
        setInfo(j);
      } catch (e: any) {
        if (!canceled) setError(e?.message || "Грешка при свързване към Sendbird.");
      }
    })();
    return () => { canceled = true; };
  }, [fireId, connectUrl]);

  const content = useMemo(() => {
    if (error) return <div className="text-sm text-red-500">{error}</div>;
    if (!info) return <div className="text-sm text-muted-foreground">Зареждане…</div>;
    if (!info.appId || !info.userId || !info.channelUrl)
      return <div className="text-sm text-red-500">Липсват данни за свързване към Sendbird.</div>;

    return (
      <div style={{ height: '60vh', overflow: 'visible' }}>
        <SendBirdProvider
          appId={info.appId}
          userId={info.userId}
          accessToken={info.accessToken || undefined}
          nickname={info.nickname || undefined}
        >
          <Channel
            channelUrl={info.channelUrl}
            startingPoint={0}
            queries={{ messageListParams: { prevResultSize: 50, nextResultSize: 0, isInclusive: true, includeReactions: true, includeMetaArray: true, includeParentMessageInfo: true, includeThreadInfo: true } }}
            onChatHeaderActionClick={() => setSettingsOpen(true)}
          />
          {settingsOpen && (
            <ChannelSettings
              channelUrl={info.channelUrl}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </SendBirdProvider>
      </div>
    );
  }, [info, error, settingsOpen]);

  return (
    <div className="sb-wrapper">{content}</div>
  );
}
