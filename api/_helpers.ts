// Shared logic for notify API routes

export const DOC_LABELS: Record<string, string> = {
  vencimientoPadron:              'Padrón',
  vencimientoPermisoCirculacion:  'Permiso de Circulación',
  vencimientoRevisionTecnica:     'Revisión Técnica',
  vencimientoSOAP:                'SOAP',
  vencimientoControlTaximetro:    'Control Taxímetro',
  vencimientoSeguroAccidentes:    'Seguro Accidentes',
  vencimientoSeguroAsiento:       'Seguro Asiento',
  vencimientoSeguroVidaConductor: 'Seguro Vida Conductor',
  vigenciaLicenciaHasta:          'Licencia Conductor',
  vigenciaCarnetHasta:            'Carnet Conductor',
};

// camelCase doc keys → Supabase snake_case columns
const DOC_TO_SNAKE: Record<string, string> = {
  vencimientoPadron:              'vencimiento_padron',
  vencimientoPermisoCirculacion:  'vencimiento_permiso_circulacion',
  vencimientoRevisionTecnica:     'vencimiento_revision_tecnica',
  vencimientoSOAP:                'vencimiento_soap',
  vencimientoControlTaximetro:    'vencimiento_control_taximetro',
  vencimientoSeguroAccidentes:    'vencimiento_seguro_accidentes',
  vencimientoSeguroAsiento:       'vencimiento_seguro_asiento',
  vencimientoSeguroVidaConductor: 'vencimiento_seguro_vida_conductor',
  vigenciaLicenciaHasta:          'vigencia_licencia_hasta',
  vigenciaCarnetHasta:            'vigencia_carnet_hasta',
};

export interface DocAlert {
  doc:   string;
  label: string;
  days:  number;
}

export interface VehicleAlertGroup {
  vehicleId: string;
  patente:   string;
  conductor: string;
  email:     string | null;
  celular:   string | null;
  alerts:    DocAlert[];
}

export function getDaysUntil(dateStr: string): number | null {
  if (!dateStr || dateStr === 'No Aplica' || dateStr === 'Sin Información') return null;
  // Accept both YYYY-MM-DD (Supabase) and DD-MM-YYYY (frontend Vehicle type)
  let iso = dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    iso = `${y}-${m}-${d}`;
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000);
}

// Works with both camelCase (frontend Vehicle) and snake_case (Supabase raw row)
export function groupAlertsByVehicle(
  fleet: Record<string, unknown>[],
  priorityDocs: string[],
  daysInAdvance: number[],
): VehicleAlertGroup[] {
  if (!daysInAdvance.length || !priorityDocs.length) return [];
  const maxDays = Math.max(...daysInAdvance);
  const groups: VehicleAlertGroup[] = [];

  for (const v of fleet) {
    const statusOp = (v.statusOperativo ?? v.status_operativo ?? '') as string;
    if (statusOp !== 'Activo') continue;

    const docAlerts: DocAlert[] = [];
    for (const key of priorityDocs) {
      const dateStr = (v[key] ?? v[DOC_TO_SNAKE[key] ?? key] ?? '') as string;
      const days = getDaysUntil(dateStr);
      if (days !== null && days <= maxDays) {
        docAlerts.push({ doc: key, label: DOC_LABELS[key] ?? key, days });
      }
    }
    if (docAlerts.length === 0) continue;

    groups.push({
      vehicleId: (v.id ?? v.numero_movil ?? '') as string,
      patente:   (v.patente ?? '') as string,
      conductor: (v.nombreConductor ?? v.nombre_conductor ?? 'Sin nombre') as string,
      email:     (v.email as string) || null,
      celular:   (v.celular as string) || null,
      alerts:    docAlerts.sort((a, b) => a.days - b.days),
    });
  }

  return groups;
}

