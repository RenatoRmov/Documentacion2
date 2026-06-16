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
  vencimientoControlTaximetro:   'urlControlTaximetro',
};

// Mapeo campo → etiqueta legible para el log de actividad
const FIELD_LABEL_MAP: Record<string, string> = {
  vigenciaCarnetHasta:           'Carnet de Identidad',
  vigenciaLicenciaHasta:         'Licencia de Conducir',
  municipalidadLicencia:         'Municipalidad (Licencia)',
  vencimientoPermisoCirculacion: 'Permiso de Circulación',
  municipalidadPermiso:          'Municipalidad (Permiso de Circulación)',
  vencimientoRevisionTecnica:    'Revisión Técnica',
  vencimientoSOAP:               'SOAP',
  vencimientoSeguroAsiento:      'Seguro de Asientos',
  aseguradoraAsiento:            'Aseguradora (Seguro de Asientos)',
  vencimientoControlTaximetro:   'Control de Taxímetro',
  vencimientoPadron:             'Padrón',
  urlCarnet:                     'Carnet de Identidad (archivo)',
  urlLicencia:                   'Licencia de Conducir (archivo)',
  urlPermisoCirculacion:         'Permiso de Circulación (archivo)',
  urlRevisionTecnica:            'Revisión Técnica (archivo)',
  urlSOAP:                       'SOAP (archivo)',
  urlPadron:                     'Padrón (archivo)',
  urlSeguroAsiento:              'Seguro de Asientos (archivo)',
  urlControlTaximetro:           'Control de Taxímetro (archivo)',
};

const CONDUCTOR_DOCS: { docKey: keyof Conductor; label: string; extraField?: { key: keyof Conductor; label: string; placeholder?: string } }[] = [
  { docKey: 'vigenciaCarnetHasta',   label: 'Carnet de Identidad' },
  { docKey: 'vigenciaLicenciaHasta', label: 'Licencia de Conducir',
    extraField: { key: 'municipalidadLicencia', label: 'Municipalidad que la otorga', placeholder: 'Ej: Santiago, Las Condes...' } },
];

