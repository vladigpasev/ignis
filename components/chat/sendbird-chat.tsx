"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Lazy-load UI kit on client only to avoid SSR issues
const SendBirdProvider = dynamic(() => import("@sendbird/uikit-react").then(m => m.SendBirdProvider), { ssr: false }) as any;
const Channel = dynamic(() => import("@sendbird/uikit-react").then(m => m.Channel), { ssr: false }) as any;
const ChannelSettings = dynamic(() => import("@sendbird/uikit-react").then(m => m.ChannelSettings), { ssr: false }) as any;

type ConnectInfo = {
  ok: boolean;
  appId?: string;
  userId?: string;
  nickname?: string | null;
  accessToken?: string | null;
  channelUrl?: string;
  error?: string;
};

export default function SendbirdChat({
  fireId,
  connectUrl,
  className,
  style,
}: {
  fireId?: number;
  connectUrl?: string;
  className?: string;
  style?: CSSProperties;
}) {
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
      <SendBirdProvider
        appId={info.appId}
        userId={info.userId}
        accessToken={info.accessToken || undefined}
        nickname={info.nickname || undefined}
      >
        <div className="h-full min-h-0">
          <Channel
            channelUrl={info.channelUrl}
            startingPoint={0}
            queries={{ messageListParams: { prevResultSize: 50, nextResultSize: 0, isInclusive: true, includeReactions: true, includeMetaArray: true, includeParentMessageInfo: true, includeThreadInfo: true } }}
            onChatHeaderActionClick={() => setSettingsOpen(true)}
          />
        </div>
        {settingsOpen && (
          <ChannelSettings
            channelUrl={info.channelUrl}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </SendBirdProvider>
    );
  }, [info, error, settingsOpen]);

  return (
    <div className={cn("sb-wrapper h-full min-h-0", className)} style={style}>{content}</div>
  );
}
