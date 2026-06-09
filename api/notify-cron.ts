// Cron automático diario — 08:00 AM hora Chile (11:00 UTC)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { groupAlertsByVehicle, sendEmailsToVehicles, sendAdminEmail, sendWhatsApp } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase no configurado' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: fleet, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status_operativo', 'Activo');

  if (error) return res.status(500).json({ error: `Supabase: ${error.message}` });
  if (!fleet?.length) return res.status(200).json({ message: 'Sin vehículos activos' });

  const resendKey  = process.env.RESEND_API_KEY ?? '';
  const adminEmail = process.env.CRON_NOTIFY_EMAIL ?? '';
  const waNumber   = process.env.CRON_WA_NUMBER ?? '';
  const waApiKey   = process.env.CRON_WA_APIKEY ?? '';

  const priorityDocs = (process.env.CRON_PRIORITY_DOCS ?? [
    'vencimientoPermisoCirculacion',
    'vencimientoRevisionTecnica',
    'vencimientoSOAP',
    'vencimientoPadron',
    'vencimientoSeguroAccidentes',
    'vencimientoSeguroAsiento',
  ].join(',')).split(',').map(s => s.trim()).filter(Boolean);

  const daysInAdvance = (process.env.CRON_DAYS_ADVANCE ?? '15,30')
    .split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));

  // fleet from Supabase is snake_case — groupAlertsByVehicle handles both camelCase and snake_case
  const groups = groupAlertsByVehicle(
    fleet as Record<string, unknown>[],
    priorityDocs,
    daysInAdvance,
  );

  const errors: string[] = [];
  let emailsSent = 0;
  let emailsSkipped = 0;
  let waSent = false;

  if (resendKey) {
    const result = await sendEmailsToVehicles(resendKey, groups, false);
    emailsSent    += result.sent;
    emailsSkipped += result.skipped;
    errors.push(...result.errors);

    if (adminEmail && groups.length > 0) {
      try {
        await sendAdminEmail(resendKey, adminEmail, groups, false);
      } catch (e: unknown) {
        errors.push(`Admin CC: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (waNumber && waApiKey) {
    try {
      await sendWhatsApp(waNumber, waApiKey, groups, false);
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
