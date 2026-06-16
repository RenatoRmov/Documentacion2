// Cron diario a las 11pm UTC (7–8pm hora Chile) — resumen de actividad del portal al encargado
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendSingleEmail } from './_helpers.js';

interface ActivityRow {
  id: string;
  conductor_rut: string;
  conductor_nombre: string;
  movil: string;
  patente: string | null;
  field_label: string;
  updated_at: string;
}

interface ConductorGroup {
  nombre: string;
  movil: string;
  entries: Array<{ field_label: string; patente: string | null; updated_at: string }>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago',
  });
}

function buildDigestHtml(
  groups: Record<string, ConductorGroup>,
  date: string,
  company: string,
): string {
  const conductorCount = Object.keys(groups).length;
  const totalCount = Object.values(groups).reduce((s, g) => s + g.entries.length, 0);

  const bodyRows = Object.entries(groups).map(([, g]) => {
    const entryRows = g.entries.map(e => `
      <tr>
        <td style="padding:7px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">
          ${e.patente ? `<span style="font-size:11px;color:#6b7280;font-style:italic;">${e.patente} — </span>` : ''}
          ${e.field_label}
        </td>
        <td style="padding:7px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#9ca3af;white-space:nowrap;">${formatTime(e.updated_at)}</td>
      </tr>`).join('');

    return `
      <tr>
        <td colspan="2" style="padding:10px 14px 6px;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top:2px solid #e5e7eb;">
          <span style="font-weight:900;font-size:13px;color:#111;">Móvil ${g.movil} — ${g.nombre}</span>
        </td>
      </tr>
      ${entryRows}`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#111418;padding:24px;border-bottom:3px solid #C29329;">
          <p style="margin:0;font-size:18px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:3px;">${company}</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Actividad en Portal del Conductor — ${date}</p>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#111;">
            ${conductorCount} conductor${conductorCount !== 1 ? 'es' : ''} actualizó su documentación hoy
          </p>
          <p style="margin:0;font-size:12px;color:#6b7280;">
            ${totalCount} campo${totalCount !== 1 ? 's' : ''} registrado${totalCount !== 1 ? 's' : ''} —
            Revisa el sistema para verificar que la información sea correcta.
          </p>
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Documento actualizado</th>
                <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Hora</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </td></tr>
        <tr><td style="padding:12px 24px;text-align:center;background:#f3f4f6;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">
            ${company} — Sistema de Gestión Documental
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Ventana de 30h para no perder actividad registrada cerca de medianoche
  const cutoff = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('portal_activity')
    .select('*')
    .eq('notified', false)
    .gte('updated_at', cutoff)
    .order('conductor_rut')
    .order('updated_at');

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) {
    return res.status(200).json({ message: 'Sin actividad del día', activities: 0 });
  }

  // Agrupar por conductor
  const groups: Record<string, ConductorGroup> = {};
  for (const row of data as ActivityRow[]) {
    if (!groups[row.conductor_rut]) {
      groups[row.conductor_rut] = {
        nombre: row.conductor_nombre,
        movil: row.movil,
        entries: [],
      };
    }
    groups[row.conductor_rut].entries.push({
      field_label: row.field_label,
      patente: row.patente,
      updated_at: row.updated_at,
    });
  }

  const ids = (data as ActivityRow[]).map(r => r.id);
  const company = process.env.CRON_COMPANY_NAME ?? 'RadioMovil';
  const adminEmail = process.env.CRON_NOTIFY_EMAIL;

  if (adminEmail) {
    const date = new Date().toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long',
      timeZone: 'America/Santiago',
    });
    const conductorCount = Object.keys(groups).length;
    const subject = `Portal: ${conductorCount} conductor${conductorCount !== 1 ? 'es' : ''} actualizó documentación — ${new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}`;
    const html = buildDigestHtml(groups, date, company);
    try {
      await sendSingleEmail(adminEmail, subject, { html }, company);
    } catch (e: unknown) {
      console.error('Error enviando digest:', e instanceof Error ? e.message : e);
    }
  }

  // Marcar como notificados aunque no haya email configurado
  await supabase.from('portal_activity').update({ notified: true }).in('id', ids);

  return res.status(200).json({
    conductors: Object.keys(groups).length,
    activities: data.length,
    emailSent: !!adminEmail,
  });
}
