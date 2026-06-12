// Diagnostic endpoint — returns system state without sending any emails.
// Used by the Automatizaciones UI to show which conductors have emails configured
// and which email service is active.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { groupAlertsByVehicle } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { fleet, settings } = req.body ?? {};
  if (!fleet || !settings) return res.status(400).json({ error: 'Missing fleet or settings' });

  const hasGmail  = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  const hasResend = !!process.env.RESEND_API_KEY;
  const emailService = hasGmail ? 'gmail' : hasResend ? 'resend' : 'none';
  const gmailUser = process.env.GMAIL_USER?.trim() ?? null;

  const groups = groupAlertsByVehicle(
    fleet as Record<string, unknown>[],
    settings.priorityDocs  ?? [],
    settings.daysInAdvance ?? [30],
    settings.includeMissing ?? true,
  );

  const conductorEmails = groups.map(g => ({
    movil:  g.vehicleId,
    email:  g.email ?? null,
    nombre: g.conductor,
  }));

  // Check Gmail connection if configured (no email sent)
  let gmailStatus: string | null = null;
  if (hasGmail) {
    try {
      const nm = await import('nodemailer');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mailer: any = (nm as any).default ?? nm;
      const transport = mailer.createTransport({
        host:             'smtp.gmail.com',
        port:             587,
        secure:           false,
        requireTLS:       true,
        auth:             { user: gmailUser, pass: process.env.GMAIL_APP_PASSWORD?.trim() },
        connectionTimeout: 6000,
        greetingTimeout:   4000,
        socketTimeout:     6000,
      });
      await transport.verify();
      transport.close();
      gmailStatus = 'ok';
    } catch (e: unknown) {
      gmailStatus = e instanceof Error ? e.message : String(e);
    }
  }

  return res.status(200).json({
    emailService,
    gmailUser: gmailUser ?? null,
    gmailStatus,
    vehicles: groups.length,
    conductorEmails,
    adminEmail: settings.email?.address ?? null,
  });
}
