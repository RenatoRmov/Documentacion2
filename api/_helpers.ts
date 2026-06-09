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
  label:   string;
  days:    number;
  dateStr: string; // formatted DD-MM-YYYY for display
}

export interface VehicleAlertGroup {
  vehicleId:    string;
  patente:      string;
  conductor:    string;
  rutConductor: string;
  email:        string | null;
  celular:      string | null;
  expired:      DocAlert[];  // days < 0
  upcoming:     DocAlert[];  // 0 <= days <= maxDays
  missing:      string[];    // doc labels with no date registered
}

export interface ContactInfo {
  companyName:     string;
  adminName:       string;
  adminTitle:      string;
  contactEmail:    string;
  contactWhatsApp: string;
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

// Always return DD-MM-YYYY for display
function toDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

// Works with both camelCase (frontend Vehicle) and snake_case (Supabase raw row)
export function groupAlertsByVehicle(
  fleet: Record<string, unknown>[],
  priorityDocs: string[],
  daysInAdvance: number[],
  includeMissing = true,
): VehicleAlertGroup[] {
  if (!priorityDocs.length) return [];
  const maxDays = daysInAdvance.length ? Math.max(...daysInAdvance) : 30;
  const groups: VehicleAlertGroup[] = [];

  for (const v of fleet) {
    const statusOp = (v.statusOperativo ?? v.status_operativo ?? '') as string;
    if (statusOp !== 'Activo') continue;

    const expired:  DocAlert[] = [];
    const upcoming: DocAlert[] = [];
    const missing:  string[]   = [];

    for (const key of priorityDocs) {
      const label   = DOC_LABELS[key] ?? key;
      const rawVal  = (v[key] ?? v[DOC_TO_SNAKE[key] ?? key] ?? '') as string;
      const trimmed = rawVal.trim().toLowerCase();

      // "No Aplica" → skip entirely (intentional)
      if (trimmed === 'no aplica') continue;

      // Empty, "Sin Información" → missing
      if (!rawVal.trim() || trimmed === 'sin información' || trimmed === 'sin informacion') {
        if (includeMissing) missing.push(label);
        continue;
      }

      const days = getDaysUntil(rawVal);
      if (days === null) {
        if (includeMissing) missing.push(label);
        continue;
      }

      const displayDate = toDisplayDate(rawVal);

      if (days < 0) {
        expired.push({ label, days, dateStr: displayDate });
      } else if (days <= maxDays) {
        upcoming.push({ label, days, dateStr: displayDate });
      }
    }

    if (expired.length === 0 && upcoming.length === 0 && missing.length === 0) continue;

    groups.push({
      vehicleId:    (v.id ?? v.numero_movil ?? '') as string,
      patente:      (v.patente ?? '') as string,
      conductor:    (v.nombreConductor ?? v.nombre_conductor ?? 'Sin nombre') as string,
      rutConductor: (v.rutConductor ?? v.rut_conductor ?? '') as string,
      email:        (v.email as string) || null,
      celular:      (v.celular as string) || null,
      expired,
      upcoming,
      missing,
    });
  }

  return groups;
}

// ─── Email per conductor ──────────────────────────────────────────────────────

export function buildEmailHtmlForVehicle(
  g: VehicleAlertGroup,
  test: boolean,
  contact: ContactInfo,
): string {
  const company = contact.companyName || 'RadioMovil';
  const testBanner = test
    ? `<tr><td style="background:#78350f;color:#fde68a;padding:8px 20px;font-size:11px;font-weight:bold;text-align:center;letter-spacing:1px;">⚠ MENSAJE DE PRUEBA — NO ES UNA ALERTA REAL</td></tr>`
    : '';

  const docRow = (icon: string, color: string, label: string, detail: string) =>
    `<li style="margin:6px 0;padding:6px 0;border-bottom:1px solid #f0f0f0;">
      <span style="color:${color};font-weight:bold;">${icon} ${label}</span>
      <span style="color:#555;font-size:12px;"> — ${detail}</span>
    </li>`;

  const expiredSection = g.expired.length > 0 ? `
    <tr><td style="padding:16px 24px 4px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#dc2626;">Documentos VENCIDOS</p>
      <ul style="margin:0;padding-left:0;list-style:none;">
        ${g.expired.map(a => docRow('🔴', '#dc2626', a.label,
          `Venció: ${a.dateStr} (Días vencido: ${Math.abs(a.days)})`)).join('')}
      </ul>
    </td></tr>` : '';

  const upcomingSection = g.upcoming.length > 0 ? `
    <tr><td style="padding:16px 24px 4px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#d97706;">Documentos POR VENCER</p>
      <ul style="margin:0;padding-left:0;list-style:none;">
        ${g.upcoming.map(a => docRow(
          a.days <= 7 ? '🟠' : '🟡',
          a.days <= 7 ? '#d97706' : '#b45309',
          a.label,
          `Vence: ${a.dateStr} (Días restantes: ${a.days})`)).join('')}
      </ul>
    </td></tr>` : '';

  const missingSection = g.missing.length > 0 ? `
    <tr><td style="padding:16px 24px 4px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#6b7280;">Documentos SIN FECHA / SIN REGISTRO</p>
      <ul style="margin:0;padding-left:0;list-style:none;">
        ${g.missing.map(label => docRow('⚪', '#6b7280', label, 'SIN FECHA / SIN REGISTRO')).join('')}
      </ul>
    </td></tr>` : '';

  const contactLine = contact.contactEmail || contact.contactWhatsApp
    ? `<p style="margin:0 0 12px;font-size:13px;color:#374151;">
        Por favor enviar el/los documentos actualizados al correo
        ${contact.contactEmail ? `<a href="mailto:${contact.contactEmail}" style="color:#C29329;">${contact.contactEmail}</a>` : ''}
        ${contact.contactEmail && contact.contactWhatsApp ? ' o al WhatsApp ' : ''}
        ${contact.contactWhatsApp ? `<strong>${contact.contactWhatsApp}</strong>` : ''}.
      </p>`
    : '';

  const signature = (contact.adminName || contact.adminTitle || company) ? `
    <tr><td style="padding:20px 24px;border-top:2px solid #C29329;background:#f9fafb;">
      ${contact.adminName    ? `<p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#111;">${contact.adminName}</p>` : ''}
      ${contact.adminTitle   ? `<p style="margin:0 0 2px;font-size:12px;color:#555;">${contact.adminTitle}</p>` : ''}
      ${company              ? `<p style="margin:0 0 2px;font-size:12px;color:#555;">${company}</p>` : ''}
      ${contact.contactEmail ? `<p style="margin:0;font-size:12px;"><a href="mailto:${contact.contactEmail}" style="color:#C29329;">${contact.contactEmail}</a></p>` : ''}
    </td></tr>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#111418;padding:24px;border-bottom:3px solid #C29329;">
          <p style="margin:0;font-size:20px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:3px;">${company}</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Alerta de Documentación Vehicular</p>
        </td></tr>

        ${testBanner}

        <!-- Greeting -->
        <tr><td style="padding:24px 24px 12px;">
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">Estimado(a) <strong>${g.conductor}</strong>,</p>
          <table cellpadding="0" cellspacing="0" style="background:#f9fafb;border-left:3px solid #C29329;padding:12px 16px;margin-bottom:16px;width:100%;">
            <tr><td>
              <p style="margin:0 0 4px;font-size:12px;color:#6b7280;"><strong style="color:#374151;">Móvil:</strong> ${g.vehicleId}</p>
              <p style="margin:0 0 4px;font-size:12px;color:#6b7280;"><strong style="color:#374151;">Patente:</strong> ${g.patente}</p>
              ${g.rutConductor ? `<p style="margin:0;font-size:12px;color:#6b7280;"><strong style="color:#374151;">RUT Conductor:</strong> ${g.rutConductor}</p>` : ''}
            </td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#374151;">
            Le informamos que los siguientes documentos se encuentran
            <strong style="color:#dc2626;">VENCIDOS</strong>, próximos a vencer o sin registro en nuestro sistema:
          </p>
        </td></tr>

        ${expiredSection}
        ${upcomingSection}
        ${missingSection}

        <!-- Instructions -->
        <tr><td style="padding:20px 24px 8px;">
          ${contactLine}
          <p style="margin:0 0 12px;font-size:13px;color:#374151;">
            En caso de que el documento ya se encuentre renovado, pero aún no esté cargado en nuestro sistema,
            le solicitamos por favor enviarlo para su actualización y regularización.
          </p>
          <p style="margin:0;font-size:13px;color:#374151;">
            Agradecemos su pronta gestión para evitar inconvenientes operacionales.
          </p>
        </td></tr>

        ${signature}

        <!-- Footer -->
        <tr><td style="padding:12px 24px;text-align:center;background:#f3f4f6;">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">
            RadioMovil Fleet Manager — Sistema Automatizado de Alertas
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Admin summary email ──────────────────────────────────────────────────────

export function buildAdminEmailHtml(
  groups: VehicleAlertGroup[],
  test: boolean,
  contact: ContactInfo,
): string {
  const company    = contact.companyName || 'RadioMovil';
  const testBanner = test
    ? `<tr><td style="background:#78350f;color:#fde68a;padding:8px 20px;font-size:11px;font-weight:bold;text-align:center;">⚠ MENSAJE DE PRUEBA</td></tr>`
    : '';

  const totalExp  = groups.reduce((s, g) => s + g.expired.length,  0);
  const totalUpco = groups.reduce((s, g) => s + g.upcoming.length, 0);
  const totalMiss = groups.reduce((s, g) => s + g.missing.length,  0);

  const rows = groups.length === 0
    ? `<tr><td colspan="5" style="padding:20px;text-align:center;color:#9ca3af;">Sin alertas pendientes.</td></tr>`
    : groups.flatMap(g => [
        ...g.expired.map(a  => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#111;">${g.vehicleId}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${g.patente}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${a.label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#dc2626;font-weight:bold;">VENCIDO</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#dc2626;">Venció: ${a.dateStr} (${Math.abs(a.days)}d)</td>
        </tr>`),
        ...g.upcoming.map(a => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#111;">${g.vehicleId}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${g.patente}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${a.label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#d97706;font-weight:bold;">POR VENCER</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#d97706;">Vence: ${a.dateStr} (${a.days}d)</td>
        </tr>`),
        ...g.missing.map(label => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;color:#111;">${g.vehicleId}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${g.patente}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;font-weight:bold;">SIN REGISTRO</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#6b7280;">Sin fecha registrada</td>
        </tr>`),
      ]).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:#111418;padding:24px;border-bottom:3px solid #C29329;">
          <p style="margin:0;font-size:20px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:3px;">${company}</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Resumen de Alertas — Administración</p>
        </td></tr>
        ${testBanner}
        <tr><td style="padding:20px 24px;">
          <p style="margin:0;font-size:13px;color:#374151;">
            <strong>${groups.length}</strong> vehículo(s) con documentos por gestionar —
            <span style="color:#dc2626;font-weight:bold;">${totalExp} vencido(s)</span> ·
            <span style="color:#d97706;font-weight:bold;">${totalUpco} por vencer</span> ·
            <span style="color:#6b7280;font-weight:bold;">${totalMiss} sin registro</span>
          </p>
        </td></tr>
        <tr><td style="padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Móvil</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Patente</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Documento</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Estado</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">Detalle</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </td></tr>
        <tr><td style="padding:12px 24px;text-align:center;background:#f3f4f6;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">RadioMovil Fleet Manager — Resumen Administrativo</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── WhatsApp admin summary ───────────────────────────────────────────────────

export function buildAdminWhatsAppText(
  groups: VehicleAlertGroup[],
  test: boolean,
  contact: ContactInfo,
): string {
  const prefix  = test ? '[PRUEBA] ' : '';
  const company = contact.companyName || 'RadioMovil';
  const totalExp  = groups.reduce((s, g) => s + g.expired.length,  0);
  const totalUpco = groups.reduce((s, g) => s + g.upcoming.length, 0);
  const totalMiss = groups.reduce((s, g) => s + g.missing.length,  0);

  if (totalExp + totalUpco + totalMiss === 0) {
    return `${prefix}✅ *${company} — Sin alertas*\nTodos los documentos monitoreados están al día.`;
  }

  const lines = groups.slice(0, 10).flatMap(g => [
    ...g.expired.slice(0, 2).map(a  => `🔴 *${g.vehicleId}* — ${a.label}: VENCIDO (${Math.abs(a.days)}d)`),
    ...g.upcoming.slice(0, 1).map(a => `🟠 *${g.vehicleId}* — ${a.label}: ${a.days}d restantes`),
  ]);

  return `${prefix}🚨 *${company} — Resumen Alertas*\n${groups.length} vehículo(s): ${totalExp} vencido(s) · ${totalUpco} por vencer · ${totalMiss} sin registro\n\n${lines.join('\n')}\n\n_Revisa el sistema para el detalle completo._`;
}

// ─── Email subject for conductor ─────────────────────────────────────────────

export function buildSubjectForVehicle(
  g: VehicleAlertGroup,
  test: boolean,
  contact: ContactInfo,
): string {
  const company = contact.companyName || 'RadioMovil';
  const prefix  = test ? '[PRUEBA] ' : '🚨 ';
  return `${prefix}${company} | Móvil ${g.vehicleId} | ${g.patente} | VENCIDOS:${g.expired.length} | POR VENCER:${g.upcoming.length} | FALTANTES:${g.missing.length}`;
}

// ─── Send functions ───────────────────────────────────────────────────────────

export async function sendEmailsToVehicles(
  apiKey: string,
  groups: VehicleAlertGroup[],
  test: boolean,
  contact: ContactInfo,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  let sent = 0, skipped = 0;
  const errors: string[] = [];

  for (const g of groups) {
    if (!g.email) { skipped++; continue; }
    const { error } = await resend.emails.send({
      from: `${contact.companyName || 'RadioMovil'} Alertas <onboarding@resend.dev>`,
      to:   g.email,
      subject: buildSubjectForVehicle(g, test, contact),
      html: buildEmailHtmlForVehicle(g, test, contact),
    });
    if (error) {
      errors.push(`Móvil ${g.vehicleId} (${g.email}): ${error.message}`);
    } else {
      sent++;
    }
  }
  return { sent, skipped, errors };
}

export async function sendAdminEmail(
  apiKey: string,
  to: string,
  groups: VehicleAlertGroup[],
  test: boolean,
  contact: ContactInfo,
): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const totalExp  = groups.reduce((s, g) => s + g.expired.length,  0);
  const totalUpco = groups.reduce((s, g) => s + g.upcoming.length, 0);
  const company   = contact.companyName || 'RadioMovil';
  const { error } = await resend.emails.send({
    from: `${company} Alertas <onboarding@resend.dev>`,
    to,
    subject: test
      ? `[PRUEBA] Resumen Alertas — ${company}`
      : `🚨 ${company} | ${groups.length} vehículo(s) | VENCIDOS:${totalExp} | POR VENCER:${totalUpco}`,
    html: buildAdminEmailHtml(groups, test, contact),
  });
  if (error) throw new Error(error.message);
}

export async function sendWhatsApp(
  number: string,
  apiKey: string,
  groups: VehicleAlertGroup[],
  test: boolean,
  contact: ContactInfo,
): Promise<void> {
  const text = buildAdminWhatsAppText(groups, test, contact);
  const url  = `https://api.callmebot.com/whatsapp.php?phone=${number}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;
  const r    = await fetch(url);
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`CallMeBot ${r.status}: ${body.slice(0, 120)}`);
  }
}
