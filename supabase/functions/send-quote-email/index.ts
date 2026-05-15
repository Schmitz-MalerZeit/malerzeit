// Send a quote PDF as an email via the user's own SMTP server.
// The PDF is uploaded as base64 in the request body. Auth required.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { decryptPassword } from "../_shared/smtp-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthenticated" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const to = String(body?.to ?? "").trim();
  const cc = String(body?.cc ?? "").trim();
  const bcc = String(body?.bcc ?? "").trim();
  const subject = String(body?.subject ?? "").trim().slice(0, 250);
  const text = String(body?.body ?? "").slice(0, 20000);
  const attachmentBase64 = String(body?.attachmentBase64 ?? "");
  const attachmentName = String(body?.attachmentName ?? "Preisorientierung.pdf").slice(0, 200);

  if (!to || !isEmail(to)) return json({ error: "invalid_recipient" }, 400);
  if (!subject) return json({ error: "missing_subject" }, 400);
  if (!text) return json({ error: "missing_body" }, 400);
  if (!attachmentBase64) return json({ error: "missing_attachment" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: settings, error: sErr } = await admin
    .from("user_settings")
    .select("smtp_host, smtp_port, smtp_secure, smtp_username, smtp_from_name, smtp_from_email, smtp_reply_to")
    .eq("user_id", userId)
    .maybeSingle();
  if (sErr || !settings?.smtp_host || !settings.smtp_port || !settings.smtp_username || !settings.smtp_from_email) {
    return json({ error: "smtp_not_configured" }, 400);
  }

  const { data: cred, error: cErr } = await admin
    .from("user_smtp_credentials")
    .select("password_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (cErr || !cred?.password_encrypted) {
    return json({ error: "smtp_not_configured" }, 400);
  }

  let password: string;
  try { password = await decryptPassword(cred.password_encrypted); }
  catch { return json({ error: "credentials_corrupt" }, 500); }

  // Decode base64 PDF (handle data URLs too)
  const cleanB64 = attachmentBase64.replace(/^data:[^;]+;base64,/, "");
  let pdfBytes: Uint8Array;
  try {
    const bin = atob(cleanB64);
    pdfBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) pdfBytes[i] = bin.charCodeAt(i);
  } catch {
    return json({ error: "bad_attachment" }, 400);
  }
  if (pdfBytes.length === 0) return json({ error: "empty_attachment" }, 400);
  if (pdfBytes.length > 25 * 1024 * 1024) return json({ error: "attachment_too_large" }, 400);

  const fromEmail = settings.smtp_from_email;
  const fromName = settings.smtp_from_name || "";
  const fromHeader = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const secure = (settings.smtp_secure ?? "ssl") as "ssl" | "starttls" | "none";

  const client = new SMTPClient({
    connection: {
      hostname: settings.smtp_host,
      port: Number(settings.smtp_port),
      tls: secure === "ssl",
      auth: { username: settings.smtp_username, password },
    },
  });

  try {
    await client.send({
      from: fromHeader,
      to,
      cc: cc && isEmail(cc) ? cc : undefined,
      bcc: bcc && isEmail(bcc) ? bcc : undefined,
      replyTo: settings.smtp_reply_to && isEmail(settings.smtp_reply_to)
        ? settings.smtp_reply_to : undefined,
      subject,
      content: text,
      attachments: [{
        filename: attachmentName,
        content: pdfBytes,
        contentType: "application/pdf",
        encoding: "binary",
      }],
    });
    await client.close();
    return json({ ok: true });
  } catch (e: any) {
    try { await client.close(); } catch { /* ignore */ }
    return json({
      error: "send_failed",
      message: e?.message ?? String(e),
    }, 502);
  }
});
