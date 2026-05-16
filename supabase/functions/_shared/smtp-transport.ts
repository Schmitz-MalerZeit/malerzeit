import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export type SmtpSecure = "ssl" | "starttls" | "none";

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: SmtpSecure;
  username: string;
  password: string;
}

export function getSmtpConfigError(host: string, port: number, secure: SmtpSecure) {
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

function smtpClientOptions(config: SmtpTransportConfig) {
  return {
    debug: {
      allowUnsecure: config.secure === "none",
      noStartTLS: config.secure !== "starttls",
    },
    connection: {
      hostname: config.host,
      port: config.port,
      tls: config.secure === "ssl",
      auth: { username: config.username, password: config.password },
    },
  };
}

export async function sendViaSmtp(config: SmtpTransportConfig, message: Parameters<SMTPClient["send"]>[0]) {
  const client = new SMTPClient(smtpClientOptions(config));
  try {
    await client.send(message);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

function b64ToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function passwordFingerprint(password: string): Promise<string> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const data = new TextEncoder().encode(`smtp-diagnostic::${serviceKey}::${password}`);
  return b64ToHex(await crypto.subtle.digest("SHA-256", data)).slice(0, 24);
}

export async function createSmtpDiagnostic(config: {
  admin: any;
  userId: string;
  traceId: string;
  phase: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  secure?: SmtpSecure | string | null;
  username?: string | null;
  password?: string | null;
  fromAddress?: string | null;
  fromHeader?: string | null;
  recipient?: string | null;
  settingsFound?: boolean;
  credentialsFound?: boolean;
  settingsUpdatedAt?: string | null;
  credentialsUpdatedAt?: string | null;
  settingsUserId?: string | null;
  credentialsUserId?: string | null;
  credentialSource?: string | null;
  errorMessage?: string | null;
}) {
  const password = config.password ?? "";
  const row = {
    user_id: config.userId,
    trace_id: config.traceId,
    phase: config.phase,
    smtp_host: config.smtpHost ?? null,
    smtp_port: config.smtpPort ?? null,
    smtp_secure: config.secure ?? null,
    auth_user_present: Boolean(config.username),
    auth_pass_present: password.length > 0,
    auth_pass_length: password.length,
    auth_pass_fingerprint: password ? await passwordFingerprint(password) : null,
    password_has_outer_whitespace: password.length > 0 && password !== password.trim(),
    password_contains_newline: /[\r\n]/.test(password),
    from_address: config.fromAddress ?? null,
    from_header: config.fromHeader ?? null,
    recipient: config.recipient ?? null,
    settings_found: Boolean(config.settingsFound),
    credentials_found: Boolean(config.credentialsFound),
    settings_updated_at: config.settingsUpdatedAt ?? null,
    credentials_updated_at: config.credentialsUpdatedAt ?? null,
    settings_user_id: config.settingsUserId ?? null,
    credentials_user_id: config.credentialsUserId ?? null,
    credential_source: config.credentialSource ?? null,
    error_message: config.errorMessage ?? null,
  };
  const { error } = await config.admin.from("smtp_delivery_diagnostics").insert(row);
  if (error) console.error("smtp diagnostic insert failed", { message: error.message, traceId: config.traceId, phase: config.phase });
  return row;
}