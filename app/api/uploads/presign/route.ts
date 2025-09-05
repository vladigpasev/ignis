import { NextResponse } from "next/server";
import { presignPutObject } from "@/lib/s3";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prefix = "uploads", contentType = "application/octet-stream", ext = "" } =
      (await req.json().catch(() => ({}))) as {
        prefix?: string;
        contentType?: string;
        ext?: string;
      };
    const safePrefix = String(prefix)
      .replace(/[^a-zA-Z0-9/_-]/g, "")
      .replace(/^\/+/, "")
      .slice(0, 80) || "uploads";
    const safeExt = ext && String(ext).slice(0, 16).replace(/[^a-zA-Z0-9.]/g, "");
    const key = `${safePrefix}/${uuid()}${safeExt ? (safeExt.startsWith(".") ? safeExt : "." + safeExt) : ""}`;
    const { url, publicUrl } = await presignPutObject(key, contentType);
    return NextResponse.json({ ok: true, url, key, publicUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Presign error" }, { status: 500 });
  }
}

