// Save / delete / test the user's SMTP credentials.
// The plaintext password is sent ONCE from the client, encrypted server-side
// with AES-GCM, and stored in user_smtp_credentials. It is never returned.

import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptPassword, encryptPassword } from "../_shared/smtp-crypto.ts";
import { createSmtpDiagnostic, getSmtpConfigError, sendViaSmtp } from "../_shared/smtp-transport.ts";

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

async function tryConnect(opts: {
  host: string; port: number; secure: "ssl" | "starttls" | "none";
  username: string; password: string; fromEmail: string;
}): Promise<void> {
  await sendViaSmtp(opts, {
    from: opts.fromEmail,
    to: opts.fromEmail,
    subject: "MalerZeit E-Mail-Test",
    content: "Der E-Mail-Versand aus MalerZeit ist korrekt eingerichtet.",
  });
}

async function loadExistingPassword(admin: any, userId: string): Promise<string | null> {
  const { data: existing } = await admin
    .from("user_smtp_credentials")
    .select("password_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing?.password_encrypted) return null;
  return decryptPassword(existing.password_encrypted);
}

async function persistSettings(admin: any, userId: string, patch: Record<string, unknown>, password?: string) {
  const now = new Date().toISOString();
  if (password) {
    const enc = await encryptPassword(password);
    await admin.from("user_smtp_credentials").upsert({
      user_id: userId,
      password_encrypted: enc,
      updated_at: now,
    });
  }
  return admin.from("user_settings").upsert({ user_id: userId, ...patch, updated_at: now }, { onConflict: "user_id" });
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

  // Resolve password once and use this exact value for test + optional persistence.
  let effectivePassword = password;
  if (!effectivePassword) {
    effectivePassword = await loadExistingPassword(admin, userId) ?? undefined;
    if (!effectivePassword) return json({ error: "password_required" }, 400);
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

  if (action === "test" || action === "save" || action === "save_and_test") {
    const traceId = crypto.randomUUID();
    try {
      await tryConnect({ host, port, secure, username, password: effectivePassword, fromEmail });
      if (action !== "test") {
        const { error: upErr } = await persistSettings(admin, userId, settingsPatch, password);
        if (upErr) return json({ error: "update_failed", message: upErr.message }, 500);
      }
      const { data: savedSettings } = await admin
        .from("user_settings")
        .select("user_id, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      const { data: savedCred } = await admin
        .from("user_smtp_credentials")
        .select("user_id, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      const diagnostic = await createSmtpDiagnostic({
        admin,
        userId,
        traceId,
        phase: "smtp_test_success",
        smtpHost: host,
        smtpPort: port,
        secure,
        username,
        password: effectivePassword,
        fromAddress: fromEmail,
        fromHeader: fromEmail,
        recipient: fromEmail,
        settingsFound: Boolean(savedSettings),
        credentialsFound: Boolean(savedCred),
        settingsUpdatedAt: savedSettings?.updated_at ?? null,
        credentialsUpdatedAt: savedCred?.updated_at ?? null,
        settingsUserId: savedSettings?.user_id ?? userId,
        credentialsUserId: savedCred?.user_id ?? userId,
        credentialSource: password ? "request" : "stored",
      });
      console.log("smtp test successful", diagnostic);
      return json({ ok: true });
    } catch (e: any) {
      await createSmtpDiagnostic({
        admin,
        userId,
        traceId,
        phase: "smtp_test_failed",
        smtpHost: host,
        smtpPort: port,
        secure,
        username,
        password: effectivePassword,
        fromAddress: fromEmail,
        fromHeader: fromEmail,
        recipient: fromEmail,
        settingsFound: true,
        credentialsFound: Boolean(effectivePassword),
        credentialSource: password ? "request" : "stored",
        errorMessage: e?.message ?? String(e),
      });
      return json({ ok: false, error: "smtp_failed", message: e?.message ?? String(e) }, 200);
    }
  }

  return json({ error: "unknown_action" }, 400);
});
