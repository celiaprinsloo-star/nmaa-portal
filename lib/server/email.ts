import "server-only";

import nodemailer from "nodemailer";

export type MailResult = {
  messageId: string | null;
};

export function messageToHtml(message: string) {
  return message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .split(/\r?\n/)
    .map((line) => (line ? `<p>${line}</p>` : "<br />"))
    .join("");
}

export function requireEmailConfig() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.EMAIL_FROM;

  if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
    return {
      config: null,
      error: "Email sending is not configured yet. Add SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM in Vercel.",
    };
  }

  return {
    config: {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpSecure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
      fromEmail,
    },
    error: null,
  };
}

export async function sendPortalEmail({
  bcc,
  html,
  replyTo,
  subject,
  text,
}: {
  bcc: string[];
  html: string;
  replyTo: string;
  subject: string;
  text: string;
}): Promise<{ result: MailResult | null; error: string | null }> {
  const { config, error } = requireEmailConfig();

  if (!config) {
    return { result: null, error };
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  });

  const sendResult = await transporter
    .sendMail({
      from: config.fromEmail,
      to: config.fromEmail,
      bcc,
      replyTo,
      subject,
      text,
      html,
    })
    .catch((mailError: Error) => ({ error: mailError }));

  if ("error" in sendResult) {
    return { result: null, error: sendResult.error.message || "Email server rejected the message." };
  }

  return { result: { messageId: sendResult.messageId ?? null }, error: null };
}
