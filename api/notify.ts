import type { VercelRequest, VercelResponse } from '@vercel/node';
import { groupAlertsByVehicle, sendEmailsToVehicles, sendAdminEmail, sendWhatsApp } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fleet, settings, test } = req.body ?? {};
  if (!fleet || !settings) return res.status(400).json({ error: 'Missing fleet or settings' });

  const groups = groupAlertsByVehicle(
    fleet as Record<string, unknown>[],
    settings.priorityDocs ?? [],
    settings.daysInAdvance ?? [30],
  );

  const errors: string[] = [];
  let emailsSent = 0;
  let emailsSkipped = 0;
  let waSent = false;

  if (settings.email?.enabled) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      errors.push('Email: variable RESEND_API_KEY no configurada en Vercel');
    } else {
      // One personalized email per conductor
      const result = await sendEmailsToVehicles(key, groups, !!test);
      emailsSent  += result.sent;
      emailsSkipped += result.skipped;
      errors.push(...result.errors);

      // Optional admin CC summary
      if (settings.email.address?.trim() && groups.length > 0) {
        try {
          await sendAdminEmail(key, settings.email.address.trim(), groups, !!test);
        } catch (e: unknown) {
          errors.push(`Email admin CC: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  if (settings.whatsapp?.enabled && settings.whatsapp?.number && settings.whatsapp?.apiKey) {
    try {
      await sendWhatsApp(settings.whatsapp.number, settings.whatsapp.apiKey, groups, !!test);
      waSent = true;
    } catch (e: unknown) {
      errors.push(`WhatsApp: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const totalAlerts = groups.reduce((sum, g) => sum + g.alerts.length, 0);
  return res.status(200).json({
    sent: emailsSent + (waSent ? 1 : 0),
    alerts: totalAlerts,
    vehicles: groups.length,
    emailsSent,
    emailsSkipped,
    errors,
  });
}
