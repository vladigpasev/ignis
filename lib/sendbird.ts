import { getAppBaseUrl } from "@/lib/env";

const BASE = process.env.SENDBIRD_API_BASE_URL!;
const TOKEN = process.env.SENDBIRD_API_TOKEN!;
const APP_BASE = getAppBaseUrl();

if (!BASE || !TOKEN) {
  // eslint-disable-next-line no-console
  console.warn("[sendbird] Missing SENDBIRD_API_BASE_URL or SENDBIRD_API_TOKEN. Sendbird integration will not work.")
}

type SBUser = {
  user_id: string;
  nickname?: string;
  profile_url?: string;
  access_token?: string;
};

async function sbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Api-Token": TOKEN,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sendbird API ${res.status}: ${text || res.statusText}`);
  }
  // Some endpoints return empty body
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as unknown as T;
  }
}

export function fireChannelUrl(fireId: number) {
  return `fire-${fireId}`;
}

export function zoneChannelUrl(fireId: number, zoneId: number) {
  return `fire-${fireId}-zone-${zoneId}`;
}

export async function ensureSbUser(id: string, nickname: string | null | undefined): Promise<SBUser> {
  const profileUrl = `${APP_BASE}/vercel.svg`;
  // Try fetch
  try {
    const u = await sbFetch<SBUser>(`/v3/users/${encodeURIComponent(id)}`);
    // Always ensure nickname/profile; also issue access token
    const upd = await sbFetch<SBUser>(`/v3/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ nickname: nickname || id, profile_url: profileUrl, issue_access_token: true }),
    });
    return upd;
  } catch {
    // Create then update to issue token
    await sbFetch<SBUser>(`/v3/users`, {
      method: "POST",
      body: JSON.stringify({ user_id: id, nickname: nickname || id, profile_url: profileUrl }),
    });
    const upd = await sbFetch<SBUser>(`/v3/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ issue_access_token: true }),
    });
    return upd;
  }
}

export async function getOrCreateFireChannel(fireId: number) {
  const channelUrl = fireChannelUrl(fireId);
  try {
    await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}`);
    return channelUrl;
  } catch {
    await sbFetch(`/v3/group_channels`, {
      method: "POST",
      body: JSON.stringify({
        name: `Fire #${fireId}`,
        channel_url: channelUrl,
        is_distinct: false,
        custom_type: "fire",
        data: JSON.stringify({ fireId }),
        is_public: false,
      }),
    });
    return channelUrl;
  }
}

export async function getOrCreateZoneChannel(fireId: number, zoneId: number, zoneTitle?: string | null) {
  const channelUrl = zoneChannelUrl(fireId, zoneId);
  try {
    await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}`);
    return channelUrl;
  } catch {
    await sbFetch(`/v3/group_channels`, {
      method: "POST",
      body: JSON.stringify({
        name: zoneTitle ? `Зона: ${zoneTitle}` : `Zone #${zoneId}`,
        channel_url: channelUrl,
        is_distinct: false,
        custom_type: "zone",
        data: JSON.stringify({ fireId, zoneId }),
        is_public: false,
      }),
    });
    return channelUrl;
  }
}

export async function inviteUserToChannel(channelUrl: string, userId: string) {
  await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/invite`, {
    method: "POST",
    body: JSON.stringify({ user_ids: [userId] }),
  });
}

export async function joinUserToChannel(channelUrl: string, userId: string) {
  // Preferred: invite then accept on behalf (using User-Id header)
  try {
    await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/invite`, {
      method: "POST",
      body: JSON.stringify({ user_ids: [userId] }),
    });
    const url = `${BASE}/v3/group_channels/${encodeURIComponent(channelUrl)}/accept`;
    await fetch(url, {
      method: "PUT",
      headers: {
        "Api-Token": TOKEN,
        "Content-Type": "application/json",
        "User-Id": userId,
      },
    });
    return;
  } catch (_) {}
  // Fallback: try force-add (may require supergroup)
  try {
    await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/members`, {
      method: "POST",
      body: JSON.stringify({ user_ids: [userId] }),
    });
    return;
  } catch (_) {}
  // Fallback: try join (works for public)
  try {
    await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/join`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (_) {
    // ignore
  }
}

export function canUseSendbird() {
  return Boolean(BASE && TOKEN);
}

type SBMessage = {
  message_id: number;
  type: string; // 'MESG' | 'FILE' | 'ADMM' etc.
  message?: string;
  data?: string;
  created_at: number; // ms
  user?: { user_id: string; nickname?: string };
};

export async function listChannelMessages(channelUrl: string, take = 200, { includeSystem = false }: { includeSystem?: boolean } = {}) {
  // Fetch recent messages by paging backward using message_ts
  const results: SBMessage[] = [];
  let ts = Date.now();
  const maxPage = Math.max(1, Math.ceil(Math.min(take, 1000) / 100));
  for (let i = 0; i < maxPage && results.length < take; i++) {
    const prevLimit = Math.min(100, take - results.length);
    const params = new URLSearchParams({
      message_ts: String(ts),
      prev_limit: String(prevLimit),
      next_limit: '0',
      include: 'true',
      reverse: 'true',
      include_parent_message_info: 'true',
      include_thread_info: 'true',
      with_sorted_meta_array: 'false',
      // Filter to user messages unless includeSystem
      ...(includeSystem ? {} : { message_type: 'MESG' }),
    });
    try {
      const page = await sbFetch<SBMessage[]>(`/v3/group_channels/${encodeURIComponent(channelUrl)}/messages?${params.toString()}`);
      if (!Array.isArray(page) || page.length === 0) break;
      results.push(...page);
      ts = Math.min(...page.map((m) => m.created_at)) - 1;
    } catch (e) {
      break;
    }
  }
  // Normalize newest last
  results.sort((a, b) => a.created_at - b.created_at);
  return results.slice(-take);
}
