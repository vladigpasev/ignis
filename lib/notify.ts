function env(name: string, fallback?: string) {
  const v = process.env[name];
  return v && v.length ? v : fallback;
}

// Email via Resend
const RESEND_API_KEY = env('RESEND_API_KEY', '');
const RESEND_FROM = env('NOTIFY_EMAIL_FROM', 'alerts@firelinks.org');

// SMS via QuadraMM
const QUADRA_BASE = env('QUADRA_SMS_GATEWAY_URL', 'http://gate.quadra-mm.com/feed/http.asp');
const QUADRA_USER = env('QUADRA_SMS_USER', '');
const QUADRA_PASS = env('QUADRA_SMS_PASS', '');
const QUADRA_ROUTE = env('QUADRA_SMS_ROUTE', 'eu');

export type DeliveryResult = { ok: boolean; id?: string; error?: string };

export function normalizeBgPhone(input: string): string | null {
  const raw = (input || '').replace(/\s+|\(|\)|-/g, '');
  if (!raw) return null;
  let n = raw.replace(/^\+/, '');
  if (n.startsWith('00')) n = n.slice(2);
  // If starts with 0 and has 9 or 10 digits, strip 0 and prefix 359
  if (n.startsWith('0')) {
    n = '359' + n.slice(1);
  }
  // If starts with 359 already, keep
  if (/^359\d{9}$/.test(n)) return n;
  // If looks like mobile without country code (e.g., 88xxxxxxxx)
  if (/^8\d{8}$/.test(n)) return '359' + n;
  return null;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<DeliveryResult> {
  try {
    if (!RESEND_API_KEY) return { ok: false, error: 'Missing RESEND_API_KEY' };
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || res.statusText };
    }
    return { ok: true, id: data?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Email send failed' };
  }
}

export async function sendSms(phone: string, message: string): Promise<DeliveryResult> {
  try {
    const normalized = normalizeBgPhone(phone);
    if (!normalized) return { ok: false, error: 'Invalid phone format' };
    if (!QUADRA_USER || !QUADRA_PASS) return { ok: false, error: 'Missing SMS credentials' };
    const params = new URLSearchParams({
      user: QUADRA_USER || '',
      pass: QUADRA_PASS || '',
      route: QUADRA_ROUTE || '',
      number: normalized,
      message: message,
    });
    // Quadra requires URL-encoded; URLSearchParams encodes with + for spaces
    const url = `${QUADRA_BASE}?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    if (text.startsWith('OK')) {
      const id = text.split(/\s+/)[1] || undefined;
      return { ok: true, id };
    }
    return { ok: false, error: text };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'SMS send failed' };
  }
}

export function buildReportEmail({
  lat, lng, radiusM, fireId, baseUrl, unsubscribeUrl,
}: { lat: number; lng: number; radiusM?: number; fireId: number; baseUrl: string; unsubscribeUrl?: string }) {
  const link = `${baseUrl}/fires/${fireId}`;
  const source = 'Докладван пожар (потвърден източник)';
  const subject = 'Докладван пожар близо до вас';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5;">
      <p>Източник: <strong>${source}</strong></p>
      <p>Локация: <a href="${link}">${lat.toFixed(4)}, ${lng.toFixed(4)}</a></p>
      ${radiusM ? `<p>Приблизителен радиус: ${Math.round(radiusM)} м</p>` : ''}
      <p>Виж детайли: <a href="${link}">${link}</a></p>
      <hr />
      <p>firelinks.org — обществен мониторинг на пожари</p>
      ${unsubscribeUrl ? `<p style="font-size:12px;color:#6b7280;">Ако не желаете повече известия, можете да се отпишете: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>` : ''}
    </div>
  `;
  const text = `Източник: ${source}\nЛокация: ${lat.toFixed(4)}, ${lng.toFixed(4)}\nЛинк: ${link}${unsubscribeUrl ? `\nОтписване: ${unsubscribeUrl}` : ''}`;
  return { subject, html, text };
}

export function buildReportSms({
  lat, lng, fireId, baseUrl, unsubscribeUrl,
}: { lat: number; lng: number; fireId: number; baseUrl: string; unsubscribeUrl?: string }) {
  const link = `${baseUrl}/fires/${fireId}`;
  const prefix = 'Докладван пожар:';
  const msg = `${prefix} ${lat.toFixed(4)},${lng.toFixed(4)} ${link}${unsubscribeUrl ? ` Отписване: ${unsubscribeUrl}` : ''}`;
  return msg;
}