const VEHICLE_DOCS: { docKey: keyof Vehicle; label: string; fileOnly?: boolean; hasTaxToggle?: boolean; extraField?: { key: keyof Vehicle; label: string; placeholder?: string } }[] = [
  { docKey: 'vencimientoPermisoCirculacion', label: 'Permiso de Circulación',
    extraField: { key: 'municipalidadPermiso', label: 'Municipalidad que lo otorga', placeholder: 'Ej: Santiago, Las Condes...' } },
  { docKey: 'vencimientoRevisionTecnica',    label: 'Revisión Técnica' },
  { docKey: 'vencimientoSOAP',               label: 'SOAP' },
  { docKey: 'vencimientoSeguroAsiento',      label: 'Seguro de Asientos',
    extraField: { key: 'aseguradoraAsiento', label: 'Aseguradora' } },
  { docKey: 'vencimientoControlTaximetro',   label: 'Control de Taxímetro', hasTaxToggle: true },
  { docKey: 'vencimientoPadron',             label: 'Padrón', fileOnly: true },
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
  if (dateStr.toLowerCase().trim() === 'sujeto a control') return 'Sin fecha';
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

type TaxStatus = 'Sin Información' | 'SUJETO' | 'No Aplica';

function getTaxStatusFromValue(val: string): TaxStatus {
  const lower = (val || '').toLowerCase().trim();
  if (lower === 'no aplica') return 'No Aplica';
  if (!lower || lower === 'sin información') return 'Sin Información';
  return 'SUJETO'; // fecha real o 'sujeto a control'
}

// ─── DocRow ───────────────────────────────────────────────────────────────────

interface DocRowProps {
  contextKey:    string;
  label:         string;
  value:         string;
  status:        DocStatus;
  urlValue?:     string;
  fileOnly?:     boolean;
  hasTaxToggle?: boolean;
  extraField?:   { key: string; label: string; value: string; placeholder?: string };
  editing:       string | null;
  saving:        boolean;
  uploading:     boolean;
  saved:         Set<string>;
  onStartEdit: (contextKey: string) => void;
  onSave: (contextKey: string, dateVal: string, extra?: Record<string, string>) => void;
  onCancel: () => void;
  onUpload: (contextKey: string, file: File) => Promise<void>;
}

const DocRow: React.FC<DocRowProps> = ({
  contextKey, label, value, status, urlValue, fileOnly, hasTaxToggle, extraField,
  editing, saving, uploading, saved,
  onStartEdit, onSave, onCancel, onUpload,
}) => {
  const meta      = STATUS_META[status];
  const isEditing = editing === contextKey;
  const wasSaved  = saved.has(contextKey);
  const fileRef   = useRef<HTMLInputElement>(null);
  const fieldKey  = contextKey.slice(contextKey.indexOf(':') + 1);
  const hasUrlField = fieldKey in DATE_TO_URL_KEY;

  // Estado local de fecha, municipalidad y toggle de taxímetro
  const [localDate,      setLocalDate]      = useState('');
  const [localExtra,     setLocalExtra]     = useState('');
  const [localTaxStatus, setLocalTaxStatus] = useState<TaxStatus>('Sin Información');
  const wasEditing = useRef(false);
  useEffect(() => {
    if (isEditing && !wasEditing.current) {
      setLocalDate(toInputDate(value));
      if (extraField) setLocalExtra(extraField.value || '');
      if (hasTaxToggle) setLocalTaxStatus(getTaxStatusFromValue(value));
    }
    wasEditing.current = isEditing;
  });

  // Valor a guardar según el toggle del taxímetro
  const taxSaveValue = (): string => {
    if (localTaxStatus === 'No Aplica')       return 'No Aplica';
    if (localTaxStatus === 'Sin Información')  return '';
    return localDate || 'Sujeto a Control';
  };

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${meta.text}`}>{label}</p>
          {!isEditing && (
            <div className="flex items-center gap-2 flex-wrap">
              {status === 'na' ? (
                <p className="text-[10px] text-zinc-600 font-bold italic">No aplica para este vehículo</p>
              ) : fileOnly ? (
                <>
                  <p className="text-[10px] text-zinc-300 font-bold">
                    {urlValue ? 'Documento adjunto' : 'Sin documento adjunto'}
                  </p>
                  {urlValue && (
                    <a href={urlValue} target="_blank" rel="noopener noreferrer"
                      className="text-[8px] font-black text-emerald-400 bg-emerald-900/20 border border-emerald-700/20 px-2 py-0.5 rounded-lg hover:bg-emerald-900/30 transition-all whitespace-nowrap">
                      📎 Ver doc
                    </a>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
        {/* Botón de acción — visible también para 'na' cuando tiene toggle de taxímetro */}
        {(status !== 'na' || hasTaxToggle) && (
          <div className="flex items-center gap-2 shrink-0">
            {wasSaved && !isEditing && (
              <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✓ Guardado</span>
            )}
            {!isEditing && !wasSaved && fileOnly && (
              <button onClick={() => onStartEdit(contextKey)}
                className="text-xs font-black uppercase tracking-wide px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10 min-w-[88px]">
                {urlValue ? 'Reemplazar' : 'Adjuntar'}
              </button>
            )}
            {!isEditing && !wasSaved && !fileOnly && status === 'ok' && (
              <button onClick={() => onStartEdit(contextKey)}
                className="text-[9px] font-black uppercase tracking-wide px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 transition-colors border border-white/5 hover:border-white/10">
                Editar
              </button>
            )}
            {!isEditing && !wasSaved && !fileOnly && status !== 'ok' && (
              <button onClick={() => onStartEdit(contextKey)}
                className="text-xs font-black uppercase tracking-wide px-4 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10 min-w-[88px]">
                {status === 'na' ? 'Cambiar' : 'Actualizar'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Panel de edición — se abre también para 'na' cuando tiene toggle de taxímetro */}
      {isEditing && (hasTaxToggle || status !== 'na') && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/8 bg-[#13161c]">

          {/* Toggle de taxímetro */}
          {hasTaxToggle && (
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                ¿Aplica taxímetro en este vehículo?
              </label>
              <select
                value={localTaxStatus}
                onChange={e => setLocalTaxStatus(e.target.value as TaxStatus)}
                className="w-full bg-[#1B1F24] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-amber-400 transition-colors">
                <option value="Sin Información">— Sin información</option>
                <option value="SUJETO">📅 Sujeto a control (tiene taxímetro)</option>
                <option value="No Aplica">✗ No aplica (sin taxímetro)</option>
              </select>
            </div>
          )}

          {/* Fecha de vencimiento */}
          {!fileOnly && (!hasTaxToggle || localTaxStatus === 'SUJETO') && (
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={localDate}
                onChange={e => setLocalDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
              />
            </div>
          )}

          {/* Municipalidad (opcional, solo para licencia y permiso de circulación) */}
          {extraField && (!hasTaxToggle || localTaxStatus === 'SUJETO') && (
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                {extraField.label}
              </label>
              <input
                type="text"
                value={localExtra}
                onChange={e => setLocalExtra(e.target.value)}
                placeholder={extraField.placeholder ?? ''}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          )}

          {/* Subir documento */}
          {hasUrlField && (!hasTaxToggle || localTaxStatus === 'SUJETO') && (
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                {fileOnly ? 'Foto o PDF del Padrón' : 'Foto o PDF del documento'}
              </label>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.heic,.heif"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(contextKey, f); e.target.value = ''; }}
              />
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={`w-full py-3 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-center gap-2 ${
                  uploading
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-400 animate-pulse'
                    : urlValue
                    ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
                    : 'bg-[#C29329]/10 border-[#C29329]/30 text-[#C29329] hover:bg-[#C29329]/20'
                }`}>
                {uploading ? '⏳ Subiendo...' : urlValue ? '📎 Reemplazar documento' : '📎 Adjuntar foto o PDF'}
              </button>
              {urlValue && !uploading && (
                <a href={urlValue} target="_blank" rel="noopener noreferrer"
                  className="block text-center text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors py-0.5">
                  Ver documento actual →
                </a>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onSave(
                contextKey,
                hasTaxToggle ? taxSaveValue() : fileOnly ? '' : localDate,
                extraField ? { [extraField.key]: localExtra } : undefined
              )}
              disabled={saving || (hasTaxToggle
                ? false
                : fileOnly ? !urlValue : !localDate && !urlValue
              )}
              className="flex-1 py-3 rounded-lg text-[11px] font-black uppercase tracking-wide bg-[#C29329] text-black hover:bg-amber-500 transition-all disabled:opacity-30">
              {saving ? 'Guardando...' : fileOnly ? '✓ Listo' : '✓ Guardar'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-5 py-3 rounded-lg text-[11px] font-black uppercase tracking-wide border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all">
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

// Tipo compartido para las filas de documentos
interface DocItem {
  contextKey:    string;
  label:         string;
  value:         string;
  status:        DocStatus;
  urlValue?:     string;
  fileOnly?:     boolean;
  hasTaxToggle?: boolean;
  extraField?:   { key: string; label: string; value: string; placeholder?: string };
}

// Props de callbacks compartidos — se pasan desde ConductorPortal hacia abajo
interface RowHandlers {
  editing:      string | null;
  saving:       boolean;
  saved:        Set<string>;
  onStartEdit:  (key: string) => void;
  onSave:       (key: string, date: string, extra?: Record<string, string>) => void;
  onCancel:     () => void;
  onUpload:     (key: string, file: File) => Promise<void>;
}

// ─── DocSection y GroupedDocs DEBEN estar fuera de ConductorPortal ───────────
// Si se definen dentro del componente padre, React los trata como tipos nuevos
// en cada render, desmontando y remontando los DocRow (con pérdida de estado).

const DocSection: React.FC<{
  title:     string;
  color:     string;
  items:     DocItem[];
  uploading: string | null;
  handlers:  RowHandlers;
}> = ({ title, color, items, uploading, handlers }) => {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-[8px] font-black uppercase tracking-widest mb-3 ${color}`}>{title}</p>
      <div className="space-y-2">
        {items.map(d => (
          <DocRow key={d.contextKey} {...d}
            uploading={uploading === d.contextKey}
            {...handlers} />
        ))}
      </div>
    </div>
  );
};

