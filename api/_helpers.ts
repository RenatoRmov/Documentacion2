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
  vehicleId:      string;
  patente:        string;
  conductor:      string;
  rutConductor:   string;
  email:          string | null;
  celular:        string | null;
  conductorToken: string | null;
  expired:        DocAlert[];  // days < 0
  upcoming:       DocAlert[];  // 0 <= days <= maxDays
  missing:        string[];    // doc labels with no date registered
}

export interface ContactInfo {
  companyName:     string;
  adminName:       string;
  adminTitle:      string;
  contactEmail:    string;
  contactWhatsApp: string;
  appUrl:          string;    // base URL for portal links
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
      vehicleId:      (v.id ?? v.numero_movil ?? '') as string,
      patente:        (v.patente ?? '') as string,
      conductor:      (v.nombreConductor ?? v.nombre_conductor ?? 'Sin nombre') as string,
      rutConductor:   (v.rutConductor ?? v.rut_conductor ?? '') as string,
      email:          (v.email as string) || null,
      celular:        (v.celular as string) || null,
      conductorToken: (v.conductorToken as string) || null,
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
  const company    = contact.companyName || 'RadioMovil';
  const portalUrl  = g.conductorToken ? `${contact.appUrl}/portal?token=${g.conductorToken}` : null;
  const testBanner = test
    ? `<tr><td style="background:#78350f;color:#fde68a;padding:8px 20px;font-size:11px;font-weight:bold;text-align:center;letter-spacing:1px;">⚠ MENSAJE DE PRUEBA — NO ES UNA ALERTA REAL</td></tr>`
    : '';

  const docRow = (icon: string, bg: string, label: string, detail: string) =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;">
        <span style="font-size:16px;line-height:1;">${icon}</span>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;background:${bg};width:100%;">
        <p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#111;">${label}</p>
        <p style="margin:0;font-size:11px;color:#6b7280;">${detail}</p>
      </td>
    </tr>`;

  const hasAlerts = g.expired.length > 0 || g.upcoming.length > 0 || g.missing.length > 0;
  const urgencyColor = g.expired.length > 0 ? '#dc2626' : g.upcoming.some(a => a.days <= 7) ? '#d97706' : '#b45309';

  const alertRows = [
    ...g.expired.map(a  => docRow('🔴', '#fff5f5', a.label, `Venció el ${a.dateStr} · ${Math.abs(a.days)} día${Math.abs(a.days)!==1?'s':''} vencido`)),
    ...g.upcoming.map(a => docRow(a.days <= 7 ? '🟠' : '🟡', '#fffbeb', a.label, `Vence el ${a.dateStr} · Quedan ${a.days} día${a.days!==1?'s':''}`)),
    ...g.missing.map(l  => docRow('⚪', '#f9fafb', l, 'Sin fecha registrada en el sistema')),
  ].join('');

  const portalSection = portalUrl ? `
    <tr><td style="padding:24px;background:#f0fdf4;border-top:1px solid #bbf7d0;border-bottom:1px solid #bbf7d0;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;color:#166534;font-weight:bold;">📲 Actualiza tus documentos directamente</p>
      <p style="margin:0 0 16px;font-size:12px;color:#4b5563;">Puedes subir una foto o PDF desde tu celular con un solo clic.</p>
      <a href="${portalUrl}"
        style="display:inline-block;background:#C29329;color:#000;text-decoration:none;font-weight:900;font-size:14px;padding:14px 32px;border-radius:8px;text-transform:uppercase;letter-spacing:1px;">
        Actualizar mis documentos →
      </a>
      <p style="margin:12px 0 0;font-size:10px;color:#9ca3af;">Si el botón no funciona, copia este enlace en tu navegador:<br>
        <span style="color:#6b7280;word-break:break-all;">${portalUrl}</span>
      </p>
    </td></tr>` : '';

  const alternativeContact = (contact.contactEmail || contact.contactWhatsApp) ? `
    <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">
        ¿Prefieres enviar los documentos al operador?
        ${contact.contactEmail ? ` Correo: <a href="mailto:${contact.contactEmail}" style="color:#C29329;">${contact.contactEmail}</a>` : ''}
        ${contact.contactWhatsApp ? ` &nbsp;·&nbsp; WhatsApp: <strong style="color:#374151;">${contact.contactWhatsApp}</strong>` : ''}
      </p>
    </td></tr>` : '';

  const signature = (contact.adminName || contact.adminTitle) ? `
    <tr><td style="padding:20px 24px;border-top:2px solid #C29329;">
      ${contact.adminName  ? `<p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#111;">${contact.adminName}</p>` : ''}
      ${contact.adminTitle ? `<p style="margin:0 0 2px;font-size:12px;color:#555;">${contact.adminTitle}</p>` : ''}
      <p style="margin:0;font-size:12px;color:#555;">${company}</p>
    </td></tr>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr><td style="background:#111418;padding:24px;border-bottom:4px solid #C29329;">
          <p style="margin:0;font-size:22px;font-weight:900;color:#C29329;text-transform:uppercase;letter-spacing:3px;">${company}</p>
          <p style="margin:4px 0 0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;">Documentación Vehicular</p>
        </td></tr>

