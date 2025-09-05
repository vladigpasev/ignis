
const BASE = process.env.SENDBIRD_API_BASE_URL!;
const TOKEN = process.env.SENDBIRD_API_TOKEN!;
const APP_BASE = process.env.APP_BASE_URL || "";

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

export async function inviteUserToChannel(channelUrl: string, userId: string) {
  await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/invite`, {
    method: "POST",
    body: JSON.stringify({ user_ids: [userId] }),
  });
}

export async function joinUserToChannel(channelUrl: string, userId: string) {
  // Joins the channel to ensure immediate access to full history
  try {
    await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/join`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (e) {
    // If join is disallowed, try adding as member directly
    try {
      await sbFetch(`/v3/group_channels/${encodeURIComponent(channelUrl)}/members`, {
        method: "POST",
        body: JSON.stringify({ user_ids: [userId] }),
      });
    } catch (_) {
      // ignore; the user might already be joined
    }
  }
}