const GroupedDocs: React.FC<{
  docs:      DocItem[];
  uploading: string | null;
  handlers:  RowHandlers;
}> = ({ docs, uploading, handlers }) => {
  const expired = docs.filter(d => d.status === 'expired');
  const urgent  = docs.filter(d => d.status === 'urgent');
  const soon    = docs.filter(d => d.status === 'soon');
  const ok      = docs.filter(d => d.status === 'ok');
  const missing = docs.filter(d => d.status === 'missing');
  const na      = docs.filter(d => d.status === 'na');
  return (
    <div className="space-y-4">
      <DocSection title="🔴 Vencidos"             color="text-red-400"    items={expired} uploading={uploading} handlers={handlers} />
      <DocSection title="🟠 Urgente (< 7 días)"   color="text-orange-400" items={urgent}  uploading={uploading} handlers={handlers} />
      <DocSection title="🟡 Por vencer"           color="text-amber-400"  items={soon}    uploading={uploading} handlers={handlers} />
      <DocSection title="⚪ Sin fecha registrada" color="text-zinc-500"   items={missing} uploading={uploading} handlers={handlers} />
      {ok.length > 0 && (
        <div>
          <p className="text-[8px] font-black uppercase tracking-widest mb-3 text-emerald-600">✓ Al día ({ok.length})</p>
          <div className="space-y-2">
            {ok.map(d => (
              <DocRow key={d.contextKey} {...d}
                uploading={uploading === d.contextKey}
                {...handlers} />
            ))}
          </div>
        </div>
      )}
      <DocSection title="— No aplica"             color="text-zinc-700"   items={na}      uploading={uploading} handlers={handlers} />
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const ConductorPortal: React.FC<{ token?: string; rut?: string }> = ({ token, rut: rutProp }) => {
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
        const c = token
          ? await conductorService.fetchConductorByToken(token)
          : await conductorService.fetchConductorByRut(rutProp!);
        if (!c) { setError('Conductor no encontrado.'); return; }
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
  }, [token, rutProp]);

  const startEdit = (contextKey: string) => setEditing(contextKey);

  const handleSave = async (contextKey: string, dateVal: string, extra?: Record<string, string>) => {
    if (!conductor) return;
    setSaving(true);
    try {
      const colonIdx = contextKey.indexOf(':');
      const ctx      = contextKey.slice(0, colonIdx);
      const fieldKey = contextKey.slice(colonIdx + 1);
      const iso      = dateVal;

      if (ctx === 'conductor') {
        await conductorService.updateConductor(conductor.rut, { [fieldKey]: iso, ...extra } as Partial<Conductor>);
        const displayVal = fromISODate(iso) || iso;
        setConductor(prev => prev ? { ...prev, [fieldKey]: displayVal, ...extra } : null);
      } else {
        const updated = await vehicleService.updateVehicle(ctx, { [fieldKey]: iso, ...extra } as Partial<Vehicle>);
        setVehicles(prev => prev.map(v => v.patente === ctx ? updated : v));
      }
      setEditing(null);
      setSaved(prev => new Set([...prev, contextKey]));
      setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(contextKey); return n; }), 3000);
      // Registro de actividad para el resumen diario al encargado (fire-and-forget)
      fetch('/api/log-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conductor_rut:    conductor.rut,
          conductor_nombre: conductor.nombre,
          movil:            conductor.numeroMovil ?? '',
          patente:          ctx === 'conductor' ? null : ctx,
          field_label:      FIELD_LABEL_MAP[fieldKey] ?? fieldKey,
        }),
      }).catch(() => {});
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
      // Registro de actividad (fire-and-forget)
      fetch('/api/log-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conductor_rut:    conductor.rut,
          conductor_nombre: conductor.nombre,
          movil:            conductor.numeroMovil ?? '',
          patente:          ctx === 'conductor' ? null : ctx,
          field_label:      FIELD_LABEL_MAP[urlKey] ?? urlKey,
        }),
      }).catch(() => {});
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

  const handlers: RowHandlers = {
    editing, saving,
    saved, onStartEdit: startEdit,
    onSave: handleSave, onCancel: () => setEditing(null),
    onUpload: handleUpload,
  };

  const conductorDocs = CONDUCTOR_DOCS.map(d => {
    const fieldKey   = String(d.docKey);
    const value      = String((conductor as unknown as Record<string, unknown>)[fieldKey] ?? '');
    const urlKey     = DATE_TO_URL_KEY[fieldKey];
    const urlValue   = urlKey ? String((conductor as unknown as Record<string, unknown>)[urlKey] ?? '') : undefined;
    const extraField = d.extraField ? {
      key:         String(d.extraField.key),
      label:       d.extraField.label,
      value:       String((conductor as unknown as Record<string, unknown>)[String(d.extraField.key)] ?? ''),
      placeholder: d.extraField.placeholder,
    } : undefined;
    return { contextKey: `conductor:${fieldKey}`, label: d.label, value, status: getDocStatus(value), urlValue: urlValue || undefined, extraField };
  });

  const vehicleSections = vehicles.map(v => {
    const docs = VEHICLE_DOCS.map(d => {
      const fieldKey = String(d.docKey);
      const value    = String((v as unknown as Record<string, unknown>)[fieldKey] ?? '');
      const urlKey   = DATE_TO_URL_KEY[fieldKey];
      const urlValue = urlKey ? String((v as unknown as Record<string, unknown>)[urlKey] ?? '') : undefined;
      // Para documentos sin fecha (fileOnly), el estado depende de si hay archivo adjunto
      const status     = d.fileOnly
        ? ((urlValue ? 'ok' : 'missing') as DocStatus)
        : getDocStatus(value);
      const extraField = d.extraField ? {
        key:         String(d.extraField.key),
        label:       d.extraField.label,
        value:       String((v as unknown as Record<string, unknown>)[String(d.extraField.key)] ?? ''),
        placeholder: d.extraField.placeholder,
      } : undefined;
      return { contextKey: `${v.patente}:${fieldKey}`, label: d.label, value, status, urlValue: urlValue || undefined, fileOnly: d.fileOnly, hasTaxToggle: d.hasTaxToggle, extraField };
    });
    return { vehicle: v, docs };
  });

  const totalAlerts = countAlerts(conductorDocs) + vehicleSections.reduce((sum, s) => sum + countAlerts(s.docs), 0);
  const companyName = contact?.companyName || 'Radiomóvil';

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
            <GroupedDocs docs={conductorDocs} uploading={uploading} handlers={handlers} />
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
              {docs.length > 0 ? <GroupedDocs docs={docs} uploading={uploading} handlers={handlers} /> : (
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