        ${testBanner}

        <!-- Greeting + vehicle badge -->
        <tr><td style="padding:28px 24px 20px;">
          <p style="margin:0 0 16px;font-size:15px;color:#111;">
            Hola, <strong>${g.conductor}</strong> 👋
          </p>
          <table cellpadding="0" cellspacing="0" style="background:#111418;border-radius:8px;padding:14px 18px;margin-bottom:20px;width:auto;">
            <tr>
              <td style="padding-right:24px;">
                <p style="margin:0 0 2px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Móvil</p>
                <p style="margin:0;font-size:22px;font-weight:900;color:#C29329;font-style:italic;">${g.vehicleId}</p>
              </td>
              <td>
                <p style="margin:0 0 2px;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Patente</p>
                <p style="margin:0;font-size:18px;font-weight:900;color:#ffffff;font-style:italic;">${g.patente}</p>
              </td>
            </tr>
          </table>
          ${hasAlerts ? `
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">
            Tienes <strong style="color:${urgencyColor};">${g.expired.length + g.upcoming.length + g.missing.length} documento${(g.expired.length + g.upcoming.length + g.missing.length)!==1?'s':''}</strong>
            que requieren atención:
          </p>` : ''}
        </td></tr>

        <!-- Docs table -->
        ${hasAlerts ? `
        <tr><td style="padding:0 24px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${alertRows}
          </table>
        </td></tr>` : ''}

        <!-- Portal CTA -->
        ${portalSection}

        <!-- Alternative contact -->
        ${alternativeContact}

        <!-- Signature -->
        ${signature}

        <!-- Footer -->
        <tr><td style="padding:14px 24px;text-align:center;background:#f3f4f6;">
          <p style="margin:0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">
            ${company} · Sistema de Gestión Documental
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
  if (test) return `[PRUEBA] ${company} — Alerta de documentación Móvil ${g.vehicleId}`;
  if (g.expired.length > 0) {
    const labels = g.expired.map(a => a.label).slice(0, 2).join(' y ');
    const extra  = g.expired.length > 2 ? ` (+${g.expired.length - 2} más)` : '';
    return `⚠️ Móvil ${g.vehicleId} — ${labels}${extra} vencido${g.expired.length > 1 ? 's' : ''}`;
  }
  if (g.upcoming.length > 0) {
    const soonest = g.upcoming[0];
    return `📅 Móvil ${g.vehicleId} — ${soonest.label} vence en ${soonest.days} día${soonest.days !== 1 ? 's' : ''}`;
  }
  return `📋 Móvil ${g.vehicleId} — Documentos pendientes de registro`;
}

// ─── Send functions ───────────────────────────────────────────────────────────

// FROM address: use verified domain if configured, else Resend test sender.
// Set RESEND_FROM_EMAIL=alertas@radiomovil.cl in Vercel env vars once domain is verified.
function fromAddress(companyName: string): string {
  const custom = process.env.RESEND_FROM_EMAIL?.trim();
  if (custom) return `${companyName} <${custom}>`;
  return `${companyName} <onboarding@resend.dev>`;
}

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
      from:    fromAddress(contact.companyName || 'RadioMovil'),
      to:      g.email,
      subject: buildSubjectForVehicle(g, test, contact),
      html:    buildEmailHtmlForVehicle(g, test, contact),
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
    from:    fromAddress(company),
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
