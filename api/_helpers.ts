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

export interface AlertItem { vehicleId: string; patente: string; doc: string; days: number }

export function getDaysUntil(dateStr: string): number | null {
  if (!dateStr || dateStr === 'No Aplica' || dateStr === 'Sin Información') return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

export function buildAlerts(
  fleet: Record<string, string>[],
  priorityDocs: string[],
  daysInAdvance: number[],
): AlertItem[] {
  if (!daysInAdvance.length || !priorityDocs.length) return [];
  const maxDays = Math.max(...daysInAdvance);
  const alerts: AlertItem[] = [];
  for (const v of fleet.filter(v => v.statusOperativo === 'Activo')) {
    for (const key of priorityDocs) {
      const days = getDaysUntil(v[key]);
      if (days !== null && days <= maxDays) {
        alerts.push({ vehicleId: v.id, patente: v.patente, doc: DOC_LABELS[key] ?? key, days });
      }
    }
  }
  return alerts.sort((a, b) => a.days - b.days);
}

export function buildEmailHtml(alerts: AlertItem[], test: boolean): string {
  const testBanner = test
    ? `<div style="background:#78350f;color:#fde68a;padding:8px 16px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:0;">⚠ MENSAJE DE PRUEBA — NO ES UNA ALERTA REAL</div>`
    : '';

  const rows = alerts.length === 0
    ? `<tr><td colspan="4" style="padding:24px;text-align:center;color:#52525b;font-size:12px;">Sin documentos por vencer con la configuración actual.</td></tr>`
    : alerts.map(a => {
        const color = a.days < 0 ? '#ef4444' : a.days <= 7 ? '#f97316' : '#eab308';
        const status = a.days < 0 ? `VENCIDO hace ${Math.abs(a.days)} días` : `Vence en ${a.days} días`;
        return `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;font-weight:700;">${a.vehicleId}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;">${a.patente}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;">${a.doc}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #27272a;font-size:12px;font-weight:700;color:${color};">${status}</td>
        </tr>`;
      }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px;background:#0f0f11;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;">
    <div style="height:3px;background:linear-gradient(90deg,#C29329,#8b5e00);border-radius:2px 2px 0 0;"></div>
    ${testBanner}
    <div style="background:#1B1F24;padding:32px;border-radius:0 0 12px 12px;border:1px solid rgba(255,255,255,0.06);">
      <div style="margin-bottom:24px;">
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:4px;">RadioMovil</h1>
        <p style="margin:0;font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:2px;">Alerta de Vencimiento Documental</p>
      </div>
      <p style="color:#a1a1aa;font-size:13px;margin-bottom:20px;">
        Se detectaron <strong style="color:#fff;">${alerts.length}</strong> documento(s) que requieren atención:
      </p>
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
        RadioMovil Fleet Manager — Sistema Automatizado de Alertas
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildWhatsAppText(alerts: AlertItem[], test: boolean): string {
  const prefix = test ? '[PRUEBA] ' : '';
  if (alerts.length === 0) {
    return `${prefix}✅ *RadioMovil — Sin alertas*\n\nTodos los documentos monitoreados están al día.`;
  }
  const lines = alerts.slice(0, 12).map(a => {
    const e = a.days < 0 ? '🔴' : a.days <= 7 ? '🟠' : '🟡';
    const s = a.days < 0 ? `VENCIDO (hace ${Math.abs(a.days)}d)` : `vence en ${a.days} días`;
    return `${e} *${a.vehicleId}* — ${a.doc}: ${s}`;
  });
  const extra = alerts.length > 12 ? `\n_...y ${alerts.length - 12} más_` : '';
  return `${prefix}🚨 *RadioMovil — Alertas Documentales*\n\n${lines.join('\n')}${extra}\n\n_Total: ${alerts.length} documento(s) por gestionar_`;
}

export async function sendEmail(apiKey: string, to: string, alerts: AlertItem[], test: boolean): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const subject = test
    ? '[PRUEBA] Alertas de Vencimiento — RadioMovil'
    : `🚨 ${alerts.length} Documento(s) por Vencer — RadioMovil`;
  await resend.emails.send({
    from: 'RadioMovil Alertas <onboarding@resend.dev>',
    to,
    subject,
    html: buildEmailHtml(alerts, test),
  });
}

export async function sendWhatsApp(number: string, apiKey: string, alerts: AlertItem[], test: boolean): Promise<void> {
  const text = buildWhatsAppText(alerts, test);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${number}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`CallMeBot ${r.status}: ${body.slice(0, 120)}`);
  }
}
