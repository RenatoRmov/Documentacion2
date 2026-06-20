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
// presenceOnlyDocs: docs that only need to exist (no expiry check) — e.g. Padrón
export function groupAlertsByVehicle(
  fleet: Record<string, unknown>[],
  priorityDocs: string[],
  daysInAdvance: number[],
  includeMissing = true,
  presenceOnlyDocs: Set<string> = new Set(['vencimientoPadron']),
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

      // Presence-only docs (e.g. Padrón): having any value means OK, no expiry check
      if (presenceOnlyDocs.has(key)) continue;

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
      vehicleId:      (v.numero_movil ?? v.id ?? '') as string,
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

// ─── Plain-text email for conductor ─────────────────────────────────────────
// Plain text never goes to Spam or Promotions. Used as the primary body for
// conductor emails so Gmail treats them as personal messages.

export function buildPlainTextForVehicle(
  g: VehicleAlertGroup,
  test: boolean,
  contact: ContactInfo,
): string {
  const company   = contact.companyName || 'RadioMovil';
  // Prefer legacy token URL for backward compat; fallback to RUT login portal
  const portalUrl = g.conductorToken
    ? `${contact.appUrl}/portal?token=${g.conductorToken}`
    : contact.appUrl ? `${contact.appUrl}/portal` : null;

  const lines: string[] = [];

  if (test) lines.push('[ MENSAJE DE PRUEBA — no es una alerta real ]\n');

  lines.push(`Hola, ${g.conductor}:\n`);
  lines.push(`Te escribimos desde ${company} para informarte que el Móvil ${g.vehicleId} — Patente ${g.patente} tiene documentos que requieren atención:\n`);

  if (g.expired.length > 0) {
    lines.push('DOCUMENTOS VENCIDOS:');
    g.expired.forEach(a => lines.push(`  - ${a.label}: venció el ${a.dateStr} (hace ${Math.abs(a.days)} día${Math.abs(a.days)!==1?'s':''})`));
    lines.push('');
  }
  if (g.upcoming.length > 0) {
    lines.push('POR VENCER PRÓXIMAMENTE:');
    g.upcoming.forEach(a => lines.push(`  - ${a.label}: vence el ${a.dateStr} (en ${a.days} día${a.days!==1?'s':''})`));
    lines.push('');
  }
  if (g.missing.length > 0) {
    lines.push('SIN FECHA REGISTRADA:');
    g.missing.forEach(l => lines.push(`  - ${l}`));
    lines.push('');
  }

  lines.push('Por favor, gestiona la renovación o actualización de estos documentos a la brevedad.\n');

  if (portalUrl) {
    const loginNote = !g.conductorToken ? ' (inicia sesión con tu RUT)' : '';
    lines.push(`Puedes actualizar tus documentos directamente desde tu celular${loginNote}:\n${portalUrl}\n`);
  }

  if (contact.contactEmail || contact.contactWhatsApp) {
    const parts: string[] = [];
    if (contact.contactEmail)    parts.push(`Correo: ${contact.contactEmail}`);
    if (contact.contactWhatsApp) parts.push(`WhatsApp: ${contact.contactWhatsApp}`);
    lines.push(`Si prefieres enviar los documentos al operador, contáctanos:\n${parts.join('  |  ')}\n`);
  }

  lines.push('Saludos,');
  if (contact.adminName)  lines.push(contact.adminName);
  if (contact.adminTitle) lines.push(contact.adminTitle);
  lines.push(company);

  return lines.join('\n');
}

// ─── HTML email for conductor (used as fallback / visual version) ─────────────

export function buildEmailHtmlForVehicle(
  g: VehicleAlertGroup,
  test: boolean,
  contact: ContactInfo,
): string {
  const company   = contact.companyName || 'RadioMovil';
  const portalUrl = g.conductorToken
    ? `${contact.appUrl}/portal?token=${g.conductorToken}`
    : contact.appUrl ? `${contact.appUrl}/portal` : null;
  const loginNote = !g.conductorToken && portalUrl ? ' (inicia sesión con tu RUT)' : '';

  const testNote = test
    ? `<p style="margin:0 0 20px;padding:10px 14px;background:#fef3c7;border-left:3px solid #f59e0b;font-size:13px;color:#92400e;">
        <strong>MENSAJE DE PRUEBA</strong> — Este correo no es una alerta real.
      </p>`
    : '';

  const docLines = [
    ...g.expired.map(a =>
      `<tr>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#dc2626;font-weight:bold;">🔴 ${a.label}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">Venció el ${a.dateStr} (hace ${Math.abs(a.days)} día${Math.abs(a.days)!==1?'s':''})</td>
      </tr>`),
    ...g.upcoming.map(a =>
      `<tr>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#d97706;font-weight:bold;">${a.days<=7?'🟠':'🟡'} ${a.label}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">Vence el ${a.dateStr} (en ${a.days} día${a.days!==1?'s':''})</td>
      </tr>`),
    ...g.missing.map(l =>
      `<tr>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">⚪ ${l}</td>
        <td style="padding:9px 14px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#9ca3af;">Sin fecha registrada</td>
      </tr>`),
  ].join('');

  const total = g.expired.length + g.upcoming.length + g.missing.length;

  const portalBlock = portalUrl
    ? `<p style="margin:20px 0 8px;font-size:13px;color:#111;">
        Puedes actualizar tus documentos directamente desde tu celular${loginNote}:
      </p>
      <p style="margin:0 0 20px;">
        <a href="${portalUrl}" style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;padding:10px 22px;border-radius:6px;">
          Actualizar mis documentos →
        </a>
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#9ca3af;">
        O copia este enlace: <span style="color:#6b7280;word-break:break-all;">${portalUrl}</span>
      </p>`
    : '';

  const contactLine = (contact.contactEmail || contact.contactWhatsApp)
    ? `<p style="margin:0 0 20px;font-size:13px;color:#374151;">
        Si prefieres enviar los documentos directamente, contáctame:
        ${contact.contactEmail ? `correo <a href="mailto:${contact.contactEmail}" style="color:#1a56db;">${contact.contactEmail}</a>` : ''}
        ${contact.contactWhatsApp ? `· WhatsApp ${contact.contactWhatsApp}` : ''}
      </p>`
    : '';

  const sig = `<p style="margin:24px 0 0;font-size:13px;color:#374151;line-height:1.6;">
    Saludos,<br>
    <strong>${contact.adminName || company}</strong>${contact.adminTitle ? `<br>${contact.adminTitle}` : ''}<br>
    ${company}
  </p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Documentos pendientes — Móvil ${g.vehicleId}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">

  <tr><td style="padding:28px 32px 0;">
    ${testNote}
    <p style="margin:0 0 16px;font-size:15px;color:#111;">Hola, <strong>${g.conductor}</strong>:</p>
    <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.6;">
      Te contactamos desde <strong>${company}</strong> para informarte que el <strong>Móvil ${g.vehicleId} — Patente ${g.patente}</strong>
      tiene <strong>${total} documento${total!==1?'s':''}</strong> que ${total!==1?'requieren':'requiere'} atención:
    </p>
  </td></tr>

  <tr><td style="padding:0 32px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;margin-top:4px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Documento</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Estado</th>
        </tr>
      </thead>
      <tbody>${docLines}</tbody>
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 28px;">
    ${portalBlock}
    ${contactLine}
    ${sig}
  </td></tr>

  <tr><td style="padding:14px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">${company} — Sistema de Gestión Documental</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── Plain-text admin summary ────────────────────────────────────────────────

export function buildAdminEmailPlainText(
  groups: VehicleAlertGroup[],
  test: boolean,
  contact: ContactInfo,
): string {
  const company   = contact.companyName || 'RadioMovil';
  const totalExp  = groups.reduce((s, g) => s + g.expired.length,  0);
  const totalUpco = groups.reduce((s, g) => s + g.upcoming.length, 0);
  const totalMiss = groups.reduce((s, g) => s + g.missing.length,  0);

  const lines: string[] = [];
  if (test) lines.push('[ MENSAJE DE PRUEBA ]\n');
  lines.push(`${company} — Resumen de alertas`);
  lines.push(`${groups.length} vehículo(s) — Vencidos: ${totalExp} | Por vencer: ${totalUpco} | Sin registro: ${totalMiss}\n`);

  for (const g of groups) {
    lines.push(`Móvil ${g.vehicleId} — Patente ${g.patente} (${g.conductor})`);
    for (const a of g.expired)  lines.push(`  VENCIDO: ${a.label} — venció ${a.dateStr} (hace ${Math.abs(a.days)} días)`);
    for (const a of g.upcoming) lines.push(`  Por vencer: ${a.label} — vence ${a.dateStr} (en ${a.days} días)`);
    for (const l of g.missing)  lines.push(`  Sin registro: ${l}`);
    lines.push('');
  }

  if (contact.appUrl) lines.push(`Sistema: ${contact.appUrl}\n`);
  lines.push(company);

  return lines.join('\n');
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
  const company  = contact.companyName || 'RadioMovil';
  const vehicle  = `Móvil ${g.vehicleId} (${g.patente})`;
  if (test) return `[PRUEBA] ${company} — Documentos ${vehicle}`;
  if (g.expired.length > 0) {
    const exp  = g.expired.length;
    const upco = g.upcoming.length;
    if (exp === 1 && upco === 0) return `${vehicle} — ${g.expired[0].label} vencido`;
    if (upco > 0) return `${vehicle} — ${exp} vencido${exp !== 1 ? 's' : ''}, ${upco} por vencer`;
    return `${vehicle} — ${exp} documentos vencidos`;
  }
  if (g.upcoming.length > 0) {
    const a = g.upcoming[0];
    if (g.upcoming.length === 1) return `${vehicle} — ${a.label} vence en ${a.days} días`;
    return `${vehicle} — ${g.upcoming.length} documentos por vencer`;
  }
  return `${vehicle} — documentos pendientes de registrar`;
}

// ─── Unified email sender (Gmail SMTP first, Resend fallback) ─────────────────
//
// Priority:
//   1. Gmail SMTP   → set GMAIL_USER + GMAIL_APP_PASSWORD in Vercel env vars
//                     (no domain verification needed, sends to anyone)
//   2. Resend API   → set RESEND_API_KEY + RESEND_FROM_EMAIL (verified domain required
//                     to send to recipients other than the account owner)

// Creates ONE transport for the whole request — avoids multiple SMTP handshakes.
// Returns null if using Resend instead.
async function createTransport(
): Promise<import('nodemailer').Transporter | null> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) return null;

  // Dynamic import handles both CJS default-export and ESM interop safely
  const nm = await import('nodemailer');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mailer: any = (nm as any).default ?? nm;

  return mailer.createTransport({
    host:             'smtp.gmail.com',
    port:             587,
    secure:           false,   // STARTTLS — more reliable than port 465 in serverless
    requireTLS:       true,
    auth:             { user: gmailUser, pass: gmailPass },
    connectionTimeout: 8000,
    greetingTimeout:   5000,
    socketTimeout:     8000,
  });
}

async function sendViaTransport(
  transport: import('nodemailer').Transporter,
  gmailUser: string,
  fromName: string,
  to: string,
  subject: string,
  body: { text?: string; html?: string },
): Promise<void> {
  const info = await transport.sendMail({
    from: `"${fromName}" <${gmailUser}>`,
    to, subject,
    text: body.text,
    html: body.html,
  });
  if (info.rejected?.length) {
    throw new Error(`Destinatario rechazado: ${info.rejected.join(', ')}`);
  }
}

async function sendViaResend(
  fromName: string,
  to: string,
  subject: string,
  body: { text?: string; html?: string },
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) throw new Error('Sin servicio de email configurado. Agrega GMAIL_USER+GMAIL_APP_PASSWORD (recomendado) o RESEND_API_KEY en Vercel.');
  const fromAddr = (() => {
    const custom = process.env.RESEND_FROM_EMAIL?.trim();
    return custom ? `${fromName} <${custom}>` : `${fromName} <onboarding@resend.dev>`;
  })();
  const { Resend } = await import('resend');
  const { error } = await new Resend(resendKey).emails.send({
    from: fromAddr, to, subject,
    text: body.text,
    html: body.html,
  });
  if (error) throw new Error(error.message);
}

// Sends emails in ONE SMTP session (one connection, all recipients).
// - test=true  → only sends admin summary to adminEmail, skips individual conductors
// - test=false → sends one email per conductor + admin summary CC
export async function sendAllEmails(
  groups:     VehicleAlertGroup[],
  adminEmail: string | null,
  test:       boolean,
  contact:    ContactInfo,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const fromName  = contact.companyName || 'RadioMovil';
  const gmailUser = process.env.GMAIL_USER?.trim() ?? null;
  const transport = await createTransport();

  let sent = 0, skipped = 0;
  const errors: string[] = [];

  const doSend = async (
    to: string,
    subject: string,
    body: { text?: string; html?: string },
    tag: string,
  ): Promise<boolean> => {
    try {
      if (transport && gmailUser) {
        await sendViaTransport(transport, gmailUser, fromName, to, subject, body);
      } else {
        await sendViaResend(fromName, to, subject, body);
      }
      return true;
    } catch (e: unknown) {
      errors.push(`${tag}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  // ── Conductor emails (live mode only) ──────────────────────────────────────
  // Send as plain text (primary) + HTML (fallback). Plain text ensures Gmail
  // delivers to Primary inbox instead of Promotions/Spam.
  if (!test) {
    for (const g of groups) {
      if (!g.email) { skipped++; continue; }
      const ok = await doSend(
        g.email,
        buildSubjectForVehicle(g, test, contact),
        {
          text: buildPlainTextForVehicle(g, test, contact),
          html: buildEmailHtmlForVehicle(g, test, contact),
        },
        `Móvil ${g.vehicleId} (${g.email})`,
      );
      if (ok) sent++;
    }
  }

  // ── Admin summary / CC (always, if address provided and there are groups) ──
  if (adminEmail && groups.length > 0) {
    const totalExp  = groups.reduce((s, g) => s + g.expired.length,  0);
    const totalUpco = groups.reduce((s, g) => s + g.upcoming.length, 0);
    const adminSubject = test
      ? `[PRUEBA] ${fromName} — resumen de alertas`
      : totalExp > 0
      ? `${fromName}: ${groups.length} vehículo${groups.length!==1?'s':''} con documentos vencidos o por vencer`
      : `${fromName}: ${groups.length} vehículo${groups.length!==1?'s':''} con documentos por gestionar`;
    await doSend(
      adminEmail,
      adminSubject,
      {
        text: buildAdminEmailPlainText(groups, test, contact),
        html: buildAdminEmailHtml(groups, test, contact),
      },
      'Admin CC',
    );
  }

  transport?.close();
  return { sent, skipped, errors };
}

// Sends a single email — used by conductor-digest and fleet-report crons
export async function sendSingleEmail(
  to: string,
  subject: string,
  body: { text?: string; html?: string },
  fromName: string,
): Promise<void> {
  const gmailUser = process.env.GMAIL_USER?.trim() ?? null;
  const transport = await createTransport();
  if (transport && gmailUser) {
    await sendViaTransport(transport, gmailUser, fromName, to, subject, body);
    transport.close();
  } else {
    await sendViaResend(fromName, to, subject, body);
  }
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
