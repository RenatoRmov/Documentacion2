import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { vehicleService } from '../services/vehicleService';
import { settingsService, PortalContact } from '../services/settingsService';

const PORTAL_DOCS: { docKey: keyof Vehicle; label: string }[] = [
  { docKey: 'vencimientoPermisoCirculacion',  label: 'Permiso de Circulación' },
  { docKey: 'vencimientoRevisionTecnica',     label: 'Revisión Técnica' },
  { docKey: 'vencimientoSOAP',               label: 'SOAP' },
  { docKey: 'vencimientoPadron',             label: 'Padrón' },
  { docKey: 'vencimientoSeguroAccidentes',   label: 'Seguro de Accidentes' },
  { docKey: 'vencimientoSeguroAsiento',      label: 'Seguro de Asiento' },
  { docKey: 'vencimientoControlTaximetro',   label: 'Control de Taxímetro' },
  { docKey: 'vencimientoSeguroVidaConductor', label: 'Seguro Vida Conductor' },
  { docKey: 'vigenciaLicenciaHasta',         label: 'Licencia de Conducir' },
  { docKey: 'vigenciaCarnetHasta',           label: 'Carnet de Conductor' },
];

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

function fromInputDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
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

interface DocRowProps {
  docKey: string;
  label: string;
  value: string;
  status: DocStatus;
  editing: string | null;
  editVal: string;
  saving: boolean;
  saved: Set<string>;
  onStartEdit: (key: string, val: string) => void;
  onEditValChange: (val: string) => void;
  onSave: (key: string) => void;
  onCancel: () => void;
}

