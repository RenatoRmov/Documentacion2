import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  groupAlertsByVehicle,
  sendAllEmails,
  sendWhatsApp,
  type ContactInfo,
} from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { fleet, settings, test } = req.body ?? {};
  if (!fleet || !settings) return res.status(400).json({ error: 'Missing fleet or settings' });

  const proto  = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host   = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || '';
  const appUrl = `${proto}://${host}`.replace(/\/$/, '');

  const contact: ContactInfo = {
    companyName:     settings.companyName     ?? 'RadioMovil',
    adminName:       settings.adminName       ?? '',
    adminTitle:      settings.adminTitle      ?? '',
    contactEmail:    settings.contactEmail    ?? settings.email?.address ?? '',
    contactWhatsApp: settings.contactWhatsApp ?? '',
    appUrl,
  };

  const groups = groupAlertsByVehicle(
    fleet as Record<string, unknown>[],
    settings.priorityDocs  ?? [],
    settings.daysInAdvance ?? [30],
    settings.includeMissing ?? true,
  );

  const errors: string[] = [];
  let emailsSent = 0, emailsSkipped = 0, waSent = false;

  if (settings.email?.enabled) {
    const hasGmail  = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
    const hasResend = !!process.env.RESEND_API_KEY;
    if (!hasGmail && !hasResend) {
      errors.push('Email: configura GMAIL_USER + GMAIL_APP_PASSWORD (recomendado) o RESEND_API_KEY en Vercel.');
    } else {
      const adminAddr = settings.email.address?.trim() || null;
      // sendAllEmails opens ONE SMTP connection for all sends (conductores + admin CC)
      const result = await sendAllEmails(
        test ? [] : groups,   // test mode: skip conductor emails, only send admin summary
        adminAddr,
        test,
        contact,
      );
      emailsSent    += result.sent;
      emailsSkipped += result.skipped;
      errors.push(...result.errors);
      if (test && result.errors.length === 0 && adminAddr) emailsSent = 1;
    }
  }

  if (settings.whatsapp?.enabled && settings.whatsapp?.number && settings.whatsapp?.apiKey) {
    try {
      await sendWhatsApp(settings.whatsapp.number, settings.whatsapp.apiKey, groups, !!test, contact);
      waSent = true;
    } catch (e: unknown) {
      errors.push(`WhatsApp: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const totalAlerts = groups.reduce((s, g) => s + g.expired.length + g.upcoming.length + g.missing.length, 0);
  return res.status(200).json({ sent: emailsSent + (waSent ? 1 : 0), alerts: totalAlerts, vehicles: groups.length, emailsSent, emailsSkipped, errors });
}
