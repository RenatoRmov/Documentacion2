
import React, { useState } from 'react';
import { Vehicle, NotificationSettings } from '../types';

const PRIORITY_DOCS = [
  { key: 'vencimientoPermisoCirculacion',  label: 'Permiso de Circulación', important: true },
  { key: 'vencimientoRevisionTecnica',     label: 'Revisión Técnica',       important: true },
  { key: 'vencimientoSOAP',               label: 'SOAP',                   important: true },
  { key: 'vencimientoPadron',             label: 'Padrón',                 important: true },
  { key: 'vencimientoSeguroAccidentes',   label: 'Seguro Accidentes',      important: true },
  { key: 'vencimientoSeguroAsiento',      label: 'Seguro Asiento',         important: true },
  { key: 'vencimientoControlTaximetro',   label: 'Control Taxímetro',      important: false },
  { key: 'vencimientoSeguroVidaConductor',label: 'Seguro Vida Conductor',  important: false },
  { key: 'vigenciaLicenciaHasta',         label: 'Licencia Conductor',     important: false },
  { key: 'vigenciaCarnetHasta',           label: 'Carnet Conductor',       important: false },
];

const DAYS_OPTIONS = [7, 15, 30, 60];

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled:        false,
  email:          { enabled: false, address: '' },
  whatsapp:       { enabled: false, number: '', apiKey: '' },
  priorityDocs:   PRIORITY_DOCS.filter(d => d.important).map(d => d.key),
  daysInAdvance:  [15, 30],
  includeMissing: true,
  companyName:     '',
  adminName:       '',
  adminTitle:      '',
  contactEmail:    '',
  contactWhatsApp: '',
};

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem('radiomovil_notification_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function getDaysUntil(dateStr: string): number | null {
  if (!dateStr || dateStr === 'No Aplica' || dateStr === 'Sin Información' || !dateStr.trim()) return null;
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

interface VehicleGroup {
  vehicleId: string;
  patente:   string;
  conductor: string;
  email:     string | null;
  celular:   string | null;
  expired:   { label: string; days: number }[];
  upcoming:  { label: string; days: number }[];
  missing:   string[];
}

function computeVehicleGroups(fleet: Vehicle[], settings: NotificationSettings): VehicleGroup[] {
  if (!settings.priorityDocs.length) return [];
  const maxDays = settings.daysInAdvance.length ? Math.max(...settings.daysInAdvance) : 30;
  const groups: VehicleGroup[] = [];

  for (const v of fleet.filter(v => v.statusOperativo === 'Activo')) {
    const expired:  { label: string; days: number }[] = [];
    const upcoming: { label: string; days: number }[] = [];
    const missing:  string[] = [];

    for (const key of settings.priorityDocs) {
      const label   = PRIORITY_DOCS.find(d => d.key === key)?.label ?? key;
      const rawVal  = (v as unknown as Record<string, string>)[key] ?? '';
      const trimmed = rawVal.trim().toLowerCase();

      if (trimmed === 'no aplica') continue;

      if (!rawVal.trim() || trimmed === 'sin información' || trimmed === 'sin informacion') {
        if (settings.includeMissing) missing.push(label);
        continue;
      }

      const days = getDaysUntil(rawVal);
      if (days === null) {
        if (settings.includeMissing) missing.push(label);
        continue;
      }

      if (days < 0)             expired.push({ label, days });
      else if (days <= maxDays) upcoming.push({ label, days });
    }

    if (expired.length === 0 && upcoming.length === 0 && missing.length === 0) continue;

    groups.push({
      vehicleId: v.id,
      patente:   v.patente,
      conductor: v.nombreConductor || 'Sin nombre',
      email:     v.email    || null,
      celular:   v.celular  || null,
      expired,
      upcoming,
      missing,
    });
  }
  return groups;
}

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'lg' }> = ({ on, onChange, size = 'sm' }) => {
  const track  = size === 'lg' ? 'h-7 w-14' : 'h-5 w-10';
  const thumb  = size === 'lg' ? 'h-5 w-5'  : 'h-3.5 w-3.5';
  const travel = size === 'lg' ? 'translate-x-8' : 'translate-x-[22px]';
  return (
    <button onClick={() => onChange(!on)} className={`relative inline-flex items-center rounded-full transition-all duration-300 focus:outline-none ${track} ${on ? 'bg-[#C29329]' : 'bg-zinc-700'}`}>
      <span className={`inline-block rounded-full bg-white shadow transition-transform duration-300 ${thumb} ${on ? travel : 'translate-x-1'}`} />
    </button>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-[#C29329]/50 transition-colors" />
  </div>
);

const Automatizaciones: React.FC<{ fleet: Vehicle[] }> = ({ fleet }) => {
  const [s, setS]             = useState<NotificationSettings>(loadSettings);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saved, setSaved]     = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const groups      = computeVehicleGroups(fleet, s);
  const withEmail   = groups.filter(g => g.email).length;
  const withoutEmail = groups.filter(g => !g.email).length;
  const totalExp    = groups.reduce((n, g) => n + g.expired.length, 0);
  const totalUpco   = groups.reduce((n, g) => n + g.upcoming.length, 0);
  const totalMiss   = groups.reduce((n, g) => n + g.missing.length, 0);

  const patch = (partial: Partial<NotificationSettings>) => setS(prev => ({ ...prev, ...partial }));

  const handleSave = () => {
    localStorage.setItem('radiomovil_notification_settings', JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSend = async (test: boolean) => {
    if (!s.email.enabled && !s.whatsapp.enabled) {
      setSendResult({ ok: false, msg: 'Activa al menos un canal (email o WhatsApp) antes de enviar.' });
      return;
    }
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fleet, settings: s, test }),
      });
      const data = await res.json();
      const parts: string[] = [];
      if (test) {
        if (data.emailsSent > 0) parts.push('Email de prueba enviado al administrador');
      } else {
        if (data.emailsSent   > 0) parts.push(`${data.emailsSent} email(s) enviado(s) a conductores`);
        if (data.emailsSkipped > 0) parts.push(`${data.emailsSkipped} sin correo registrado`);
      }
      if (data.errors?.length > 0) parts.push(...data.errors);
      setSendResult({ ok: res.ok && data.errors?.length === 0, msg: parts.join(' · ') || 'Sin alertas pendientes' });
    } catch (e: unknown) {
      setSendResult({ ok: false, msg: `Error de conexión: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setIsSending(false);
    }
  };

  const toggleDoc = (key: string) =>
    patch({ priorityDocs: s.priorityDocs.includes(key) ? s.priorityDocs.filter(k => k !== key) : [...s.priorityDocs, key] });

  const toggleDay = (day: number) =>
    patch({ daysInAdvance: s.daysInAdvance.includes(day) ? s.daysInAdvance.filter(d => d !== day) : [...s.daysInAdvance, day] });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-[#1B1F24] p-8 rounded-2xl border border-white/5 flex flex-wrap gap-4 justify-between items-center shadow-2xl">
        <div>
          <h3 className="text-xl font-black text-white italic uppercase tracking-widest">Sistema de Alertas Automáticas</h3>
          <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">
            Notificaciones individuales a cada conductor según su correo registrado
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${s.enabled ? 'text-emerald-500' : 'text-zinc-600'}`}>
            {s.enabled ? '● AUTOMATIZACIÓN ACTIVA' : '○ AUTOMATIZACIÓN INACTIVA'}
          </span>
          <Toggle on={s.enabled} onChange={v => patch({ enabled: v })} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">

          {/* EMAIL */}
          <div className={`bg-[#1B1F24] rounded-2xl border shadow-xl transition-all ${s.email.enabled ? 'border-[#C29329]/30' : 'border-white/5'}`}>
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📧</span>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">Email por conductor</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Resend — hasta 3.000 correos/mes gratis</p>
                </div>
              </div>
              <Toggle on={s.email.enabled} onChange={v => setS(p => ({ ...p, email: { ...p.email, enabled: v } }))} />
            </div>
            <div className={`p-6 space-y-4 transition-opacity ${s.email.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="bg-emerald-950/30 border border-emerald-700/20 rounded-xl p-4">
                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Cómo funciona</p>
                <p className="text-[8px] text-zinc-400 leading-relaxed">
                  Cada conductor recibe un email personalizado con VENCIDOS, POR VENCER y SIN REGISTRO de <strong className="text-zinc-200">su vehículo</strong>.
                </p>
              </div>
              <Field label="Copia al administrador (CC, para recibir prueba)"
                value={s.email.address} type="email" placeholder="admin@radiomovil.cl"
                onChange={v => setS(p => ({ ...p, email: { ...p.email, address: v } }))} />
              <div className="bg-amber-950/30 border border-amber-700/20 rounded-xl p-4">
                <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">Requiere en Vercel</p>
                <p className="text-[8px] text-zinc-500">Variable <span className="text-zinc-200 font-bold font-mono">RESEND_API_KEY</span> → regístrate en <span className="text-[#C29329]">resend.com</span></p>
              </div>
            </div>
          </div>

          {/* FIRMA DEL EMAIL */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl space-y-4">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Firma del Email</p>
              <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Datos que aparecen en el cuerpo del email al conductor</p>
            </div>
            <Field label="Nombre de la empresa"    value={s.companyName}     placeholder="Radiomóvil Nueva Huechuraba" onChange={v => patch({ companyName: v })} />
            <Field label="Nombre del responsable"  value={s.adminName}       placeholder="Renato Jesús Oliva Aguirre"  onChange={v => patch({ adminName: v })} />
            <Field label="Cargo"                   value={s.adminTitle}      placeholder="Encargado de Procesos"        onChange={v => patch({ adminTitle: v })} />
            <Field label="Correo de contacto (para conductores)" value={s.contactEmail} type="email" placeholder="renato.oliva@radiomovil.cl" onChange={v => patch({ contactEmail: v })} />
            <Field label="WhatsApp de contacto"    value={s.contactWhatsApp} placeholder="+56 9 5405 7893"             onChange={v => patch({ contactWhatsApp: v })} />
          </div>

          {/* WHATSAPP */}
          <div className={`bg-[#1B1F24] rounded-2xl border shadow-xl transition-all ${s.whatsapp.enabled ? 'border-[#C29329]/30' : 'border-white/5'}`}>
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">WhatsApp Admin</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Resumen al administrador vía CallMeBot</p>
                </div>
              </div>
              <Toggle on={s.whatsapp.enabled} onChange={v => setS(p => ({ ...p, whatsapp: { ...p.whatsapp, enabled: v } }))} />
            </div>
            <div className={`p-6 space-y-4 transition-opacity ${s.whatsapp.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <Field label="Tu número (con código país, sin +)" value={s.whatsapp.number} placeholder="56912345678" onChange={v => setS(p => ({ ...p, whatsapp: { ...p.whatsapp, number: v } }))} />
              <Field label="API Key de CallMeBot" value={s.whatsapp.apiKey} placeholder="1234567" onChange={v => setS(p => ({ ...p, whatsapp: { ...p.whatsapp, apiKey: v } }))} />
              <button onClick={() => setShowGuide(!showGuide)} className="text-[8px] font-black text-[#C29329] hover:text-amber-400 uppercase tracking-widest transition-colors">
                {showGuide ? '▲ Ocultar guía' : '▼ ¿Cómo obtener mi API key?'}
              </button>
              {showGuide && (
                <div className="bg-black/20 rounded-xl p-5 space-y-3 border border-white/5">
                  {[
                    { n: '1', t: 'Guarda el número +34 644 49 87 38 en tus contactos como "CallMeBot".' },
                    { n: '2', t: 'Envíale: "I allow callmebot to send me messages"' },
                    { n: '3', t: 'Recibirás tu API key por WhatsApp. Cópiala arriba.' },
                  ].map(({ n, t }) => (
                    <div key={n} className="flex gap-3 items-start">
                      <span className="text-[#C29329] font-black text-[10px] mt-0.5 shrink-0">{n}.</span>
                      <p className="text-[8px] text-zinc-400 leading-relaxed">{t}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">

          {/* DOCUMENTOS */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <p className="text-xs font-black text-white uppercase tracking-widest">Documentos a Monitorear</p>
                <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">Solo los seleccionados generan alertas</p>
              </div>
              <span className="text-[8px] font-black text-zinc-500">{s.priorityDocs.length}/{PRIORITY_DOCS.length}</span>
            </div>
            <div className="space-y-2">
              {PRIORITY_DOCS.map(doc => {
                const active = s.priorityDocs.includes(doc.key);
                return (
                  <button key={doc.key} onClick={() => toggleDoc(doc.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border text-left ${active ? 'bg-[#C29329]/10 border-[#C29329]/30' : 'bg-black/10 border-white/5 hover:border-white/10'}`}>
                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'bg-[#C29329] border-[#C29329]' : 'border-zinc-700'}`}>
                      {active && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest flex-1 ${active ? 'text-white' : 'text-zinc-500'}`}>{doc.label}</span>
                    {doc.important && <span className="text-[7px] font-black text-[#C29329]/60 uppercase tracking-widest">Clave</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DÍAS + SIN REGISTRO */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl space-y-5">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Anticipación de Alertas</p>
              <div className="flex gap-3 flex-wrap mt-3">
                {DAYS_OPTIONS.map(day => (
                  <button key={day} onClick={() => toggleDay(day)}
                    className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${s.daysInAdvance.includes(day) ? 'bg-[#C29329]/20 border-[#C29329]/50 text-[#C29329]' : 'bg-black/20 border-white/5 text-zinc-600 hover:text-zinc-400'}`}>
                    {day} días
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-[9px] font-black text-white uppercase tracking-widest">Incluir Sin Registro</p>
                <p className="text-[7px] text-zinc-600 uppercase tracking-widest mt-0.5">Avisar también sobre docs sin fecha cargada</p>
              </div>
              <Toggle on={s.includeMissing} onChange={v => patch({ includeMissing: v })} />
            </div>
          </div>

          {/* CRON NOTE */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
            <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Cron Automático Diario</p>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-4">Ejecuta a las 8:00 AM hora Chile</p>
            <div className="bg-black/30 rounded-lg p-3 font-mono space-y-1 text-[8px] border border-white/5">
              <p><span className="text-[#C29329]">RESEND_API_KEY</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">tu_clave_resend</span></p>
              <p><span className="text-[#C29329]">CRON_COMPANY_NAME</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">Radiomóvil Nueva Huechuraba</span></p>
              <p><span className="text-[#C29329]">CRON_ADMIN_NAME</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">Renato Jesús Oliva Aguirre</span></p>
              <p><span className="text-[#C29329]">CRON_ADMIN_TITLE</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">Encargado de Procesos</span></p>
              <p><span className="text-[#C29329]">CRON_CONTACT_EMAIL</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">renato.oliva@radiomovil.cl</span></p>
              <p><span className="text-[#C29329]">CRON_NOTIFY_EMAIL</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">admin@radiomovil.cl</span></p>
              <p><span className="text-zinc-600 text-[7px]"># Opcionales:</span></p>
              <p><span className="text-[#C29329]">CRON_WA_NUMBER</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">56912345678</span></p>
              <p><span className="text-[#C29329]">CRON_WA_APIKEY</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">tu_apikey_callmebot</span></p>
              <p><span className="text-[#C29329]">CRON_SECRET</span><span className="text-zinc-600"> = </span><span className="text-zinc-400">clave_secreta_aleatoria</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* PREVIEW */}
      <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Vista Previa — Destinatarios</p>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">Conductores que recibirían alerta con la configuración actual</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {totalExp  > 0 && <span className="px-2 py-1 rounded-full text-[8px] font-black bg-red-900/30 text-red-400">{totalExp} vencidos</span>}
            {totalUpco > 0 && <span className="px-2 py-1 rounded-full text-[8px] font-black bg-orange-900/30 text-orange-400">{totalUpco} por vencer</span>}
            {totalMiss > 0 && <span className="px-2 py-1 rounded-full text-[8px] font-black bg-zinc-800 text-zinc-500">{totalMiss} sin registro</span>}
            {withoutEmail > 0 && <span className="px-2 py-1 rounded-full text-[8px] font-black bg-zinc-800 text-zinc-600">{withoutEmail} sin correo</span>}
            <span className={`px-3 py-1 rounded-full text-[8px] font-black ${groups.length > 0 ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/20 text-emerald-600'}`}>
              {groups.length} vehículo{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {groups.length > 0 ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {groups.map((g, i) => (
              <div key={i} className="rounded-xl border border-white/5 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-black/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-[#C29329]/20 text-[#C29329]">{g.vehicleId}</span>
                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">{g.patente}</span>
                    <span className="text-[8px] text-zinc-400 truncate max-w-32">{g.conductor}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {g.expired.length  > 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-red-900/40 text-red-400">{g.expired.length} venc.</span>}
                    {g.upcoming.length > 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-orange-900/40 text-orange-400">{g.upcoming.length} próx.</span>}
                    {g.missing.length  > 0 && <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{g.missing.length} falt.</span>}
                  </div>
                </div>
                {/* Contact + alerts */}
                <div className="px-4 py-3 bg-black/10 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${g.email ? 'bg-emerald-900/30 text-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>
                      📧 {g.email ?? 'Sin correo'}
                    </span>
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded ${g.celular ? 'bg-blue-900/30 text-blue-400' : 'bg-zinc-800 text-zinc-600'}`}>
                      📱 {g.celular ?? 'Sin teléfono'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.expired.map( (a, ai) => <span key={`e${ai}`} className="text-[7px] font-black px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-800/20">{a.label} · {Math.abs(a.days)}d vencido</span>)}
                    {g.upcoming.map((a, ai) => <span key={`u${ai}`} className="text-[7px] font-black px-2 py-0.5 rounded bg-orange-950/30 text-orange-400 border border-orange-800/20">{a.label} · {a.days}d</span>)}
                    {g.missing.map( (l, ai) => <span key={`m${ai}`} className="text-[7px] font-black px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-white/5">{l} · sin fecha</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center opacity-25">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-[9px] font-black uppercase tracking-widest">Sin alertas con la configuración actual</p>
          </div>
        )}
      </div>

      {sendResult && (
        <div className={`p-4 rounded-xl border text-[9px] font-black uppercase tracking-widest ${sendResult.ok ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400' : 'bg-red-900/20 border-red-700/30 text-red-400'}`}>
          {sendResult.ok ? '✓ ' : '✕ '}{sendResult.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-end">
        <button onClick={handleSave} className="btn-premium px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">
          {saved ? '✓ Guardado' : 'Guardar Configuración'}
        </button>
        <button onClick={() => handleSend(true)} disabled={isSending}
          className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30">
          Enviar Prueba
        </button>
        <button onClick={() => handleSend(false)} disabled={isSending || !s.enabled}
          className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#C29329]/20 border border-[#C29329]/40 text-[#C29329] hover:bg-[#C29329]/30 transition-all disabled:opacity-30">
          {isSending ? 'Enviando...' : 'Enviar Ahora'}
        </button>
      </div>
    </div>
  );
};

export default Automatizaciones;
