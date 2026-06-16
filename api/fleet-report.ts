// Cron lunes y jueves a la 1pm UTC (~9-10am hora Chile) — resumen semanal del estado de la flota
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { groupAlertsByVehicle, sendSingleEmail, type VehicleAlertGroup } from './_helpers.js';

const PRIORITY_DOCS = [
  'vencimientoPermisoCirculacion',
  'vencimientoRevisionTecnica',
  'vencimientoSOAP',
  'vencimientoSeguroAsiento',
  'vencimientoControlTaximetro',
  'vigenciaCarnetHasta',
  'vigenciaLicenciaHasta',
];

function buildFleetReportHtml(
  totalActive: number,
  alertGroups: VehicleAlertGroup[],
  okCount: number,
  date: string,
  company: string,
  appUrl: string,
): string {
  const expiredVehicles  = alertGroups.filter(g => g.expired.length > 0);
  const upcomingVehicles = alertGroups.filter(g => g.expired.length === 0 && g.upcoming.length > 0);
  const missingVehicles  = alertGroups.filter(g => g.expired.length === 0 && g.upcoming.length === 0 && g.missing.length > 0);
  const healthPct = totalActive > 0 ? Math.round((okCount / totalActive) * 100) : 0;

  const vehicleRows = (groups: VehicleAlertGroup[], headerColor: string, headerText: string): string => {
    if (!groups.length) return '';
    const rows = groups.map(g => {
      const docParts = [
        ...g.expired.map(a  => `<span style="color:#dc2626;">🔴 ${a.label} (venció ${a.dateStr})</span>`),
        ...g.upcoming.map(a => `<span style="color:#d97706;">🟡 ${a.label} (en ${a.days}d)</span>`),
        ...g.missing.map(l  => `<span style="color:#9ca3af;">⚪ ${l}</span>`),
      ].join('<br>');
      return `<tr>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-weight:bold;color:#111;font-size:13px;">${g.vehicleId}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;">${g.patente}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;">${g.conductor}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:12px;line-height:1.8;">${docParts}</td>
      </tr>`;
    }).join('');

    return `
      <tr>
        <td colspan="4" style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top:2px solid #e5e7eb;
          font-size:11px;font-weight:bold;color:${headerColor};text-transform:uppercase;letter-spacing:1px;">
          ${headerText}
        </td>
      </tr>
      ${rows}`;
  };

  const allRows = [
    vehicleRows(expiredVehicles,  '#dc2626', `🔴 Documentos vencidos — ${expiredVehicles.length} vehículo${expiredVehicles.length !== 1 ? 's' : ''}`),
    vehicleRows(upcomingVehicles, '#d97706', `🟡 Por vencer próximamente — ${upcomingVehicles.length} vehículo${upcomingVehicles.length !== 1 ? 's' : ''}`),
    vehicleRows(missingVehicles,  '#6b7280', `⚪ Sin documentos registrados — ${missingVehicles.length} vehículo${missingVehicles.length !== 1 ? 's' : ''}`),
  ].join('');

  const tableBody = allRows
    ? allRows
    : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#16a34a;font-size:13px;font-weight:bold;">
         ✅ Toda la flota tiene documentos al día
       </td></tr>`;

  const portalBtn = appUrl
    ? `<tr><td style="padding:0 24px 24px;text-align:center;">
         <a href="${appUrl}" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;
           font-size:13px;font-weight:bold;padding:10px 22px;border-radius:6px;">
           Ir al sistema →
         </a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr><td style="background:#111418;padding:24px;border-bottom:3px solid #C29329;">
          <p style="margin:0;font-size:18px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:3px;">${company}</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Resumen Semanal de Flota — ${date}</p>
        </td></tr>

        <!-- KPIs -->
        <tr><td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:14px 8px;background:#f9fafb;border-radius:6px;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#111;">${totalActive}</p>
                <p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Activos</p>
              </td>
              <td style="width:8px;"></td>
              <td style="text-align:center;padding:14px 8px;background:#fef2f2;border-radius:6px;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#dc2626;">${expiredVehicles.length}</p>
                <p style="margin:4px 0 0;font-size:10px;color:#dc2626;text-transform:uppercase;letter-spacing:1px;">Vencidos</p>
              </td>
              <td style="width:8px;"></td>
              <td style="text-align:center;padding:14px 8px;background:#fffbeb;border-radius:6px;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#d97706;">${upcomingVehicles.length + missingVehicles.length}</p>
                <p style="margin:4px 0 0;font-size:10px;color:#d97706;text-transform:uppercase;letter-spacing:1px;">Por gestionar</p>
              </td>
              <td style="width:8px;"></td>
              <td style="text-align:center;padding:14px 8px;background:#f0fdf4;border-radius:6px;">
                <p style="margin:0;font-size:26px;font-weight:900;color:#16a34a;">${healthPct}%</p>
                <p style="margin:4px 0 0;font-size:10px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;">Al día</p>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Fleet table -->
        <tr><td style="padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Móvil</th>
                <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Patente</th>
                <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Conductor</th>
                <th style="padding:8px 14px;text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Estado documentos</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </td></tr>

        ${portalBtn}

        <tr><td style="padding:12px 24px;text-align:center;background:#f3f4f6;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">
            ${company} — Resumen automático semanal
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
  const { data: fleet, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('status_operativo', 'Activo');

  if (error) return res.status(500).json({ error: error.message });
  if (!fleet?.length) return res.status(200).json({ message: 'Sin vehículos activos' });

  const company    = process.env.CRON_COMPANY_NAME ?? 'RadioMovil';
  const adminEmail = process.env.CRON_NOTIFY_EMAIL;
  const appUrl     = (process.env.CRON_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')).replace(/\/$/, '');

  const alertGroups = groupAlertsByVehicle(
    fleet as Record<string, unknown>[],
    PRIORITY_DOCS,
    [15, 30],
    true,
  );

  const okCount = fleet.length - alertGroups.length;

  if (!adminEmail) {
    return res.status(200).json({ message: 'No admin email configured', fleet: fleet.length });
  }

  const date = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Santiago',
  });
  const subject = `Resumen semanal — ${fleet.length} vehículo${fleet.length !== 1 ? 's' : ''} activo${fleet.length !== 1 ? 's' : ''} — ${alertGroups.length} con alertas — ${new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}`;
  const html = buildFleetReportHtml(fleet.length, alertGroups, okCount, date, company, appUrl);

  try {
    await sendSingleEmail(adminEmail, subject, { html }, company);
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }

  return res.status(200).json({ fleet: fleet.length, alerts: alertGroups.length, ok: okCount, emailSent: true });
}
