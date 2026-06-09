import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildAlerts, sendEmail, sendWhatsApp } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fleet, settings, test } = req.body ?? {};
  if (!fleet || !settings) return res.status(400).json({ error: 'Missing fleet or settings' });

  const alerts = buildAlerts(fleet, settings.priorityDocs ?? [], settings.daysInAdvance ?? [30]);

  const errors: string[] = [];
  let sent = 0;

  if (settings.email?.enabled && settings.email?.address) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      errors.push('Email: variable RESEND_API_KEY no configurada en Vercel');
    } else {
      try {
        await sendEmail(key, settings.email.address, alerts, !!test);
        sent++;
      } catch (e: unknown) {
        errors.push(`Email: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (settings.whatsapp?.enabled && settings.whatsapp?.number && settings.whatsapp?.apiKey) {
    try {
      await sendWhatsApp(settings.whatsapp.number, settings.whatsapp.apiKey, alerts, !!test);
      sent++;
    } catch (e: unknown) {
      errors.push(`WhatsApp: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return res.status(200).json({ sent, alerts: alerts.length, errors });
}