const DocRow: React.FC<DocRowProps> = ({
  docKey, label, value, status,
  editing, editVal, saving, saved,
  onStartEdit, onEditValChange, onSave, onCancel,
}) => {
  const meta      = STATUS_META[status];
  const isEditing = editing === docKey;
  const wasSaved  = saved.has(docKey);

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${meta.text}`}>{label}</p>
          {!isEditing && (
            <p className="text-[10px] text-zinc-300 font-bold">
              {formatDate(value)}
              {(status === 'expired' || status === 'urgent' || status === 'soon') && (
                <span className={`ml-2 text-[8px] font-black ${meta.text}`}>· {daysLabel(value)}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {wasSaved && !isEditing && (
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✓ Guardado</span>
          )}
          {!isEditing && !wasSaved && status !== 'ok' && (
            <button onClick={() => onStartEdit(docKey, value)}
              className="text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
              Actualizar
            </button>
          )}
          {!isEditing && !wasSaved && status === 'ok' && (
            <button onClick={() => onStartEdit(docKey, value)}
              className="text-[7px] font-black uppercase tracking-widest text-zinc-700 hover:text-zinc-500 transition-colors">
              Editar
            </button>
          )}
        </div>
      </div>
      {isEditing && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5 bg-black/20">
          <input
            type="date"
            value={editVal}
            onChange={e => onEditValChange(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C29329]/50 transition-colors"
          />
          <div className="flex gap-2">
            <button onClick={() => onSave(docKey)} disabled={saving || !editVal}
              className="flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[#C29329]/20 border border-[#C29329]/40 text-[#C29329] hover:bg-[#C29329]/30 transition-all disabled:opacity-30">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={onCancel} disabled={saving}
              className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10 text-zinc-500 hover:text-white transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ConductorPortal: React.FC<{ token: string }> = ({ token }) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [contact, setContact] = useState<PortalContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      vehicleService.fetchVehicleByToken(token),
      settingsService.loadContact(),
    ]).then(([v, c]) => {
      if (!v) { setError('Enlace inválido o no encontrado.'); return; }
      setVehicle(v);
      setContact(c);
    }).catch(() => setError('Error de conexión. Intenta de nuevo.')).finally(() => setLoading(false));
  }, [token]);

  const startEdit = (key: string, currentVal: string) => {
    setEditing(key);
    setEditVal(toInputDate(currentVal));
  };

  const handleSave = async (key: string) => {
    if (!vehicle) return;
    setSaving(true);
    try {
      const dateValue = fromInputDate(editVal);
      const updated = await vehicleService.updateVehicleByToken(token, { [key]: dateValue } as Partial<Vehicle>);
      setVehicle(updated);
      setEditing(null);
      setSaved(prev => new Set([...prev, key]));
      setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(key); return n; }), 3000);
    } catch {
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#C29329] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 text-xs uppercase tracking-widest">Cargando portal...</p>
      </div>
    </div>
  );

  if (error || !vehicle) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Enlace no válido</p>
        <p className="text-zinc-500 text-xs">{error ?? 'El enlace no corresponde a ningún vehículo registrado.'}</p>
      </div>
    </div>
  );

  const docs = PORTAL_DOCS.map(d => ({
    docKey: d.docKey,
    label:  d.label,
    value:  String((vehicle as unknown as Record<string, unknown>)[d.docKey] ?? ''),
    status: getDocStatus(String((vehicle as unknown as Record<string, unknown>)[d.docKey] ?? '')),
  })).filter(d => d.status !== 'na');

  const expired = docs.filter(d => d.status === 'expired');
  const urgent  = docs.filter(d => d.status === 'urgent');
  const soon    = docs.filter(d => d.status === 'soon');
  const ok      = docs.filter(d => d.status === 'ok');
  const missing = docs.filter(d => d.status === 'missing');

  const alertCount  = expired.length + urgent.length + soon.length;
  const companyName = contact?.companyName || 'Radiomóvil';

  const rowProps = { editing, editVal, saving, saved, onStartEdit: startEdit, onEditValChange: setEditVal, onSave: handleSave, onCancel: () => setEditing(null) };

  const Section = ({ title, color, items }: { title: string; color: string; items: typeof docs }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <p className={`text-[8px] font-black uppercase tracking-widest mb-3 ${color}`}>{title}</p>
        <div className="space-y-2">
          {items.map(d => <DocRow key={d.docKey} {...d} {...rowProps} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0f1117]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div className="bg-[#1B1F24] border-b border-white/5 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black text-[#C29329] uppercase tracking-[0.25em]">{companyName}</p>
            <p className="text-[7px] text-zinc-600 uppercase tracking-widest">Portal de documentos</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${alertCount > 0 ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/20 text-emerald-500'}`}>
            {alertCount > 0 ? `${alertCount} alerta${alertCount !== 1 ? 's' : ''}` : 'Al día'}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">

        {/* Vehicle card */}
        <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#C29329] text-black font-black px-3 py-1.5 rounded-xl text-sm italic">
                {vehicle.id}
              </div>
              <div>
                <p className="text-white font-black uppercase tracking-widest text-sm">{vehicle.patente}</p>
                <p className="text-zinc-600 text-[8px] uppercase tracking-widest">{vehicle.marca} {vehicle.modelo} {vehicle.año}</p>
              </div>
            </div>
            <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${vehicle.statusOperativo === 'Activo' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>
              {vehicle.statusOperativo}
            </span>
          </div>
          <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Conductor</p>
              <p className="text-[10px] font-bold text-white">{vehicle.nombreConductor || '—'}</p>
            </div>
            <div>
              <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">RUT</p>
              <p className="text-[10px] font-bold text-white">{vehicle.rutConductor || '—'}</p>
            </div>
            <div>
              <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Celular</p>
              <p className="text-[10px] font-bold text-white">{vehicle.celular || '—'}</p>
            </div>
            <div>
              <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mb-1">Correo</p>
              <p className="text-[10px] font-bold text-white truncate">{vehicle.email || '—'}</p>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="space-y-5">
          <Section title="🔴 Documentos vencidos"       color="text-red-400"    items={expired} />
          <Section title="🟠 Urgente — menos de 7 días" color="text-orange-400" items={urgent} />
          <Section title="🟡 Por vencer"                color="text-amber-400"  items={soon} />
          <Section title="⚪ Sin fecha registrada"      color="text-zinc-500"   items={missing} />
          {ok.length > 0 && (
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest mb-3 text-emerald-600">✓ Al día ({ok.length})</p>
              <div className="space-y-2">
                {ok.map(d => <DocRow key={d.docKey} {...d} {...rowProps} />)}
              </div>
            </div>
          )}
        </div>

        {docs.every(d => d.status === 'ok') && missing.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-500">Toda la documentación al día</p>
          </div>
        )}

        {/* Contact */}
        {contact && (contact.adminName || contact.contactEmail || contact.contactWhatsApp) && (
          <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5">
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-3">Contacto del encargado</p>
            {contact.adminName && <p className="text-sm font-black text-white mb-0.5">{contact.adminName}</p>}
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
