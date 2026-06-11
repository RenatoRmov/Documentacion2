import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  groupAlertsByVehicle,
  sendEmailsToVehicles,
  sendAdminEmail,
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
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      errors.push('Email: variable RESEND_API_KEY no configurada en Vercel');
    } else if (test) {
      // Test mode: admin summary only to the configured CC address
      const adminAddr = settings.email.address?.trim();
      if (!adminAddr) {
        errors.push('Prueba: configura el campo "Copia al administrador" con tu correo para recibir el test.');
      } else {
        try {
          await sendAdminEmail(key, adminAddr, groups, true, contact);
          emailsSent++;
        } catch (e: unknown) {
          errors.push(`Email prueba: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      // Live: one personalized email per conductor
      const result = await sendEmailsToVehicles(key, groups, false, contact);
      emailsSent    += result.sent;
      emailsSkipped += result.skipped;
      errors.push(...result.errors);

      // Admin CC summary
      if (settings.email.address?.trim() && groups.length > 0) {
        try {
          await sendAdminEmail(key, settings.email.address.trim(), groups, false, contact);
        } catch (e: unknown) {
          errors.push(`Email admin CC: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
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
