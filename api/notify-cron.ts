// Cron automático diario — se ejecuta a las 08:00 AM hora Chile (11:00 UTC)
// Requiere: datos de flota en Supabase + variables de entorno en Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildAlerts, sendEmail, sendWhatsApp } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron envía este header para autenticar
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase no configurado' });
  }

  // Leer flota activa desde Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: fleet, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status_operativo', 'Activo');

  if (error) return res.status(500).json({ error: `Supabase: ${error.message}` });
  if (!fleet?.length) return res.status(200).json({ message: 'Sin vehículos activos' });

  // Configuración desde variables de entorno de Vercel
  const email       = process.env.CRON_NOTIFY_EMAIL ?? '';
  const waNumber    = process.env.CRON_WA_NUMBER ?? '';
  const waApiKey    = process.env.CRON_WA_APIKEY ?? '';
  const resendKey   = process.env.RESEND_API_KEY ?? '';

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

  const alerts = buildAlerts(fleet as Record<string, string>[], priorityDocs, daysInAdvance);

  const errors: string[] = [];
  let sent = 0;

  if (resendKey && email) {
    try {
      await sendEmail(resendKey, email, alerts, false);
      sent++;
    } catch (e: unknown) {
      errors.push(`Email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (waNumber && waApiKey) {
    try {
      await sendWhatsApp(waNumber, waApiKey, alerts, false);
      sent++;
    } catch (e: unknown) {
      errors.push(`WhatsApp: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return res.status(200).json({ sent, alerts: alerts.length, errors });
}
