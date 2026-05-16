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