// Personalized HTML email for one conductor
export function buildEmailHtmlForVehicle(g: VehicleAlertGroup, test: boolean): string {
  const testBanner = test
    ? `<div style="background:#78350f;color:#fde68a;padding:8px 16px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:0;">⚠ MENSAJE DE PRUEBA</div>`
    : '';

  const rows = g.alerts.map(a => {
    const color = a.days < 0 ? '#ef4444' : a.days <= 7 ? '#f97316' : '#eab308';
    const status = a.days < 0
      ? `VENCIDO hace ${Math.abs(a.days)} días`
      : a.days === 0 ? 'VENCE HOY'
      : `Vence en ${a.days} días`;
    return `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:13px;color:#d4d4d8;">${a.label}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:13px;font-weight:700;color:${color};">${status}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px;background:#0f0f11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="height:3px;background:linear-gradient(90deg,#C29329,#8b5e00);border-radius:2px 2px 0 0;"></div>
    ${testBanner}
    <div style="background:#1B1F24;padding:32px;border-radius:0 0 12px 12px;border:1px solid rgba(255,255,255,0.06);">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:4px;">RadioMovil</h1>
      <p style="margin:0 0 24px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">Alerta de Vencimiento Documental</p>
      <p style="color:#a1a1aa;font-size:14px;margin-bottom:8px;">Estimado/a <strong style="color:#fff;">${g.conductor}</strong>,</p>
      <p style="color:#a1a1aa;font-size:13px;margin-bottom:20px;">
        El vehículo <strong style="color:#fff;">Móvil ${g.vehicleId}</strong>
        (patente <strong style="color:#fff;">${g.patente}</strong>)
        tiene <strong style="color:#fff;">${g.alerts.length}</strong> documento(s) que requieren atención:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#0a0c0e;">
            <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#52525b;font-weight:700;">Documento</th>
            <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#52525b;font-weight:700;">Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;color:#71717a;font-size:12px;">
        Por favor regularice estos documentos a la brevedad.<br>
        Ante cualquier consulta, contáctese con la administración.
      </p>
      <p style="margin-top:28px;font-size:9px;color:#3f3f46;text-align:center;text-transform:uppercase;letter-spacing:2px;">
        RadioMovil Fleet Manager — Sistema Automatizado de Alertas
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Admin summary HTML (all vehicles in one email for CC)
export function buildAdminEmailHtml(groups: VehicleAlertGroup[], test: boolean): string {
  const testBanner = test
    ? `<div style="background:#78350f;color:#fde68a;padding:8px 16px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:0;">⚠ MENSAJE DE PRUEBA — NO ES UNA ALERTA REAL</div>`
    : '';
  const totalAlerts = groups.reduce((sum, g) => sum + g.alerts.length, 0);

  const rows = groups.length === 0
    ? `<tr><td colspan="4" style="padding:24px;text-align:center;color:#52525b;font-size:12px;">Sin documentos por vencer.</td></tr>`
    : groups.flatMap(g => g.alerts.map(a => {
        const color = a.days < 0 ? '#ef4444' : a.days <= 7 ? '#f97316' : '#eab308';
        const status = a.days < 0 ? `VENCIDO hace ${Math.abs(a.days)} días` : `Vence en ${a.days} días`;
        return `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;font-weight:700;color:#ffffff;">${g.vehicleId}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;color:#d4d4d8;">${g.patente}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;color:#d4d4d8;">${a.label}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;font-weight:700;color:${color};">${status}</td>
        </tr>`;
      })).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px;background:#0f0f11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;">
    <div style="height:3px;background:linear-gradient(90deg,#C29329,#8b5e00);border-radius:2px 2px 0 0;"></div>
    ${testBanner}
    <div style="background:#1B1F24;padding:32px;border-radius:0 0 12px 12px;border:1px solid rgba(255,255,255,0.06);">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:4px;">RadioMovil</h1>
      <p style="margin:0 0 4px;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">Resumen de Alertas — Administración</p>
      <p style="margin:0 0 24px;font-size:11px;color:#71717a;">${groups.length} vehículo(s) con ${totalAlerts} documento(s) por gestionar</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#0a0c0e;">
            <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#52525b;font-weight:700;">Móvil</th>
            <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#52525b;font-weight:700;">Patente</th>
            <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#52525b;font-weight:700;">Documento</th>
            <th style="padding:8px 14px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#52525b;font-weight:700;">Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:28px;font-size:9px;color:#3f3f46;text-align:center;text-transform:uppercase;letter-spacing:2px;">
        RadioMovil Fleet Manager — Resumen Administrativo
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Admin WhatsApp summary
export function buildAdminWhatsAppText(groups: VehicleAlertGroup[], test: boolean): string {
  const prefix = test ? '[PRUEBA] ' : '';
  const totalAlerts = groups.reduce((sum, g) => sum + g.alerts.length, 0);
  if (totalAlerts === 0) {
    return `${prefix}✅ *RadioMovil — Sin alertas*\nTodos los documentos monitoreados están al día.`;
  }
  const lines = groups.slice(0, 10).flatMap(g =>
    g.alerts.slice(0, 2).map(a => {
      const e = a.days < 0 ? '🔴' : a.days <= 7 ? '🟠' : '🟡';
      return `${e} *${g.vehicleId}* — ${a.label}: ${a.days < 0 ? 'VENCIDO' : `${a.days}d`}`;
    })
  );
  const shown = lines.length;
  const extra = totalAlerts > shown ? `\n_...y más_` : '';
  return `${prefix}🚨 *RadioMovil — Resumen Alertas*\n${groups.length} vehículo(s) con documentos por gestionar\n\n${lines.join('\n')}${extra}\n\n_Total: ${totalAlerts} documento(s)_`;
}

// Send one personalized email per vehicle conductor
export async function sendEmailsToVehicles(
  apiKey: string,
  groups: VehicleAlertGroup[],
  test: boolean,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  let sent = 0, skipped = 0;
  const errors: string[] = [];

  for (const g of groups) {
    if (!g.email) { skipped++; continue; }
    const subject = test
      ? `[PRUEBA] Alerta Documental — Móvil ${g.vehicleId}`
      : `🚨 Alerta: ${g.alerts.length} doc(s) por vencer — Móvil ${g.vehicleId}`;
    // Resend SDK v2+ returns { data, error } instead of throwing
    const { error } = await resend.emails.send({
      from: 'RadioMovil Alertas <onboarding@resend.dev>',
      to: g.email,
      subject,
      html: buildEmailHtmlForVehicle(g, test),
    });
    if (error) {
      errors.push(`Móvil ${g.vehicleId} (${g.email}): ${error.message}`);
    } else {
      sent++;
    }
  }
  return { sent, skipped, errors };
}

// Optional admin CC summary email
export async function sendAdminEmail(
  apiKey: string,
  to: string,
  groups: VehicleAlertGroup[],
  test: boolean,
): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const totalAlerts = groups.reduce((sum, g) => sum + g.alerts.length, 0);
  // Resend SDK v2+ returns { data, error } instead of throwing
  const { error } = await resend.emails.send({
    from: 'RadioMovil Alertas <onboarding@resend.dev>',
    to,
    subject: test
      ? '[PRUEBA] Resumen Alertas — RadioMovil'
      : `🚨 ${totalAlerts} Documento(s) por Vencer — Resumen Admin RadioMovil`,
    html: buildAdminEmailHtml(groups, test),
  });
  if (error) throw new Error(error.message);
}

// WhatsApp admin summary via CallMeBot
export async function sendWhatsApp(
  number: string,
  apiKey: string,
  groups: VehicleAlertGroup[],
  test: boolean,
): Promise<void> {
  const text = buildAdminWhatsAppText(groups, test);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${number}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`CallMeBot ${r.status}: ${body.slice(0, 120)}`);
  }
}
