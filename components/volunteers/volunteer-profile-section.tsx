"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VolunteerModal from "@/components/volunteers/volunteer-modal";
import { useRouter } from "next/navigation";
import {
  HeartHandshake,
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  BellRing,
  Car,
  Truck,
  Bike,
} from "lucide-react";

type Transport = { car?: boolean; suv4x4?: boolean; truck?: boolean; motorcycle?: boolean };

type VolunteerProfile = {
  id: number;
  phone: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  motivation: string | null;
  skills: string[] | null;
  transport: Transport | null;
  availability: string | null;
  firstAid: number | null; // 1/0
  agreeContact: number | null; // 1/0
  completedAt: Date | string | null;
};

export default function VolunteerProfileSection({ profile }: { profile: VolunteerProfile | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const completed = !!profile?.completedAt;
  const skills = useMemo(() => (Array.isArray(profile?.skills) ? profile!.skills! : []), [profile]);
  const transport = useMemo<Transport>(() => (typeof profile?.transport === 'object' && profile?.transport ? profile.transport : {}), [profile]);

  const availabilityLabel = useMemo(() => {
    const v = profile?.availability || 'anytime';
    switch (v) {
      case 'weekdays': return 'Делнични дни';
      case 'weekends': return 'Уикенди';
      case 'evenings': return 'Вечери';
      default: return 'По всяко време';
    }
  }, [profile?.availability]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Доброволчески профил</h3>
          {completed ? (
            <Badge variant="success" className="ml-2">Попълнен</Badge>
          ) : (
            <Badge variant="warning" className="ml-2">Непопълнен</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setOpen(true)} className="w-full sm:w-auto">{completed ? 'Редактирай' : 'Попълни профила'}</Button>
        </div>
      </div>

      {completed ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="grid sm:grid-cols-2 gap-6 p-4 sm:p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Локация:</span>
                <span className="truncate">{profile?.city || '—'}</span>
                {Number.isFinite(profile?.lat) && Number.isFinite(profile?.lng) && (
                  <Badge variant="outline" className="ml-auto sm:ml-2">{Number(profile!.lat).toFixed(4)}, {Number(profile!.lng).toFixed(4)}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Телефон:</span>
                <span>{profile?.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Наличност:</span>
                <span>{availabilityLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Първа помощ:</span>
                <span>{profile?.firstAid ? 'Да' : 'Не'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BellRing className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Съгласие за контакт:</span>
                <span>{profile?.agreeContact === 0 ? 'Не' : 'Да'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-2">Умения</div>
                <div className="flex flex-wrap gap-2">
                  {skills.length > 0 ? skills.map((s) => (
                    <Badge key={s} variant="secondary" className="capitalize">{skillLabel(s)}</Badge>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Транспорт</div>
                <div className="flex flex-wrap gap-2">
                  {transportBadges(transport)}
                  {(!transport?.car && !transport?.truck && !transport?.suv4x4 && !transport?.motorcycle) && (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {(profile?.bio || profile?.motivation) && (
            <div className="grid sm:grid-cols-2 gap-6 border-t p-4 sm:p-6">
              {profile?.bio && (
                <div>
                  <div className="text-sm font-medium mb-1">Кратко за мен</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                </div>
              )}
              {profile?.motivation && (
                <div>
                  <div className="text-sm font-medium mb-1">Мотивация</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.motivation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Стани доброволец и помогни при пожари</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            <p>Попълни профила си, за да се включиш в доброволчески инициативи и да получаваш известия за пожари близо до теб.</p>
            <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
              Попълни доброволчески профил
            </Button>
          </CardContent>
        </Card>
      )}

      <VolunteerModal
        open={open}
        onOpenChange={setOpen}
        afterSave={() => router.refresh()}
        title={completed ? 'Редактирай доброволчески профил' : 'Стани доброволец'}
        submitLabel={completed ? 'Запази промените' : 'Стани доброволец'}
        cancelLabel={completed ? 'Отказ' : 'Пропусни'}
      />
    </div>
  );
}

function skillLabel(s: string) {
  switch (s) {
    case 'first_aid': return 'Първа помощ';
    case 'firefighting': return 'Опит с пожари';
    case 'navigation': return 'Навигация/карти';
    case 'communications': return 'Комуникации/координация';
    case 'logistics': return 'Логистика/доставки';
    case 'support': return 'Готвене/подкрепа';
    default: return s;
  }
}

function transportBadges(t: Transport) {
  const list: JSX.Element[] = [];
  if (t.car) list.push(<Badge key="car" variant="outline" className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Лек автомобил</Badge>);
  if (t.suv4x4) list.push(<Badge key="suv" variant="outline" className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /> 4x4</Badge>);
  if (t.truck) list.push(<Badge key="truck" variant="outline" className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Бус/камион</Badge>);
  if (t.motorcycle) list.push(<Badge key="moto" variant="outline" className="flex items-center gap-1"><Bike className="w-3.5 h-3.5" /> Мотоциклет</Badge>);
  return list;
}
