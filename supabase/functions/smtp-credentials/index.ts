// Save / delete / test the user's SMTP credentials.
// The plaintext password is sent ONCE from the client, encrypted server-side
// with AES-GCM, and stored in user_smtp_credentials. It is never returned.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { encryptPassword } from "../_shared/smtp-crypto.ts";

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

function getSmtpConfigError(host: string, port: number, secure: "ssl" | "starttls" | "none") {
  const normalizedHost = host.toLowerCase();
  if ([110, 143, 993, 995].includes(port)) {
    return "Der eingestellte Port ist für Posteingang/IMAP/POP3. Für den Versand bitte den SMTP-Ausgangsserver verwenden – bei domainFACTORY/df.eu meist sslout.df.eu mit Port 465 und SSL/TLS.";
  }
  if (normalizedHost.includes("df.eu") && port !== 465) {
    return "Für domainFACTORY/df.eu bitte sslout.df.eu mit Port 465 und SSL/TLS verwenden.";
  }
  if (port === 465 && secure !== "ssl") return "Port 465 benötigt SSL/TLS.";
  if (port === 587 && secure !== "starttls") return "Port 587 benötigt STARTTLS.";
  return null;
}

function smtpClientOptions(host: string, port: number, secure: "ssl" | "starttls" | "none", username: string, password: string) {
  return {
    debug: {
      allowUnsecure: secure === "none",
      noStartTLS: secure !== "starttls",
    },
    connection: {
      hostname: host,
      port,
      tls: secure === "ssl",
      auth: { username, password },
    },
  };
}

async function tryConnect(opts: {
  host: string; port: number; secure: "ssl" | "starttls" | "none";
  username: string; password: string; fromEmail: string;
}): Promise<void> {
  const client = new SMTPClient(smtpClientOptions(opts.host, opts.port, opts.secure, opts.username, opts.password));
  try {
    await client.send({
      from: opts.fromEmail,
      to: opts.fromEmail,
      subject: "MalerZeit E-Mail-Test",
      content: "Der E-Mail-Versand aus MalerZeit ist korrekt eingerichtet.",
    });
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "unauthenticated" }, 401);

  // Identify the caller via their JWT.
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthenticated" }, 401);
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = body?.action as string;

  if (action === "delete") {
    await admin.from("user_smtp_credentials").delete().eq("user_id", userId);
    await admin.from("user_settings").update({
      smtp_host: null, smtp_port: null, smtp_username: null, smtp_from_email: null,
    }).eq("user_id", userId);
    return json({ ok: true });
  }

  // save / test
  const host = String(body?.host ?? "").trim();
  const port = Number(body?.port ?? 0);
  const secure = (body?.secure ?? "ssl") as "ssl" | "starttls" | "none";
  const username = String(body?.username ?? "").trim();
  const fromEmail = String(body?.fromEmail ?? "").trim();
  const fromName = String(body?.fromName ?? "").trim();
  const replyTo = String(body?.replyTo ?? "").trim();
  const password = body?.password as string | undefined; // optional on update
  const subjectTemplate = body?.subjectTemplate as string | undefined;

  if (!host || !port || !username || !fromEmail) {
    return json({ error: "missing_fields" }, 400);
  }
  if (!["ssl", "starttls", "none"].includes(secure)) {
    return json({ error: "bad_secure" }, 400);
  }
  const configError = getSmtpConfigError(host, port, secure);
  if (configError) return json({ error: "smtp_config_invalid", message: configError }, 400);

  // Resolve password: use new one if given, else load existing encrypted one for tests.
  let effectivePassword = password;
  if (!effectivePassword) {
    const { data: existing } = await admin
      .from("user_smtp_credentials")
      .select("password_encrypted")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing?.password_encrypted) {
      return json({ error: "password_required" }, 400);
    }
    const { decryptPassword } = await import("../_shared/smtp-crypto.ts");
    effectivePassword = await decryptPassword(existing.password_encrypted);
  }

  if (action === "test") {
    try {
      await tryConnect({ host, port, secure, username, password: effectivePassword, fromEmail });
      return json({ ok: true });
    } catch (e: any) {
      return json({ error: "smtp_failed", message: e?.message ?? String(e) }, 400);
    }
  }

  if (action === "save") {
    if (password) {
      const enc = await encryptPassword(password);
      await admin.from("user_smtp_credentials").upsert({
        user_id: userId,
        password_encrypted: enc,
        updated_at: new Date().toISOString(),
      });
    }
    const settingsPatch: Record<string, unknown> = {
      smtp_host: host,
      smtp_port: port,
      smtp_secure: secure,
      smtp_username: username,
      smtp_from_email: fromEmail,
      smtp_from_name: fromName || null,
      smtp_reply_to: replyTo || null,
    };
    if (typeof subjectTemplate === "string") {
      settingsPatch.email_subject_template = subjectTemplate;
    }
    const { error: upErr } = await admin.from("user_settings")
      .update(settingsPatch).eq("user_id", userId);
    if (upErr) return json({ error: "update_failed", message: upErr.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
