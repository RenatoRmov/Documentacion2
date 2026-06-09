
import React, { useState } from 'react';
import { Vehicle, NotificationSettings } from '../types';

const PRIORITY_DOCS = [
  { key: 'vencimientoPermisoCirculacion', label: 'Permiso de Circulación', important: true },
  { key: 'vencimientoRevisionTecnica',    label: 'Revisión Técnica',        important: true },
  { key: 'vencimientoSOAP',              label: 'SOAP',                    important: true },
  { key: 'vencimientoPadron',            label: 'Padrón',                  important: true },
  { key: 'vencimientoSeguroAccidentes',  label: 'Seguro Accidentes',       important: true },
  { key: 'vencimientoSeguroAsiento',     label: 'Seguro Asiento',          important: true },
  { key: 'vencimientoControlTaximetro',  label: 'Control Taxímetro',       important: false },
  { key: 'vencimientoSeguroVidaConductor', label: 'Seguro Vida Conductor', important: false },
  { key: 'vigenciaLicenciaHasta',        label: 'Licencia Conductor',      important: false },
  { key: 'vigenciaCarnetHasta',          label: 'Carnet Conductor',        important: false },
];

const DAYS_OPTIONS = [7, 15, 30, 60];

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  email:    { enabled: false, address: '' },
  whatsapp: { enabled: false, number: '', apiKey: '' },
  priorityDocs: PRIORITY_DOCS.filter(d => d.important).map(d => d.key),
  daysInAdvance: [15, 30],
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
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

interface AlertPreview { vehicleId: string; patente: string; doc: string; days: number }

