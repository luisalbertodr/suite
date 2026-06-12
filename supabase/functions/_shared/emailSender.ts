import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';
import { Resend } from 'https://esm.sh/resend@2.0.0';

export type OutgoingEmail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Uint8Array;
    contentType?: string;
  }>;
};

export type LoadedEmailConfig = {
  provider: 'smtp' | 'resend';
  from: string;
  fromName: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  resendApiKey?: string;
};

function settingMap(rows: Array<{ setting_key: string; setting_value: string | null }> | null) {
  const map = new Map<string, string>();
  for (const row of rows ?? []) {
    if (row.setting_value != null && row.setting_value !== '') {
      map.set(row.setting_key, row.setting_value);
    }
  }
  return map;
}

export async function loadEmailConfig(
  admin: SupabaseClient,
  companyId: string,
): Promise<LoadedEmailConfig | null> {
  const { data: settings, error } = await admin
    .from('system_settings')
    .select('setting_key, setting_value')
    .eq('company_id', companyId)
    .in('setting_key', [
      'email_from',
      'email_from_name',
      'email_provider',
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_password',
      'resend_api_key',
    ]);

  if (error) throw error;

  const s = settingMap(settings);
  const from =
    s.get('email_from') ||
    Deno.env.get('EMAIL_FROM') ||
    'info@lipoout.com';
  const fromName =
    s.get('email_from_name') ||
    Deno.env.get('EMAIL_FROM_NAME') ||
    'Lipoout';

  const smtpUser = s.get('smtp_user') || Deno.env.get('SMTP_USER') || '';
  const smtpPass = (s.get('smtp_password') || Deno.env.get('SMTP_PASSWORD') || '').replace(/\s/g, '');
  const provider = s.get('email_provider') || (smtpUser && smtpPass ? 'smtp' : '');

  if (provider === 'smtp' || (smtpUser && smtpPass)) {
    return {
      provider: 'smtp',
      from,
      fromName,
      smtp: {
        host: s.get('smtp_host') || Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
        port: Number(s.get('smtp_port') || Deno.env.get('SMTP_PORT') || '587'),
        user: smtpUser,
        pass: smtpPass,
      },
    };
  }

  const resendApiKey = s.get('resend_api_key');
  if (resendApiKey) {
    return { provider: 'resend', from, fromName, resendApiKey };
  }

  return null;
}

function formatFrom(cfg: LoadedEmailConfig): string {
  if (cfg.from.includes('<')) return cfg.from;
  return `${cfg.fromName} <${cfg.from}>`;
}

export async function sendOutgoingEmail(
  cfg: LoadedEmailConfig,
  mail: OutgoingEmail,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const toList = Array.isArray(mail.to) ? mail.to : [mail.to];

  if (cfg.provider === 'smtp' && cfg.smtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.smtp.host,
        port: cfg.smtp.port,
        secure: cfg.smtp.port === 465,
        auth: {
          user: cfg.smtp.user,
          pass: cfg.smtp.pass,
        },
      });

      const info = await transporter.sendMail({
        from: formatFrom(cfg),
        to: toList.join(', '),
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: (mail.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType ?? 'application/octet-stream',
        })),
      });

      return { ok: true, messageId: info.messageId ?? undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (cfg.provider === 'resend' && cfg.resendApiKey) {
    try {
      const resend = new Resend(cfg.resendApiKey);
      const result = await resend.emails.send({
        from: formatFrom(cfg),
        to: toList,
        subject: mail.subject,
        html: mail.html,
        attachments: (mail.attachments ?? []).map((a) => ({
          filename: a.filename,
          content: Array.from(a.content),
        })),
      });
      if (result.error) return { ok: false, error: result.error.message };
      return { ok: true, messageId: result.data?.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return { ok: false, error: 'Proveedor de email no configurado' };
}
