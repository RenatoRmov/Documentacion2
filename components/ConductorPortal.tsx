import React, { useState, useEffect, useRef } from 'react';
import { Conductor, Vehicle } from '../types';
import { conductorService } from '../services/conductorService';
import { vehicleService } from '../services/vehicleService';
import { uploadDoc } from '../services/storageService';
import { settingsService, PortalContact } from '../services/settingsService';
import { fromISODate } from '../constants';

// Mapeo campo de fecha → campo URL en la tabla
const DATE_TO_URL_KEY: Record<string, string> = {
  vigenciaCarnetHasta:           'urlCarnet',
  vigenciaLicenciaHasta:         'urlLicencia',
  vencimientoPermisoCirculacion: 'urlPermisoCirculacion',
  vencimientoRevisionTecnica:    'urlRevisionTecnica',
  vencimientoSOAP:               'urlSOAP',
  vencimientoPadron:             'urlPadron',
  vencimientoSeguroAsiento:      'urlSeguroAsiento',
};

const CONDUCTOR_DOCS: { docKey: keyof Conductor; label: string }[] = [
  { docKey: 'vigenciaCarnetHasta',   label: 'Carnet de Conductor' },
  { docKey: 'vigenciaLicenciaHasta', label: 'Licencia de Conducir' },
  { docKey: 'vencimientoSeguroVida', label: 'Seguro de Vida' },
];

const VEHICLE_DOCS: { docKey: keyof Vehicle; label: string }[] = [
  { docKey: 'vencimientoPermisoCirculacion', label: 'Permiso de Circulación' },
  { docKey: 'vencimientoRevisionTecnica',    label: 'Revisión Técnica' },
  { docKey: 'vencimientoSOAP',               label: 'SOAP' },
  { docKey: 'vencimientoPadron',             label: 'Padrón' },
  { docKey: 'vencimientoSeguroAccidentes',   label: 'Seguro de Accidentes' },
  { docKey: 'vencimientoSeguroAsiento',      label: 'Seguro de Asiento' },
  { docKey: 'vencimientoControlTaximetro',   label: 'Control de Taxímetro' },
];

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

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

function formatDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim() || dateStr === 'Sin Información') return 'Sin fecha';
  if (dateStr === 'No Aplica') return 'No aplica';
  let iso = dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    iso = `${y}-${m}-${d}`;
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toInputDate(dateStr: string): string {
  if (!dateStr || dateStr === 'No Aplica' || dateStr === 'Sin Información' || !dateStr.trim()) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('-');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

type DocStatus = 'expired' | 'urgent' | 'soon' | 'ok' | 'missing' | 'na';

function getDocStatus(dateStr: string): DocStatus {
  const trimmed = (dateStr ?? '').trim().toLowerCase();
  if (trimmed === 'no aplica') return 'na';
  if (!trimmed || trimmed === 'sin información' || trimmed === 'sin informacion') return 'missing';
  const days = getDaysUntil(dateStr);
  if (days === null) return 'missing';
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'ok';
}

const STATUS_META: Record<DocStatus, { bg: string; text: string; border: string }> = {
  expired: { bg: 'bg-red-950/40',    text: 'text-red-400',    border: 'border-red-800/30' },
  urgent:  { bg: 'bg-orange-950/40', text: 'text-orange-400', border: 'border-orange-800/30' },
  soon:    { bg: 'bg-amber-950/30',  text: 'text-amber-400',  border: 'border-amber-800/20' },
  ok:      { bg: 'bg-emerald-950/20',text: 'text-emerald-500',border: 'border-emerald-800/20' },
  missing: { bg: 'bg-zinc-900/40',   text: 'text-zinc-500',   border: 'border-white/5' },
  na:      { bg: 'bg-zinc-900/20',   text: 'text-zinc-600',   border: 'border-white/5' },
};

function daysLabel(dateStr: string): string {
  const days = getDaysUntil(dateStr);
  if (days === null) return '';
  if (days < 0) return `Venció hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
}

// ─── DocRow ───────────────────────────────────────────────────────────────────

interface DocRowProps {
  contextKey: string;
  label: string;
  value: string;
  status: DocStatus;
  urlValue?: string;
  editing: string | null;
  saving: boolean;
  uploading: boolean;
  saved: Set<string>;
  onStartEdit: (contextKey: string) => void;
  onSave: (contextKey: string, dateVal: string) => void;
  onCancel: () => void;
  onUpload: (contextKey: string, file: File) => Promise<void>;
}

const DocRow: React.FC<DocRowProps> = ({
  contextKey, label, value, status, urlValue,
  editing, saving, uploading, saved,
  onStartEdit, onSave, onCancel, onUpload,
}) => {
  const meta      = STATUS_META[status];
  const isEditing = editing === contextKey;
  const wasSaved  = saved.has(contextKey);
  const fileRef   = useRef<HTMLInputElement>(null);
  const fieldKey  = contextKey.slice(contextKey.indexOf(':') + 1);
  const hasUrlField = fieldKey in DATE_TO_URL_KEY;

  // Estado local de la fecha — evita re-renders del padre mientras el conductor escribe
  const [localDate, setLocalDate] = useState('');
  useEffect(() => {
    if (isEditing) setLocalDate(toInputDate(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${meta.text}`}>{label}</p>
          {!isEditing && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] text-zinc-300 font-bold">
                {formatDate(value)}
                {(status === 'expired' || status === 'urgent' || status === 'soon') && (
                  <span className={`ml-2 text-[8px] font-black ${meta.text}`}>· {daysLabel(value)}</span>
                )}
              </p>
              {urlValue && (
                <a href={urlValue} target="_blank" rel="noopener noreferrer"
                  className="text-[8px] font-black text-emerald-400 bg-emerald-900/20 border border-emerald-700/20 px-2 py-0.5 rounded-lg hover:bg-emerald-900/30 transition-all whitespace-nowrap">
                  📎 Ver doc
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {wasSaved && !isEditing && (
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✓ Guardado</span>
          )}
          {!isEditing && !wasSaved && status !== 'ok' && (
            <button onClick={() => onStartEdit(contextKey)}
              className="text-xs font-black uppercase tracking-wide px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10 min-w-[88px]">
              Actualizar
            </button>
          )}
          {!isEditing && !wasSaved && status === 'ok' && (
            <button onClick={() => onStartEdit(contextKey)}
              className="text-[9px] font-black uppercase tracking-wide px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors border border-white/5 hover:border-white/10">
              Editar
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="px-4 pb-5 pt-3 space-y-4 border-t border-white/10 bg-[#0f1117]">

          {/* Fecha — fondo blanco para máxima legibilidad en cualquier móvil */}
          <div>
            <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-2">
              Nueva fecha de vencimiento
            </label>
            <input
              type="date"
              value={localDate}
              onChange={e => setLocalDate(e.target.value)}
              style={{ colorScheme: 'light' }}
              className="w-full bg-white border-2 border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 font-semibold focus:outline-none focus:border-[#C29329] transition-colors"
            />
          </div>

          {/* Subir documento */}
          {hasUrlField && (
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                Documento (foto o PDF)
              </label>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.heic,.heif"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(contextKey, f); e.target.value = ''; }}
              />
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={`w-full py-3.5 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2 ${
                  uploading
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-400 animate-pulse'
                    : urlValue
                    ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                    : 'bg-[#C29329]/10 border-[#C29329]/40 text-[#C29329] hover:bg-[#C29329]/20'
                }`}>
                {uploading ? '⏳ Subiendo...' : urlValue ? '📎 Reemplazar documento' : '📎 Adjuntar foto o PDF'}
              </button>
              {urlValue && !uploading && (
                <a href={urlValue} target="_blank" rel="noopener noreferrer"
                  className="block text-center text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors py-1">
                  Ver documento subido →
                </a>
              )}
              <p className="text-[10px] text-zinc-600 text-center">Acepta fotos (JPG, HEIC) y PDF</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => onSave(contextKey, localDate)}
              disabled={saving || (!localDate && !urlValue)}
              className="flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-wide bg-[#C29329] text-black hover:bg-amber-500 transition-all disabled:opacity-30">
              {saving ? 'Guardando...' : '✓ Guardar'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-4 rounded-xl text-sm font-black uppercase tracking-wide border-2 border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countAlerts(docs: { status: DocStatus }[]): number {
  return docs.filter(d => ['expired', 'urgent', 'soon'].includes(d.status)).length;
}

const InfoRow = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div>
      <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-[10px] font-bold text-zinc-200">{value}</p>
    </div>
  ) : null;

// ─── Componente principal ─────────────────────────────────────────────────────

const ConductorPortal: React.FC<{ token: string }> = ({ token }) => {
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [contact,   setContact]   = useState<PortalContact | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [editing,   setEditing]   = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState<string | null>(null); // contextKey being uploaded
  const [saved,     setSaved]     = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const c = await conductorService.fetchConductorByToken(token);
        if (!c) { setError('Enlace inválido o no encontrado.'); return; }
        const [vs, ct] = await Promise.all([
          vehicleService.fetchVehiclesByRut(c.rut),
          settingsService.loadContact(),
        ]);
        setConductor(c);
        setVehicles(vs);
        setContact(ct);
      } catch {
        setError('Error de conexión. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const startEdit = (contextKey: string) => setEditing(contextKey);

  const handleSave = async (contextKey: string, dateVal: string) => {
    if (!conductor) return;
    setSaving(true);
    try {
      const colonIdx = contextKey.indexOf(':');
      const ctx      = contextKey.slice(0, colonIdx);
      const fieldKey = contextKey.slice(colonIdx + 1);
      const iso      = dateVal;

      if (ctx === 'conductor') {
        await conductorService.updateConductor(conductor.rut, { [fieldKey]: iso } as Partial<Conductor>);
        const displayVal = fromISODate(iso) || iso;
        setConductor(prev => prev ? { ...prev, [fieldKey]: displayVal } : null);
      } else {
        const updated = await vehicleService.updateVehicle(ctx, { [fieldKey]: iso } as Partial<Vehicle>);
        setVehicles(prev => prev.map(v => v.patente === ctx ? updated : v));
      }
      setEditing(null);
      setSaved(prev => new Set([...prev, contextKey]));
      setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(contextKey); return n; }), 3000);
    } catch {
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (contextKey: string, file: File) => {
    if (!conductor) return;
    const colonIdx = contextKey.indexOf(':');
    const ctx      = contextKey.slice(0, colonIdx);
    const fieldKey = contextKey.slice(colonIdx + 1);
    const urlKey   = DATE_TO_URL_KEY[fieldKey];
    if (!urlKey) return;

    setUploading(contextKey);
    try {
      const storagePath = ctx === 'conductor'
        ? `conductores/${conductor.rut.replace(/\./g, '')}/${urlKey}`
        : `vehicles/${ctx}/${urlKey}`;
      const url = await uploadDoc(storagePath, file);

      if (ctx === 'conductor') {
        await conductorService.updateConductor(conductor.rut, { [urlKey]: url } as Partial<Conductor>);
        setConductor(prev => prev ? { ...prev, [urlKey]: url } : null);
      } else {
        await vehicleService.updateVehicle(ctx, { [urlKey]: url } as Partial<Vehicle>);
        setVehicles(prev => prev.map(v => v.patente === ctx ? { ...v, [urlKey]: url } : v));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      alert(`Error al subir el archivo:\n${msg}`);
    } finally {
      setUploading(null);
    }
  };

  // ── Estados de carga ──

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#C29329] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 text-xs uppercase tracking-widest">Cargando portal...</p>
      </div>
    </div>
  );

  if (error || !conductor) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Enlace no válido</p>
        <p className="text-zinc-500 text-xs">{error ?? 'El enlace no corresponde a ningún conductor registrado.'}</p>
      </div>
    </div>
  );

  // ── Preparar datos ──

  const rowProps = {
    editing, saving,
    saved, onStartEdit: startEdit,
    onSave: handleSave, onCancel: () => setEditing(null),
    onUpload: handleUpload,
  };

  const conductorDocs = CONDUCTOR_DOCS.map(d => {
    const fieldKey = String(d.docKey);
    const value    = String((conductor as unknown as Record<string, unknown>)[fieldKey] ?? '');
    const urlKey   = DATE_TO_URL_KEY[fieldKey];
    const urlValue = urlKey ? String((conductor as unknown as Record<string, unknown>)[urlKey] ?? '') : undefined;
    return { contextKey: `conductor:${fieldKey}`, label: d.label, value, status: getDocStatus(value), urlValue: urlValue || undefined };
  }).filter(d => d.status !== 'na');

  const vehicleSections = vehicles.map(v => {
    const docs = VEHICLE_DOCS.map(d => {
      const fieldKey = String(d.docKey);
      const value    = String((v as unknown as Record<string, unknown>)[fieldKey] ?? '');
      const urlKey   = DATE_TO_URL_KEY[fieldKey];
      const urlValue = urlKey ? String((v as unknown as Record<string, unknown>)[urlKey] ?? '') : undefined;
      return { contextKey: `${v.patente}:${fieldKey}`, label: d.label, value, status: getDocStatus(value), urlValue: urlValue || undefined };
    }).filter(d => d.status !== 'na');
    return { vehicle: v, docs };
  });

  const totalAlerts = countAlerts(conductorDocs) + vehicleSections.reduce((sum, s) => sum + countAlerts(s.docs), 0);
  const companyName = contact?.companyName || 'Radiomóvil';

  const DocSection = ({ title, color, items }: { title: string; color: string; items: typeof conductorDocs }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <p className={`text-[8px] font-black uppercase tracking-widest mb-3 ${color}`}>{title}</p>
        <div className="space-y-2">
          {items.map(d => (
            <DocRow key={d.contextKey} {...d}
              uploading={uploading === d.contextKey}
              {...rowProps} />
          ))}
        </div>
      </div>
    );
  };

  const GroupedDocs = ({ docs }: { docs: typeof conductorDocs }) => {
    const expired = docs.filter(d => d.status === 'expired');
    const urgent  = docs.filter(d => d.status === 'urgent');
    const soon    = docs.filter(d => d.status === 'soon');
    const ok      = docs.filter(d => d.status === 'ok');
    const missing = docs.filter(d => d.status === 'missing');
    return (
      <div className="space-y-4">
        <DocSection title="🔴 Vencidos"              color="text-red-400"    items={expired} />
        <DocSection title="🟠 Urgente (< 7 días)"    color="text-orange-400" items={urgent} />
        <DocSection title="🟡 Por vencer"            color="text-amber-400"  items={soon} />
        <DocSection title="⚪ Sin fecha registrada"  color="text-zinc-500"   items={missing} />
        {ok.length > 0 && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest mb-3 text-emerald-600">✓ Al día ({ok.length})</p>
            <div className="space-y-2">
              {ok.map(d => (
                <DocRow key={d.contextKey} {...d}
                  uploading={uploading === d.contextKey}
                  {...rowProps} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f1117]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div className="bg-[#1B1F24] border-b border-white/5 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black text-[#C29329] uppercase tracking-[0.25em]">{companyName}</p>
            <p className="text-[7px] text-zinc-600 uppercase tracking-widest">Portal del conductor</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${totalAlerts > 0 ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/20 text-emerald-500'}`}>
            {totalAlerts > 0 ? `${totalAlerts} alerta${totalAlerts !== 1 ? 's' : ''}` : 'Al día'}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">

        {/* ── Ficha personal completa ── */}
        <div className="bg-[#1B1F24] rounded-2xl border border-white/5 overflow-hidden">
          {/* Nombre + móvil */}
          <div className="px-5 py-4 bg-black/20 border-b border-white/5 flex items-center gap-3">
            <div className="bg-[#C29329] text-black font-black px-3 py-1.5 rounded-xl text-sm italic shrink-0">
              {conductor.numeroMovil || '—'}
            </div>
            <div>
              <p className="text-white font-black uppercase tracking-widest text-sm leading-tight">{conductor.nombre}</p>
              <p className="text-zinc-600 text-[8px] uppercase tracking-widest font-mono">{conductor.rut}</p>
            </div>
          </div>

          {/* Datos de contacto */}
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-3">Contacto</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoRow label="Celular"       value={conductor.celular} />
              <InfoRow label="Correo"        value={conductor.email} />
              <div className="col-span-2"><InfoRow label="Dirección" value={conductor.direccion ? `${conductor.direccion}${conductor.comuna ? ', ' + conductor.comuna : ''}` : conductor.comuna} /></div>
            </div>
          </div>

          {/* Datos personales */}
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-3">Datos Personales</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoRow label="Fecha de nacimiento" value={conductor.fechaNacimiento} />
              <InfoRow label="Clase licencia"      value={conductor.claseLicencia} />
              <InfoRow label="Ley licencia"        value={conductor.leyLicencia} />
              <InfoRow label="Municipalidad lic."  value={conductor.municipalidadLicencia} />
            </div>
          </div>

          {/* Vehículos asignados */}
          <div className="px-5 py-4">
            <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-3">
              {vehicles.length} vehículo{vehicles.length !== 1 ? 's' : ''} asignado{vehicles.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {vehicles.map(v => (
                <div key={v.patente} className="flex items-center gap-3 py-2 border-b border-white/[0.03] last:border-0">
                  <span className="bg-white/5 text-zinc-300 font-black px-2 py-1 rounded-lg text-[9px] italic shrink-0">{v.patente}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white uppercase">{v.marca} {v.modelo}</p>
                    <p className="text-[8px] text-zinc-600 uppercase">{v.tipo} · {v.color} · {v.año}</p>
                  </div>
                  <span className={`text-[7px] font-black px-2 py-0.5 rounded-full shrink-0 ${v.statusOperativo === 'Activo' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>
                    {v.statusOperativo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Documentos personales del conductor ── */}
        {conductorDocs.length > 0 && (
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-4">Documentos Personales</p>
            <GroupedDocs docs={conductorDocs} />
          </div>
        )}

        {/* ── Secciones por vehículo ── */}
        {vehicleSections.map(({ vehicle, docs }) => (
          <div key={vehicle.patente} className="bg-[#1B1F24] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 bg-black/20 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-white/5 text-zinc-300 font-black px-2 py-1 rounded-lg text-[10px] italic">{vehicle.patente}</span>
                <div>
                  <p className="text-white font-black uppercase tracking-widest text-[11px]">{vehicle.marca} {vehicle.modelo}</p>
                  <p className="text-zinc-600 text-[8px] uppercase tracking-widest">{vehicle.tipo} · {vehicle.año}</p>
                </div>
              </div>
              <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${vehicle.statusOperativo === 'Activo' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>
                {vehicle.statusOperativo}
              </span>
            </div>
            <div className="p-5">
              {docs.length > 0 ? <GroupedDocs docs={docs} /> : (
                <p className="text-center text-[9px] text-zinc-600 uppercase tracking-widest py-4">Todos los documentos al día</p>
              )}
            </div>
          </div>
        ))}

        {vehicles.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-3xl mb-3">🚗</p>
            <p className="text-xs font-black uppercase tracking-widest text-zinc-600">Sin vehículos asignados</p>
          </div>
        )}

        {/* ── Contacto del encargado ── */}
        {contact && (contact.adminName || contact.contactEmail || contact.contactWhatsApp) && (
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-3">Contacto del encargado</p>
            {contact.adminName  && <p className="text-sm font-black text-white mb-0.5">{contact.adminName}</p>}
            {contact.adminTitle && <p className="text-[9px] text-zinc-500 mb-3">{contact.adminTitle}</p>}
            <div className="space-y-2">
              {contact.contactEmail && (
                <a href={`mailto:${contact.contactEmail}`} className="flex items-center gap-2 text-[10px] text-zinc-400 hover:text-white transition-colors">
                  <span>📧</span><span>{contact.contactEmail}</span>
                </a>
              )}
              {contact.contactWhatsApp && (
                <a href={`https://wa.me/${contact.contactWhatsApp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-[10px] text-zinc-400 hover:text-white transition-colors">
                  <span>📱</span><span>{contact.contactWhatsApp}</span>
                </a>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-[7px] text-zinc-700 uppercase tracking-widest pb-4">
          {companyName} · Sistema de Gestión Documental
        </p>
      </div>
    </div>
  );
};

export default ConductorPortal;