function computeAlerts(fleet: Vehicle[], settings: NotificationSettings): AlertPreview[] {
  if (!settings.priorityDocs.length || !settings.daysInAdvance.length) return [];
  const maxDays = Math.max(...settings.daysInAdvance);
  const result: AlertPreview[] = [];
  for (const v of fleet.filter(v => v.statusOperativo === 'Activo')) {
    for (const key of settings.priorityDocs) {
      const days = getDaysUntil((v as unknown as Record<string, string>)[key]);
      if (days !== null && days <= maxDays) {
        result.push({
          vehicleId: v.id,
          patente: v.patente,
          doc: PRIORITY_DOCS.find(d => d.key === key)?.label ?? key,
          days,
        });
      }
    }
  }
  return result.sort((a, b) => a.days - b.days);
}

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'lg' }> = ({ on, onChange, size = 'sm' }) => {
  const track = size === 'lg' ? 'h-7 w-14' : 'h-5 w-10';
  const thumb = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  const travel = size === 'lg' ? 'translate-x-8' : 'translate-x-[22px]';
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative inline-flex items-center rounded-full transition-all duration-300 focus:outline-none ${track} ${on ? 'bg-[#C29329]' : 'bg-zinc-700'}`}
    >
      <span className={`inline-block rounded-full bg-white shadow transition-transform duration-300 ${thumb} ${on ? travel : 'translate-x-1'}`} />
    </button>
  );
};

const Automatizaciones: React.FC<{ fleet: Vehicle[] }> = ({ fleet }) => {
  const [s, setS] = useState<NotificationSettings>(loadSettings);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const alerts = computeAlerts(fleet, s);

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
      if (res.ok) {
        setSendResult({ ok: true, msg: `Enviado correctamente: ${data.sent} canal(es), ${data.alerts} alerta(s)` });
      } else {
        setSendResult({ ok: false, msg: data.error ?? 'Error desconocido' });
      }
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
            Notificaciones por email y WhatsApp ante vencimientos críticos
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
                  <p className="text-xs font-black text-white uppercase tracking-widest">Email</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest">Resend — hasta 3.000 correos/mes gratis</p>
                </div>
              </div>
              <Toggle on={s.email.enabled} onChange={v => setS(p => ({ ...p, email: { ...p.email, enabled: v } }))} />
            </div>
            <div className={`p-6 space-y-4 transition-opacity ${s.email.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Dirección de destino</label>
                <input
                  type="email"
                  value={s.email.address}
                  onChange={e => setS(p => ({ ...p, email: { ...p.email, address: e.target.value } }))}
                  placeholder="admin@radiomovil.cl"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-[#C29329]/50 transition-colors"
                />
              </div>
              <div className="bg-amber-950/30 border border-amber-700/20 rounded-xl p-4 space-y-1">
                <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Configuración requerida en Vercel</p>
                <p className="text-[8px] text-zinc-500">
                  Agrega la variable <span className="text-zinc-200 font-bold font-mono">RESEND_API_KEY</span> en tu proyecto de Vercel.
                </p>
                <p className="text-[8px] text-zinc-600 mt-1">
                  Regístrate gratis en <span className="text-[#C29329]">resend.com</span> → API Keys → Create Key
                </p>
              </div>
            </div>
          </div>

          {/* WHATSAPP */}
          <div className={`bg-[#1B1F24] rounded-2xl border shadow-xl transition-all ${s.whatsapp.enabled ? 'border-[#C29329]/30' : 'border-white/5'}`}>
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">WhatsApp</p>
                  <p className="text-[8px] text-zinc-600 uppercase tracking-widest">CallMeBot — completamente gratuito</p>
                </div>
              </div>
              <Toggle on={s.whatsapp.enabled} onChange={v => setS(p => ({ ...p, whatsapp: { ...p.whatsapp, enabled: v } }))} />
            </div>
            <div className={`p-6 space-y-4 transition-opacity ${s.whatsapp.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Número destino (con código país, sin +)</label>
                <input
                  type="text"
                  value={s.whatsapp.number}
                  onChange={e => setS(p => ({ ...p, whatsapp: { ...p.whatsapp, number: e.target.value } }))}
                  placeholder="56912345678"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-[#C29329]/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">API Key de CallMeBot</label>
                <input
                  type="text"
                  value={s.whatsapp.apiKey}
                  onChange={e => setS(p => ({ ...p, whatsapp: { ...p.whatsapp, apiKey: e.target.value } }))}
                  placeholder="1234567"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-[#C29329]/50 transition-colors"
                />
              </div>
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="text-[8px] font-black text-[#C29329] hover:text-amber-400 uppercase tracking-widest transition-colors"
              >
                {showGuide ? '▲ Ocultar guía de activación' : '▼ ¿Cómo obtener mi API key?'}
              </button>
              {showGuide && (
                <div className="bg-black/20 rounded-xl p-5 space-y-3 border border-white/5">
                  <p className="text-[8px] font-black text-[#C29329] uppercase tracking-widest">Activación en 3 pasos (1 vez)</p>
                  {[
                    { n: '1', t: 'Guarda el número +34 644 49 87 38 en tus contactos de WhatsApp con el nombre "CallMeBot".' },
                    { n: '2', t: 'Envíale el mensaje exacto: "I allow callmebot to send me messages"' },
                    { n: '3', t: 'Recibirás tu API key por WhatsApp automáticamente. Cópiala en el campo de arriba.' },
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

          {/* DÍAS DE ANTICIPACIÓN */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
            <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Anticipación de Alertas</p>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-5">
              Avisar cuando falten estos días para el vencimiento
            </p>
            <div className="flex gap-3 flex-wrap">
              {DAYS_OPTIONS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                    s.daysInAdvance.includes(day)
                      ? 'bg-[#C29329]/20 border-[#C29329]/50 text-[#C29329]'
                      : 'bg-black/20 border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10'
                  }`}
                >
                  {day} días
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">

          {/* DOCUMENTOS PRIORITARIOS */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <p className="text-xs font-black text-white uppercase tracking-widest">Documentos a Monitorear</p>
                <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">Solo los seleccionados generan alertas</p>
              </div>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                {s.priorityDocs.length}/{PRIORITY_DOCS.length}
              </span>
            </div>
            <div className="space-y-2">
              {PRIORITY_DOCS.map(doc => {
                const active = s.priorityDocs.includes(doc.key);
                return (
                  <button
                    key={doc.key}
                    onClick={() => toggleDoc(doc.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border text-left ${
                      active
                        ? 'bg-[#C29329]/10 border-[#C29329]/30'
                        : 'bg-black/10 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      active ? 'bg-[#C29329] border-[#C29329]' : 'border-zinc-700'
                    }`}>
                      {active && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest flex-1 transition-colors ${active ? 'text-white' : 'text-zinc-500'}`}>
                      {doc.label}
                    </span>
                    {doc.important && (
                      <span className="text-[7px] font-black text-[#C29329]/60 uppercase tracking-widest">Clave</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* NOTA CRON */}
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
            <p className="text-xs font-black text-white uppercase tracking-widest mb-1">Cron Automático Diario</p>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-4">Ejecuta a las 8:00 AM hora Chile</p>
            <div className="space-y-2 text-[8px] text-zinc-500 leading-relaxed">
              <p>Para que el sistema envíe alertas automáticamente cada día sin que tengas que hacer clic, configura estas variables en <span className="text-zinc-300 font-bold">Vercel → Settings → Environment Variables</span>:</p>
              <div className="bg-black/30 rounded-lg p-3 font-mono space-y-1 text-[8px] border border-white/5 mt-2">
                <p><span className="text-[#C29329]">RESEND_API_KEY</span> <span className="text-zinc-600">=</span> <span className="text-zinc-400">tu_clave_de_resend</span></p>
                <p><span className="text-[#C29329]">CRON_NOTIFY_EMAIL</span> <span className="text-zinc-600">=</span> <span className="text-zinc-400">destino@email.cl</span></p>
                <p><span className="text-[#C29329]">CRON_WA_NUMBER</span> <span className="text-zinc-600">=</span> <span className="text-zinc-400">56912345678</span></p>
                <p><span className="text-[#C29329]">CRON_WA_APIKEY</span> <span className="text-zinc-600">=</span> <span className="text-zinc-400">tu_apikey_callmebot</span></p>
                <p><span className="text-[#C29329]">CRON_SECRET</span> <span className="text-zinc-600">=</span> <span className="text-zinc-400">una_clave_secreta_aleatoria</span></p>
              </div>
              <p className="text-zinc-600 text-[7px] mt-2">El cron necesita que los datos de la flota estén en Supabase. Mientras uses localStorage, usa el botón "Enviar Ahora" manual.</p>
            </div>
          </div>
        </div>
      </div>

      {/* PREVIEW DE ALERTAS */}
      <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Vista Previa de Alertas</p>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest mt-1">
              Lo que se enviaría con la configuración actual
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
            alerts.length > 0 ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/20 text-emerald-600'
          }`}>
            {alerts.length} alerta{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
            {alerts.map((a, i) => {
              const expired = a.days < 0;
              const urgent  = !expired && a.days <= 7;
              return (
                <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  expired ? 'bg-red-950/30 border-red-800/30' :
                  urgent  ? 'bg-orange-950/30 border-orange-700/30' :
                            'bg-yellow-950/20 border-yellow-800/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                      expired ? 'bg-red-900/60 text-red-400' :
                      urgent  ? 'bg-orange-900/60 text-orange-400' :
                                'bg-yellow-900/40 text-yellow-500'
                    }`}>{a.vehicleId}</span>
                    <span className="text-[9px] text-zinc-400 uppercase tracking-wider">{a.doc}</span>
                    <span className="text-[8px] text-zinc-600 uppercase">{a.patente}</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${
                    expired ? 'text-red-500' : urgent ? 'text-orange-400' : 'text-yellow-500'
                  }`}>
                    {expired ? `Vencido ${Math.abs(a.days)}d` : `${a.days}d restantes`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-14 text-center opacity-25">
            <p className="text-4xl mb-3">✓</p>
            <p className="text-[9px] font-black uppercase tracking-widest">Sin alertas pendientes con la configuración actual</p>
          </div>
        )}
      </div>

      {/* FEEDBACK */}
      {sendResult && (
        <div className={`p-4 rounded-xl border text-[9px] font-black uppercase tracking-widest ${
          sendResult.ok
            ? 'bg-emerald-900/20 border-emerald-700/30 text-emerald-400'
            : 'bg-red-900/20 border-red-700/30 text-red-400'
        }`}>
          {sendResult.ok ? '✓ ' : '✕ '}{sendResult.msg}
        </div>
      )}

      {/* ACTION BAR */}
      <div className="flex flex-wrap gap-3 justify-end">
        <button
          onClick={handleSave}
          className="btn-premium px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          {saved ? '✓ Guardado' : 'Guardar Configuración'}
        </button>
        <button
          onClick={() => handleSend(true)}
          disabled={isSending}
          className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Enviar Prueba
        </button>
        <button
          onClick={() => handleSend(false)}
          disabled={isSending || !s.enabled}
          className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#C29329]/20 border border-[#C29329]/40 text-[#C29329] hover:bg-[#C29329]/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isSending ? 'Enviando...' : 'Enviar Ahora'}
        </button>
      </div>

    </div>
  );
};

export default Automatizaciones;
