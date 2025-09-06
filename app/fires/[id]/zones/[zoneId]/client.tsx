// app/fires/[id]/zones/[zoneId]/client.tsx
"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Users, ArrowLeft, Image as ImageIcon, MessageCircle, X } from "lucide-react";
import { circlePolygon } from "@/lib/geo";
import ImageUploader from "@/components/uploads/image-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "satellite-streets-v12";

function buildStaticMapPreview(z: any) {
  if (!TOKEN) return null;
  const path = (() => {
    if (z.geomType === "circle" && z.centerLat != null && z.centerLng != null && z.radiusM) {
      const poly = circlePolygon({ lat: z.centerLat, lng: z.centerLng }, z.radiusM, 60).geometry.coordinates[0];
      const pts = poly.map(([lng, lat]: [number, number]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
      return `path-3+dc2626-80(${pts})`;
    }
    const ring = (z.polygon || []).concat([(z.polygon || [])[0] || [0, 0]]);
    const pts = ring.map(([lng, lat]: [number, number]) => `${lng},${lat}`).join(";");
    return `path-3+dc2626-80(${pts})`;
  })();

  const overlay = encodeURIComponent(path);
  const size = "1200x500@2x";
  return `https://api.mapbox.com/styles/v1/mapbox/${STYLE}/static/${overlay}/auto/${size}?padding=60&access_token=${TOKEN}`;
}

export default function ZoneDetailsClient({
  fireId,
  zoneId,
  data,
  canEdit,
}: {
  fireId: number;
  zoneId: number;
  data: {
    ok: true;
    zone: any;
    members: { userId: number; name: string | null; email: string; joinedAt: string }[];
    coverUrl?: string | null;
    updates: { id: number; text: string | null; createdAt: string; userId: number; name: string | null; email: string; images: any[] }[];
    myZoneId?: number | null;
    isMember?: boolean;
    viewerUserId?: number | null;
  };
  canEdit: boolean;
}) {
  const z = data.zone;
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState<string>(z.title || "");
  const [metaDesc, setMetaDesc] = useState<string>(z.description || "");
  const [savingMeta, setSavingMeta] = useState(false);

  const join = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setJoining(false);
    }
  };

  const leave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/0/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      location.href = `/fires/${fireId}`;
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setLeaving(false);
    }
  };

  const cover = data.coverUrl || buildStaticMapPreview(z);
  const isMember = !!data.isMember;
  const inAnotherZone = data.myZoneId != null && data.myZoneId !== zoneId;
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<"fire" | "zone">("zone");
  const fireConnect = `/api/fires/${fireId}/chat/connect`;
  const zoneConnect = isMember ? `/api/fires/${fireId}/zones/${zoneId}/chat/connect` : null;
  // Lazy import to avoid SSR issues
  const SendbirdChat = require("@/components/chat/sendbird-chat").default;
  const { useSendbirdUnreadMany } = require("@/hooks/useSendbirdUnreadMany");
  const activeConnectUrl = (activeChat === 'zone' && zoneConnect) ? zoneConnect : fireConnect;
  const { total: unreadCount, counts } = useSendbirdUnreadMany([fireConnect, ...(zoneConnect ? [zoneConnect] : [])], chatOpen, activeConnectUrl);
  const fireUnread = counts?.[fireConnect] || 0;
  const zoneUnread = zoneConnect ? (counts?.[zoneConnect] || 0) : 0;

  // ----- Composer state -----
  const [postText, setPostText] = useState("");
  const [postImages, setPostImages] = useState<{ key: string; url: string }[]>([]);
  const [posting, setPosting] = useState(false);

  async function submitPost() {
    if (!postText.trim() && postImages.length === 0) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText.trim(), images: postImages }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка при публикуване");
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setPosting(false);
    }
  }

  // ----- Edit state -----
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAddImages, setEditAddImages] = useState<{ key: string; url: string }[]>([]);
  const [editRemoveImageIds, setEditRemoveImageIds] = useState<number[]>([]);

  function startEdit(u: any) {
    setEditingId(u.id);
    setEditText(u.text || "");
    setEditAddImages([]);
    setEditRemoveImageIds([]);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditAddImages([]);
    setEditRemoveImageIds([]);
  }

  async function saveEdit() {
    if (editingId == null) return;
    const payload: any = { text: editText };
    if (editAddImages.length) payload.addImages = editAddImages;
    if (editRemoveImageIds.length) payload.removeImageIds = editRemoveImageIds;
    const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}/updates/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    if (!res?.ok) {
      alert(res?.error || "Грешка при запис");
      return;
    }
    location.reload();
  }

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: metaTitle, description: metaDesc }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка при запис на зоната");
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setSavingMeta(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="mb-4">
        <a href={`/fires/${fireId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад към пожара
        </a>
      </div>

      <Card className="overflow-hidden">
        {cover ? (
          <AspectRatio ratio={16 / 6}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={z.title || `Зона #${z.id}`} className="w-full h-full object-cover" />
          </AspectRatio>
        ) : (
          <div className="h-[280px] bg-gradient-to-br from-muted to-background flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mr-2" /> Няма изображение
          </div>
        )}

        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2 w-full">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {editingMeta ? (
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder={`Зона #${z.id}`}
                  maxLength={120}
                />
              ) : (
                <span className="truncate">{z.title || `Зона #${z.id}`}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="whitespace-nowrap">
                <Users className="h-3.5 w-3.5 mr-1" />
                {data.members.length} член(а)
              </Badge>
              {canEdit && !editingMeta && (
                <Button size="sm" variant="outline" onClick={() => setEditingMeta(true)}>Редактирай</Button>
              )}
              {canEdit && editingMeta && (
                <>
                  <Button size="sm" onClick={saveMeta} disabled={savingMeta}>{savingMeta ? "Запис…" : "Запази"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingMeta(false); setMetaTitle(z.title || ""); setMetaDesc(z.description || ""); }}>
                    Отказ
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
          <CardContent className="space-y-4">
            {canEdit && editingMeta && (
              <div className="grid gap-2">
                <label className="text-sm text-muted-foreground">Описание</label>
                <Textarea
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  maxLength={4000}
                  placeholder="Добавете кратко описание на зоната…"
                />
                <div className="grid gap-2 pt-2">
                  <label className="text-sm text-muted-foreground">Корица</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="Корица" className="h-[72px] w-[128px] object-cover rounded-md border" />
                    ) : null}
                    <ImageUploader
                      prefix={`fires/${fireId}/zones/${zoneId}/cover`}
                      onUploaded={async (f) => {
                        await fetch(`/api/fires/${fireId}/zones/${zoneId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ setCoverImage: { url: f.url, key: f.key } }),
                        });
                        location.reload();
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          {!isMember && (
            <div className="rounded-md border p-4 bg-muted/30">
              {inAnotherZone ? (
                <div className="space-y-3">
                  <div className="text-sm">В момента сте присъединени към друга зона на този пожар.</div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={join} disabled={joining}>
                      {joining ? "Смяна…" : "Смени зоната и влез тук"}
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`/fires/${fireId}`}>Назад към пожара</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm">Не сте в зона за този пожар. Искате ли да влезете?</div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={join} disabled={joining}>
                      {joining ? "Присъединяване…" : "Влез в зоната"}
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`/fires/${fireId}`}>Назад към пожара</a>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {isMember && !editingMeta ? (
            z.description ? (
              <p className="text-muted-foreground">{z.description}</p>
            ) : (
              <p className="text-muted-foreground italic">Няма описание.</p>
            )
          ) : null}

          {isMember && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={leave} disabled={leaving}>
                {leaving ? "Излизане…" : "Излез от зона"}
              </Button>
            </div>
          )}

          {isMember && <Separator />}

          {/* Gallery removed; single cover image only */}

          {isMember && <Separator />}

          {isMember && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">Членове</div>
            {data.members.length === 0 ? (
              <div className="text-sm text-muted-foreground">Няма членове.</div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {data.members.map((m) => (
                  <li key={m.userId} className="text-sm">
                    <span className="font-medium break-words">{m.name || m.email}</span>
                    <span className="text-muted-foreground"> — от {new Date(m.joinedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}

          {isMember && <Separator />}

          {isMember && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">Ново обновление</div>
            {canEdit ? (
              <div className="rounded-md border p-3 bg-muted/20 space-y-2 overflow-hidden">
                <textarea
                  className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm max-w-full"
                  placeholder="Какво се случи? Добавете кратко описание..."
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                />
                {postImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {postImages.map((im, idx) => (
                      <div key={idx} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.url} alt="" className="h-[120px] w-full object-cover rounded-md border" />
                        <button
                          type="button"
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs"
                          onClick={() => setPostImages((arr) => arr.filter((_, i) => i !== idx))}
                          title="Премахни"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[160px]">
                    <ImageUploader
                      prefix={`fires/${fireId}/zones/${zoneId}/updates`}
                      onUploaded={(f) => setPostImages((arr) => [...arr, { key: f.key, url: f.url }])}
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                    <Button className="flex-1 sm:flex-none" variant="outline" disabled={posting || (!postText.trim() && postImages.length === 0)} onClick={() => { setPostText(""); setPostImages([]); }}>Изчисти</Button>
                    <Button className="flex-1 sm:flex-none" onClick={submitPost} disabled={posting || (!postText.trim() && postImages.length === 0)}>
                      {posting ? "Публикуване…" : "Публикувай"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Само потвърдени доброволци могат да публикуват.</div>
            )}
          </div>
          )}

          {isMember && <Separator />}

          {isMember && (
          <div className="grid gap-2">
            <div className="text-sm font-medium">Обновления</div>
            {data.updates.length === 0 ? (
              <div className="text-sm text-muted-foreground">Няма обновления.</div>
            ) : (
              <ul className="space-y-3">
                {data.updates.map((u) => (
                  <li key={u.id} className="text-sm rounded-md border p-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium break-words">{u.name || u.email}</div>
                        <div className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleString()}</div>
                      </div>
                      {u.userId === data.viewerUserId && (
                        <div className="flex gap-2">
                          {editingId === u.id ? (
                            <>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>Отказ</Button>
                              <Button size="sm" onClick={saveEdit}>Запази</Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Редактирай</Button>
                          )}
                        </div>
                      )}
                    </div>

                    {editingId === u.id ? (
                      <div className="mt-2 space-y-2 overflow-hidden">
                        <textarea
                          className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm max-w-full"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        {u.images?.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {u.images.map((im: any) => (
                              <div key={im.id} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={im.url} alt="" className="h-[120px] w-full object-cover rounded-md border" />
                                <button
                                  type="button"
                                  className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs"
                                  onClick={() => setEditRemoveImageIds((arr) => (arr.includes(im.id) ? arr : [...arr, im.id]))}
                                  title="Премахни"
                                >×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {editAddImages.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {editAddImages.map((im, idx) => (
                              <div key={idx} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={im.url} alt="" className="h-[120px] w-full object-cover rounded-md border" />
                                <button
                                  type="button"
                                  className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs"
                                  onClick={() => setEditAddImages((arr) => arr.filter((_, i) => i !== idx))}
                                  title="Премахни"
                                >×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-[160px]">
                            <ImageUploader
                              prefix={`fires/${fireId}/zones/${zoneId}/updates`}
                              onUploaded={(f) => setEditAddImages((arr) => [...arr, { key: f.key, url: f.url }])}
                            />
                          </div>
                          {editRemoveImageIds.length > 0 && (
                            <div className="text-xs text-muted-foreground">За изтриване: {editRemoveImageIds.length} снимки</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {u.text && <div className="text-muted-foreground whitespace-pre-wrap break-words">{u.text}</div>}
                        {u.images?.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {u.images.map((im: any) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={im.id} src={im.url} alt="" className="h-[120px] w-full object-cover rounded-md border" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Chat Panel */}
      {(
        <div>
          {chatOpen && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-30 w-[min(420px,calc(100vw-1rem))] max-h-[70vh] bg-background/95 backdrop-blur border rounded-xl shadow-xl p-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="inline-flex p-0.5 bg-muted rounded-full">
                  <button className={`px-3 py-1.5 rounded-full text-sm ${activeChat === 'zone' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`} onClick={() => setActiveChat('zone')} disabled={!zoneConnect}>
                    Зона {z.title ? `(${z.title})` : ''} {zoneConnect && counts[zoneConnect] ? <span className="ml-1 text-xs bg-red-600 text-white rounded-full px-1">{counts[zoneConnect] > 99 ? '99+' : counts[zoneConnect]}</span> : null}
                  </button>
                  <button className={`px-3 py-1.5 rounded-full text-sm ${activeChat === 'fire' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/10'}`} onClick={() => setActiveChat('fire')}>
                    Общ чат {counts[fireConnect] ? <span className="ml-1 text-xs bg-red-600 text-white rounded-full px-1">{counts[fireConnect] > 99 ? '99+' : counts[fireConnect]}</span> : null}
                  </button>
                </div>
                <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted" onClick={() => setChatOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {activeChat === 'zone' && zoneConnect && <SendbirdChat connectUrl={zoneConnect} />}
              {activeChat === 'zone' && !zoneConnect && (
                <div className="text-sm text-muted-foreground py-10 text-center">Не сте член на тази зона. Влезте, за да видите чат.</div>
              )}
              {activeChat === 'fire' && <SendbirdChat connectUrl={fireConnect} />}
            </div>
          )}
          {!chatOpen && unreadCount > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-24 z-30 max-w-[calc(100vw-1rem)]">
              <button type="button" onClick={() => setChatOpen(true)} className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 shadow-lg hover:opacity-95 transition" title="Отвори чата">
                Имаш {unreadCount} непрочетени — Общ: {fireUnread}{zoneConnect ? `, Зона: ${zoneUnread}` : ""}
              </button>
            </div>
          )}
          <div className="fixed bottom-4 right-4 z-40">
            <div className="relative">
              <Button size="icon" className="rounded-full h-12 w-12 shadow-lg" onClick={() => setChatOpen((v: boolean) => !v)} title="Чат">
                <MessageCircle className="h-6 w-6" />
              </Button>
              {unreadCount > 0 && !chatOpen && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
