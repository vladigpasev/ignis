// app/fires/[id]/zones/[zoneId]/client.tsx
"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  ArrowLeft,
  Image as ImageIcon,
  MessageCircle,
  X,
  Loader2,
  PencilLine,
} from "lucide-react";
import { circlePolygon } from "@/lib/geo";
import ImageUploader from "@/components/uploads/image-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Markdown from "@/components/ui/markdown";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "satellite-streets-v12";

function buildStaticMapPreview(z: any) {
  if (!TOKEN) return null;
  const path = (() => {
    if (
      z.geomType === "circle" &&
      z.centerLat != null &&
      z.centerLng != null &&
      z.radiusM
    ) {
      const poly = circlePolygon(
        { lat: z.centerLat, lng: z.centerLng },
        z.radiusM,
        60
      ).geometry.coordinates[0];
      const pts = poly
        .map(([lng, lat]: [number, number]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
        .join(";");
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

function initials(name?: string | null, email?: string) {
  const src = (name || email || "").trim();
  if (!src) return "U";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const m = src.match(/[A-Za-zА-Яа-я]/g);
  if (!m) return src.slice(0, 2).toUpperCase();
  return m.slice(0, 2).join("").toUpperCase();
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
    members: {
      userId: number;
      name: string | null;
      email: string;
      joinedAt: string;
      avatarUrl?: string | null;
    }[];
    coverUrl?: string | null;
    updates: {
      id: number;
      text: string | null;
      createdAt: string;
      userId: number;
      name: string | null;
      email: string;
      images: { id: number; url: string }[];
    }[];
    myZoneId?: number | null;
    isMember?: boolean;
    viewerUserId?: number | null;
  };
  canEdit: boolean;
}) {
  const z = data.zone;
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // ---- Meta edit state (в таб "Информация") ----
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState<string>(z.title || "");
  const [metaDesc, setMetaDesc] = useState<string>(z.description || "");
  const [savingMeta, setSavingMeta] = useState(false);

  async function join() {
    setJoining(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Възникна грешка.");
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Възникна грешка.");
    } finally {
      setJoining(false);
    }
  }

  async function leave() {
    if (!confirm("Сигурни ли сте, че искате да напуснете зоната?")) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/0/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Възникна грешка.");
      location.href = `/fires/${fireId}`;
    } catch (e: any) {
      alert(e?.message || "Възникна грешка.");
    } finally {
      setLeaving(false);
    }
  }

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: metaTitle, description: metaDesc }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Неуспешно запазване.");
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Възникна грешка.");
    } finally {
      setSavingMeta(false);
    }
  }

  const cover = data.coverUrl || buildStaticMapPreview(z);
  const isMember = !!data.isMember;
  const inAnotherZone = data.myZoneId != null && data.myZoneId !== zoneId;

  // ---- Чат (lazy import за избягване на SSR проблеми) ----
  const SendbirdChat = require("@/components/chat/sendbird-chat").default;
  const { useSendbirdUnreadMany } = require("@/hooks/useSendbirdUnreadMany");
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<"fire" | "zone">("zone");
  const fireConnect = `/api/fires/${fireId}/chat/connect`;
  const zoneConnect = isMember ? `/api/fires/${fireId}/zones/${zoneId}/chat/connect` : null;
  const activeConnectUrl =
    activeChat === "zone" && zoneConnect ? zoneConnect : fireConnect;
  const { total: unreadCount, counts } = useSendbirdUnreadMany(
    [fireConnect, ...(zoneConnect ? [zoneConnect] : [])],
    chatOpen,
    activeConnectUrl
  );
  const fireUnread = counts?.[fireConnect] || 0;
  const zoneUnread = zoneConnect ? counts?.[zoneConnect] || 0 : 0;

  // ----- Composer state -----
  const [postText, setPostText] = useState("");
  const [postImages, setPostImages] = useState<{ key: string; url: string }[]>(
    []
  );
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
      if (!res?.ok)
        throw new Error(
          res?.error || "Възникна грешка при публикуването."
        );
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Възникна грешка.");
    } finally {
      setPosting(false);
    }
  }

  // ----- Edit update state -----
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAddImages, setEditAddImages] = useState<
    { key: string; url: string }[]
  >([]);
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
    const res = await fetch(
      `/api/fires/${fireId}/zones/${zoneId}/updates/${editingId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ).then((r) => r.json());
    if (!res?.ok) {
      alert(res?.error || "Неуспешно запазване на редакцията.");
      return;
    }
    location.reload();
  }

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <a
          href={`/fires/${fireId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад към пожара
        </a>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="whitespace-nowrap">
            <Users className="h-3.5 w-3.5 mr-1" />
            {data.members.length} член{data.members.length === 1 ? "" : "а"}
          </Badge>

          {isMember ? (
            <Button variant="outline" onClick={leave} disabled={leaving}>
              {leaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Напускане…
                </>
              ) : (
                "Напусни зоната"
              )}
            </Button>
          ) : (
            <Button onClick={join} disabled={joining}>
              {joining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Присъединяване…
                </>
              ) : inAnotherZone ? (
                "Присъедини се към тази зона"
              ) : (
                "Присъедини се към зоната"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Left column */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="truncate">
                {z.title || `Зона #${z.id}`}
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant={editingMeta ? "secondary" : "outline"}
                  onClick={() => {
                    setEditingMeta(true);
                    // Превключваме към таб "info" чрез URL hash (без сложни state машинарии)
                    const el = document.getElementById("tab-info-trigger");
                    (el as HTMLButtonElement | null)?.click?.();
                  }}
                >
                  <PencilLine className="h-4 w-4 mr-1" />
                  Редактирай
                </Button>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-4">
            <Tabs defaultValue="updates" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="updates" className="flex-1">
                  Активност
                </TabsTrigger>
                <TabsTrigger value="members" className="flex-1">
                  Членове
                </TabsTrigger>
                <TabsTrigger id="tab-info-trigger" value="info" className="flex-1">
                  Информация
                </TabsTrigger>
              </TabsList>

              {/* === Updates === */}
              <TabsContent value="updates" className="mt-4">
                {isMember && (
                  <>
                    {canEdit ? (
                      <div className="rounded-md border p-3 bg-muted/20 space-y-2 overflow-hidden mb-4">
                        <Textarea
                          className="w-full min-h-[100px]"
                          placeholder="Какво се случва? Сподели текст и/или снимки…"
                          value={postText}
                          onChange={(e) => setPostText(e.target.value)}
                        />
                        {postImages.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {postImages.map((im, idx) => (
                              <div key={idx} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={im.url}
                                  alt=""
                                  className="h-[120px] w-full object-cover rounded-md border"
                                />
                                <button
                                  type="button"
                                  className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs"
                                  onClick={() =>
                                    setPostImages((arr) =>
                                      arr.filter((_, i) => i !== idx)
                                    )
                                  }
                                  title="Премахни"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-[160px]">
                            <ImageUploader
                              prefix={`fires/${fireId}/zones/${zoneId}/updates`}
                              onUploaded={(f) =>
                                setPostImages((arr) => [
                                  ...arr,
                                  { key: f.key, url: f.url },
                                ])
                              }
                            />
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                            <Button
                              className="flex-1 sm:flex-none"
                              variant="outline"
                              disabled={
                                posting ||
                                (!postText.trim() && postImages.length === 0)
                              }
                              onClick={() => {
                                setPostText("");
                                setPostImages([]);
                              }}
                            >
                              Изчистване
                            </Button>
                            <Button
                              className="flex-1 sm:flex-none"
                              onClick={submitPost}
                              disabled={
                                posting ||
                                (!postText.trim() && postImages.length === 0)
                              }
                            >
                              {posting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Публикуване…
                                </>
                              ) : (
                                "Публикувай"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mb-4">
                        Нямате права да публикувате в тази зона.
                      </div>
                    )}
                  </>
                )}

                {/* Feed */}
                {isMember ? (
                  data.updates.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Още няма публикации.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {data.updates.map((u) => (
                        <li key={u.id} className="text-sm rounded-md border p-3 bg-card">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={undefined} alt="" />
                                <AvatarFallback>
                                  {initials(u.name, u.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium break-words">
                                  {u.name || u.email}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(u.createdAt).toLocaleString("bg-BG")}
                                </div>
                              </div>
                            </div>
                            {u.userId === data.viewerUserId && (
                              <div className="flex gap-2">
                                {editingId === u.id ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelEdit}
                                    >
                                      Отказ
                                    </Button>
                                    <Button size="sm" onClick={saveEdit}>
                                      Запази
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEdit(u)}
                                  >
                                    Редактирай
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {editingId === u.id ? (
                            <div className="mt-2 space-y-2 overflow-hidden">
                              <Textarea
                                className="w-full min-h-[100px]"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                              />
                              {u.images?.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {u.images.map((im: any) => (
                                    <div key={im.id} className="relative">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={im.url}
                                        alt=""
                                        className="h-[120px] w-full object-cover rounded-md border"
                                      />
                                      <button
                                        type="button"
                                        className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs"
                                        onClick={() =>
                                          setEditRemoveImageIds((arr) =>
                                            arr.includes(im.id)
                                              ? arr
                                              : [...arr, im.id]
                                          )
                                        }
                                        title="Премахни"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {editAddImages.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {editAddImages.map((im, idx) => (
                                    <div key={idx} className="relative">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={im.url}
                                        alt=""
                                        className="h-[120px] w-full object-cover rounded-md border"
                                      />
                                      <button
                                        type="button"
                                        className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-xs"
                                        onClick={() =>
                                          setEditAddImages((arr) =>
                                            arr.filter((_, i) => i !== idx)
                                          )
                                        }
                                        title="Премахни"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="min-w-[160px]">
                                  <ImageUploader
                                    prefix={`fires/${fireId}/zones/${zoneId}/updates`}
                                    onUploaded={(f) =>
                                      setEditAddImages((arr) => [
                                        ...arr,
                                        { key: f.key, url: f.url },
                                      ])
                                    }
                                  />
                                </div>
                                {editRemoveImageIds.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    Ще премахнете: {editRemoveImageIds.length} снимки
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2">
                              {u.text && (
                                <Markdown content={u.text} className="text-muted-foreground text-sm break-words" />
                              )}
                              {u.images?.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {u.images.map((im: any) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={im.id}
                                      src={im.url}
                                      alt=""
                                      className="h-[120px] w-full object-cover rounded-md border"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="rounded-md border p-4 bg-muted/30">
                    {inAnotherZone ? (
                      <div className="space-y-3">
                        <div className="text-sm">
                          В момента сте в друга зона за този пожар. Можете да се
                          присъедините към тази, което ще ви премести.
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={join} disabled={joining}>
                            {joining ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Присъединяване…
                              </>
                            ) : (
                              "Присъедини се към тази зона"
                            )}
                          </Button>
                          <Button variant="outline" asChild>
                            <a href={`/fires/${fireId}`}>Назад към зоните</a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-sm">
                          Не сте член на тази зона. Искате ли да се присъедините?
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={join} disabled={joining}>
                            {joining ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Присъединяване…
                              </>
                            ) : (
                              "Присъедини се към зоната"
                            )}
                          </Button>
                          <Button variant="outline" asChild>
                            <a href={`/fires/${fireId}`}>Назад към зоните</a>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* === Members === */}
              <TabsContent value="members" className="mt-4">
                {!isMember ? (
                  <div className="text-sm text-muted-foreground">
                    Присъединете се, за да видите членовете на зоната.
                  </div>
                ) : data.members.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Няма членове.
                  </div>
                ) : (
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {data.members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex items-center gap-3 rounded-md border p-2"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.avatarUrl || undefined} alt="" />
                          <AvatarFallback>
                            {initials(m.name, m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium break-words">
                            {m.name || m.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            от {new Date(m.joinedAt).toLocaleString("bg-BG")}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              {/* === Info === */}
              <TabsContent value="info" className="mt-4">
                {editingMeta && canEdit ? (
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <label className="text-sm text-muted-foreground">
                        Заглавие
                      </label>
                      <Input
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder={`Зона #${z.id}`}
                        maxLength={120}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm text-muted-foreground">
                        Описание
                      </label>
                      <Textarea
                        value={metaDesc}
                        onChange={(e) => setMetaDesc(e.target.value)}
                        maxLength={4000}
                        placeholder="Добавете ясно и полезно описание…"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm text-muted-foreground">
                        Корица (картина или статична карта)
                      </label>
                      <div className="flex items-center gap-3 flex-wrap">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt="Корица"
                            className="h-[72px] w-[128px] object-cover rounded-md border"
                          />
                        ) : null}
                        <ImageUploader
                          prefix={`fires/${fireId}/zones/${zoneId}/cover`}
                          multiple={false}
                          onUploaded={async (f) => {
                            await fetch(`/api/fires/${fireId}/zones/${zoneId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                setCoverImage: { url: f.url, key: f.key },
                              }),
                            });
                            location.reload();
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveMeta} disabled={savingMeta}>
                        {savingMeta ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Запазване…
                          </>
                        ) : (
                          "Запази"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingMeta(false);
                          setMetaTitle(z.title || "");
                          setMetaDesc(z.description || "");
                        }}
                      >
                        Отказ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isMember && z.description ? (
                      <p className="text-muted-foreground">{z.description}</p>
                    ) : (
                      <p className="text-muted-foreground italic">
                        Все още няма описание.
                      </p>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right column (sidebar) */}
        <div className="space-y-6 lg:sticky lg:top-20 h-fit">
          <Card className="overflow-hidden">
            {cover ? (
              <AspectRatio ratio={16 / 6}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cover}
                  alt={z.title || `Зона #${z.id}`}
                  className="w-full h-full object-cover"
                />
              </AspectRatio>
            ) : (
              <div className="h-[200px] bg-gradient-to-br from-muted to-background flex items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8 mr-2" /> Няма корица
              </div>
            )}
            <CardContent className="pt-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="secondary">
                  <Users className="h-3.5 w-3.5 mr-1" />
                  {data.members.length} член{data.members.length === 1 ? "" : "а"}
                </Badge>
                {isMember ? (
                  <Button variant="outline" size="sm" onClick={leave} disabled={leaving}>
                    {leaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Напускане…
                      </>
                    ) : (
                      "Напусни зоната"
                    )}
                  </Button>
                ) : (
                  <Button size="sm" onClick={join} disabled={joining}>
                    {joining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Присъединяване…
                      </>
                    ) : (
                      "Присъедини се"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Chat Panel: responsive */}
      <div>
        {chatOpen && (
          <>
            {/* Mobile full-screen overlay */}
            <div className="sm:hidden fixed inset-0 z-50 h-[100dvh] bg-background">
              <div className="flex h-full min-h-0 flex-col pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
                <div className="sticky top-0 z-10 border-b bg-background px-3 py-2 pt-[calc(env(safe-area-inset-top))] flex items-center justify-between gap-2">
                  <div className="inline-flex p-0.5 bg-muted rounded-full">
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm ${
                        activeChat === "zone" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/10"
                      }`}
                      onClick={() => setActiveChat("zone")}
                      disabled={!zoneConnect}
                    >
                      Зона {z.title ? `(${z.title})` : ""}{" "}
                      {zoneConnect && counts?.[zoneConnect] ? (
                        <span className="ml-1 text-xs bg-destructive text-white rounded-full px-1">
                          {counts[zoneConnect] > 99 ? "99+" : counts[zoneConnect]}
                        </span>
                      ) : null}
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-sm ${
                        activeChat === "fire" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/10"
                      }`}
                      onClick={() => setActiveChat("fire")}
                    >
                      Чат за пожара{" "}
                      {counts?.[fireConnect] ? (
                        <span className="ml-1 text-xs bg-destructive text-white rounded-full px-1">
                          {counts[fireConnect] > 99 ? "99+" : counts[fireConnect]}
                        </span>
                      ) : null}
                    </button>
                  </div>
                  <button
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
                    onClick={() => setChatOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden px-3 pt-2">
                  {activeChat === "zone" && zoneConnect && (
                    <div className="h-full">
                      <SendbirdChat connectUrl={zoneConnect} className="h-full" />
                    </div>
                  )}
                  {activeChat === "zone" && !zoneConnect && (
                    <div className="text-sm text-muted-foreground py-10 text-center">
                      Нямате достъп до чата на зоната. Присъединете се първо.
                    </div>
                  )}
                  {activeChat === "fire" && (
                    <div className="h-full">
                      <SendbirdChat connectUrl={fireConnect} className="h-full" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop floating panel */}
            <div className="hidden sm:block fixed bottom-24 right-4 z-30 w-[min(420px,calc(100vw-1rem))] bg-background/95 backdrop-blur border rounded-xl shadow-xl p-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="inline-flex p-0.5 bg-muted rounded-full">
                  <button
                    className={`px-3 py-1.5 rounded-full text-sm ${
                      activeChat === "zone" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/10"
                    }`}
                    onClick={() => setActiveChat("zone")}
                    disabled={!zoneConnect}
                  >
                    Зона {z.title ? `(${z.title})` : ""}{" "}
                    {zoneConnect && counts?.[zoneConnect] ? (
                      <span className="ml-1 text-xs bg-destructive text-white rounded-full px-1">
                        {counts[zoneConnect] > 99 ? "99+" : counts[zoneConnect]}
                      </span>
                    ) : null}
                  </button>
                  <button
                    className={`px-3 py-1.5 rounded-full text-sm ${
                      activeChat === "fire" ? "bg-primary text-primary-foreground" : "hover:bg-muted-foreground/10"
                    }`}
                    onClick={() => setActiveChat("fire")}
                  >
                    Чат за пожара{" "}
                    {counts?.[fireConnect] ? (
                      <span className="ml-1 text-xs bg-destructive text-white rounded-full px-1">
                        {counts[fireConnect] > 99 ? "99+" : counts[fireConnect]}
                      </span>
                    ) : null}
                  </button>
                </div>
                <button
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
                  onClick={() => setChatOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[60vh]">
                {activeChat === "zone" && zoneConnect && (
                  <SendbirdChat connectUrl={zoneConnect} className="h-full" />
                )}
                {activeChat === "zone" && !zoneConnect && (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    Нямате достъп до чата на зоната. Присъединете се първо.
                  </div>
                )}
                {activeChat === "fire" && <SendbirdChat connectUrl={fireConnect} className="h-full" />}
              </div>
            </div>
          </>
        )}
        {!chatOpen && unreadCount > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-24 z-30 max-w-[calc(100vw-1rem)]">
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 shadow-lg hover:opacity-95 transition"
              title="Отвори чата"
            >
              Съобщения {unreadCount} — пожар: {fireUnread}
              {zoneConnect ? `, зона: ${zoneUnread}` : ""}
            </button>
          </div>
        )}
        <div className="fixed bottom-4 right-4 z-40">
          <div className="relative">
            <Button
              size="icon"
              className="rounded-full h-12 w-12 shadow-lg"
              onClick={() => setChatOpen((v: boolean) => !v)}
              title={chatOpen ? "Затвори чата" : "Отвори чата"}
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
            {unreadCount > 0 && !chatOpen && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-white text-xs flex items-center justify-center shadow">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
