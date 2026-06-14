import React, { useState, useEffect, useRef } from 'react';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';
import { conductorService } from '../services/conductorService';
import { uploadDoc } from '../services/storageService';

// ─── Tipos exportados ────────────────────────────────────────────────────────

export interface ConductorForm {
  rut: string; numeroMovil: string; nombre: string; fechaNacimiento: string;
  celular: string; email: string; direccion: string; comuna: string;
  claseLicencia: string; leyLicencia: string; municipalidadLicencia: string;
  vigenciaCarnetDesde: string; vigenciaCarnetHasta: string;
  vigenciaLicenciaDesde: string; vigenciaLicenciaHasta: string;
  vencimientoSeguroVida: string; aseguradoraVida: string;
  urlCarnet?: string; urlLicencia?: string;
}

export interface VehicleEntry {
  patente: string; tipo: string; marca: string; modelo: string;
  color: string; año: number; asientos: number;
  estado: 'Casa' | 'Externo'; statusOperativo: 'Activo' | 'Inactivo';
  nombrePropietario: string; rutPropietario: string;
  vencimientoPadron: string; vencimientoPermisoCirculacion: string;
  municipalidadPermiso: string; vencimientoRevisionTecnica: string;
  vencimientoSOAP: string; vencimientoControlTaximetro: string;
  certificadoAntecedentes: string; prestacionSS: string; contratoArriendo: string;
  vencimientoSeguroAccidentes: string; lugarSeguroAccidentes: string;
  vencimientoSeguroAsiento: string; aseguradoraAsiento: string;
  urlPadron?: string; urlPermisoCirculacion?: string;
  urlRevisionTecnica?: string; urlSOAP?: string; urlSeguroAsiento?: string;
}

// ─── Valores vacíos ──────────────────────────────────────────────────────────

const EMPTY_CONDUCTOR: ConductorForm = {
  rut: '', numeroMovil: '', nombre: '', fechaNacimiento: '',
  celular: '', email: '', direccion: '', comuna: '',
  claseLicencia: '', leyLicencia: '', municipalidadLicencia: '',
  vigenciaCarnetDesde: '', vigenciaCarnetHasta: '',
  vigenciaLicenciaDesde: '', vigenciaLicenciaHasta: '',
  vencimientoSeguroVida: '', aseguradoraVida: '',
  urlCarnet: '', urlLicencia: '',
};

const EMPTY_VEHICLE: VehicleEntry = {
  patente: '', tipo: 'AUTOMOVIL', marca: '', modelo: '', color: '',
  año: 2024, asientos: 5, estado: 'Externo', statusOperativo: 'Activo',
  nombrePropietario: '', rutPropietario: '',
  vencimientoPadron: '', vencimientoPermisoCirculacion: '',
  municipalidadPermiso: '', vencimientoRevisionTecnica: '',
  vencimientoSOAP: '', vencimientoControlTaximetro: 'Sin Información',
  certificadoAntecedentes: 'Sin Información', prestacionSS: 'Sin Información',
  contratoArriendo: 'Sin Información',
  vencimientoSeguroAccidentes: '', lugarSeguroAccidentes: '',
  vencimientoSeguroAsiento: '', aseguradoraAsiento: '',
  urlPadron: '', urlPermisoCirculacion: '',
  urlRevisionTecnica: '', urlSOAP: '', urlSeguroAsiento: '',
};

// ─── Helpers de campos ───────────────────────────────────────────────────────

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5 min-w-0">
    <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block px-0.5">{label}</label>
    {children}
  </div>
);

const inputCls = (date = false) =>
  `w-full ${date ? 'px-1.5 text-[10px]' : 'px-3 text-[11px]'} py-3 bg-[#0A0C0E] border border-white/5 rounded-xl font-semibold text-zinc-200 focus:border-[#C29329]/40 outline-none transition-all placeholder:text-zinc-800 min-w-0`;

type ChangeEvt = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>;

function normalize(name: string, value: string, type: string): string {
  if (type === 'date') return fromISODate(value);
  // RUT formatting only — no toUpperCase on every keystroke (cursor jumps to end)
  if (name === 'rutConductor' || name === 'rut' || name === 'rutPropietario') {
    let c = value.replace(/[^0-9kK]/g, '').toUpperCase();
    if (c.length > 1) value = `${c.slice(0, -1)}-${c.slice(-1)}`;
    else value = c;
  }
  return value;
}

// ─── UploadButton ─────────────────────────────────────────────────────────────

const UploadButton = ({ url, uploading, onUpload, disabled }: {
  url?: string; uploading?: boolean;
  onUpload: (file: File) => void; disabled?: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[8px] font-black text-emerald-400 bg-emerald-900/20 border border-emerald-700/20 px-2 py-0.5 rounded-lg hover:bg-emerald-900/30 transition-all whitespace-nowrap">
          📎 Ver
        </a>
      )}
      <button type="button" disabled={uploading || disabled}
        onClick={() => inputRef.current?.click()}
        className={`text-[8px] font-black px-2 py-0.5 rounded-lg border transition-all whitespace-nowrap ${
          uploading ? 'bg-zinc-800 border-zinc-700 text-zinc-600 animate-pulse' :
          disabled ? 'opacity-30 cursor-not-allowed bg-white/5 border-white/5 text-zinc-600' :
          url ? 'bg-white/5 border-white/10 text-zinc-500 hover:text-zinc-300' :
          'bg-[#C29329]/10 border-[#C29329]/20 text-[#C29329] hover:bg-[#C29329]/20'
        }`}>
        {uploading ? '↑...' : url ? '↑ Reemplazar' : '↑ Adjuntar'}
      </button>
    </div>
  );
};

// ─── Props del wizard ────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (conductor: ConductorForm, vehicles: VehicleEntry[]) => Promise<void>;
  initialVehicles?: Vehicle[];
}

// ─── Utilidades de mapeo ─────────────────────────────────────────────────────

function vehicleToConductorForm(v: Vehicle): ConductorForm {
  return {
    rut: v.rutConductor || '',
    numeroMovil: v.id || '',
    nombre: v.nombreConductor || '',
    fechaNacimiento: v.fechaNacimiento || '',
    celular: v.celular || '',
    email: v.email || '',
    direccion: v.direccion || '',
    comuna: v.comuna || '',
    claseLicencia: v.claseLicencia || '',
    leyLicencia: v.leyLicencia || '',
    municipalidadLicencia: v.municipalidadLicencia || '',
    vigenciaCarnetDesde: v.vigenciaCarnetDesde || '',
    vigenciaCarnetHasta: v.vigenciaCarnetHasta || '',
    vigenciaLicenciaDesde: v.vigenciaLicenciaDesde || '',
    vigenciaLicenciaHasta: v.vigenciaLicenciaHasta || '',
    vencimientoSeguroVida: v.vencimientoSeguroVidaConductor || '',
    aseguradoraVida: v.aseguradoraVida || '',
    urlCarnet: v.urlCarnet || '',
    urlLicencia: v.urlLicencia || '',
  };
}

function vehicleToEntry(v: Vehicle): VehicleEntry {
  return {
    patente: v.patente, tipo: v.tipo, marca: v.marca, modelo: v.modelo,
    color: v.color, año: v.año, asientos: v.asientos,
    estado: v.estado, statusOperativo: v.statusOperativo,
    nombrePropietario: v.nombrePropietario, rutPropietario: v.rutPropietario,
    vencimientoPadron: v.vencimientoPadron,
    vencimientoPermisoCirculacion: v.vencimientoPermisoCirculacion,
    municipalidadPermiso: v.municipalidadPermiso,
    vencimientoRevisionTecnica: v.vencimientoRevisionTecnica,
    vencimientoSOAP: v.vencimientoSOAP,
    vencimientoControlTaximetro: v.vencimientoControlTaximetro,
    certificadoAntecedentes: v.certificadoAntecedentes,
    prestacionSS: v.prestacionSS, contratoArriendo: v.contratoArriendo,
    vencimientoSeguroAccidentes: v.vencimientoSeguroAccidentes,
    lugarSeguroAccidentes: v.lugarSeguroAccidentes,
    vencimientoSeguroAsiento: v.vencimientoSeguroAsiento,
    aseguradoraAsiento: v.aseguradoraAsiento,
    urlPadron: v.urlPadron || '',
    urlPermisoCirculacion: v.urlPermisoCirculacion || '',
    urlRevisionTecnica: v.urlRevisionTecnica || '',
    urlSOAP: v.urlSOAP || '',
    urlSeguroAsiento: v.urlSeguroAsiento || '',
  };
}

// ─── Componente principal ────────────────────────────────────────────────────

const VehicleWizard: React.FC<Props> = ({ isOpen, onClose, onSave, initialVehicles = [] }) => {
  const isEditing = initialVehicles.length > 0;

  const [step, setStep] = useState<1 | 2>(1);
  const [conductor, setConductor] = useState<ConductorForm>({ ...EMPTY_CONDUCTOR });
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([{ ...EMPTY_VEHICLE }]);
  const [expanded, setExpanded] = useState<number>(0);
  const [conductorStatus, setConductorStatus] = useState<'idle' | 'loading' | 'found' | 'new'>('idle');
  const [saving, setSaving] = useState(false);
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing) {
      setConductor(vehicleToConductorForm(initialVehicles[0]));
      setVehicles(initialVehicles.map(vehicleToEntry));
      setExpanded(0);
    } else {
      setConductor({ ...EMPTY_CONDUCTOR });
      setVehicles([{ ...EMPTY_VEHICLE }]);
      setExpanded(0);
    }
    setStep(1);
    setConductorStatus('idle');
    setUploadingFields(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const setUploading = (key: string, val: boolean) =>
    setUploadingFields(prev => { const s = new Set(prev); val ? s.add(key) : s.delete(key); return s; });

  // ── Conductor handlers ──

  const handleConductorChange = (e: ChangeEvt) => {
    const { name, value, type } = e.target;
    setConductor(prev => ({ ...prev, [name]: normalize(name, value, type) }));
  };

  const handleRutBlur = async () => {
    if (isEditing) return;
    const rut = conductor.rut.trim();
    if (!rut.includes('-')) return;
    setConductorStatus('loading');
    try {
      const found = await conductorService.fetchConductorByRut(rut);
      if (found) {
        setConductor(prev => ({
          ...prev,
          numeroMovil: found.numeroMovil || prev.numeroMovil,
          nombre: found.nombre, fechaNacimiento: found.fechaNacimiento,
          celular: found.celular, email: found.email,
          direccion: found.direccion, comuna: found.comuna,
          claseLicencia: found.claseLicencia, leyLicencia: found.leyLicencia,
          municipalidadLicencia: found.municipalidadLicencia,
          vigenciaCarnetDesde: found.vigenciaCarnetDesde,
          vigenciaCarnetHasta: found.vigenciaCarnetHasta,
          vigenciaLicenciaDesde: found.vigenciaLicenciaDesde,
          vigenciaLicenciaHasta: found.vigenciaLicenciaHasta,
          vencimientoSeguroVida: found.vencimientoSeguroVida,
          aseguradoraVida: found.aseguradoraVida,
          urlCarnet: found.urlCarnet || '',
          urlLicencia: found.urlLicencia || '',
        }));
        setConductorStatus('found');
      } else {
        setConductorStatus('new');
      }
    } catch { setConductorStatus('new'); }
  };

  const handleConductorUpload = async (field: 'urlCarnet' | 'urlLicencia', file: File) => {
    const rut = conductor.rut.trim();
    if (!rut) return;
    const key = `conductor-${field}`;
    setUploading(key, true);
    try {
      const path = `conductores/${rut.replace(/\./g, '')}/${field}`;
      const url = await uploadDoc(path, file);
      setConductor(prev => ({ ...prev, [field]: url }));
    } catch (err) {
      alert('Error al subir archivo');
      console.error(err);
    } finally {
      setUploading(key, false);
    }
  };

  // ── Vehicle handlers ──

  const handleVehicleChange = (idx: number, e: ChangeEvt) => {
    const { name, value, type } = e.target;
    setVehicles(prev => prev.map((v, i) =>
      i === idx ? { ...v, [name]: type === 'number' ? Number(value) : normalize(name, value, type) } : v
    ));
  };

  const handleVehicleUpload = async (idx: number, field: string, file: File) => {
    const patente = vehicles[idx].patente;
    if (!patente) return;
    const key = `${idx}-${field}`;
    setUploading(key, true);
    try {
      const path = `vehicles/${patente}/${field}`;
      const url = await uploadDoc(path, file);
      setVehicles(prev => prev.map((v, i) => i === idx ? { ...v, [field]: url } : v));
    } catch (err) {
      alert('Error al subir archivo');
      console.error(err);
    } finally {
      setUploading(key, false);
    }
  };

  const addVehicle = () => {
    setVehicles(prev => [...prev, { ...EMPTY_VEHICLE }]);
    setExpanded(vehicles.length);
  };

  const removeVehicle = (idx: number) => {
    if (vehicles.length === 1) return;
    setVehicles(prev => prev.filter((_, i) => i !== idx));
    setExpanded(Math.max(0, idx - 1));
  };

  // ── Save ──

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(conductor, vehicles);
    } finally {
      setSaving(false);
    }
  };

  // ── Taxímetro helpers (per vehicle) ──

  const getTaxStatus = (v: VehicleEntry) => {
    const val = (v.vencimientoControlTaximetro || '').toLowerCase().trim();
    if (!val || val === 'sin información') return 'Sin Información';
    if (val === 'no aplica') return 'No Aplica';
    // 'sujeto a control' o cualquier fecha real → tiene taxímetro
    return 'SUJETO';
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#1B1F24] rounded-3xl shadow-[0_50px_100px_rgba(0,0,0,0.5)] w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col border border-white/5">

        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">
              {isEditing ? `AUDITAR · ${conductor.nombre || 'CONDUCTOR'}` : 'NUEVO REGISTRO'}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <StepPill n={1} active={step === 1} done={step === 2} label="Conductor" />
              <div className="w-6 h-px bg-white/10" />
              <StepPill n={2} active={step === 2} done={false} label="Vehículos" />
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all text-xl">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* ── PASO 1: Conductor ── */}
          {step === 1 && (
            <div className="p-8 space-y-8">
              {/* RUT + status badge */}
              <div className="flex items-end gap-4">
                <div className="w-48 shrink-0">
                  <Field label="RUT Operador *">
                    <input name="rut" value={conductor.rut} onChange={handleConductorChange} onBlur={handleRutBlur}
                      className={inputCls()} placeholder="12345678-9" />
                  </Field>
                </div>
                <div className="w-24 shrink-0">
                  <Field label="N° Móvil *">
                    <input name="numeroMovil" value={conductor.numeroMovil} onChange={handleConductorChange} className={inputCls()} placeholder="3" />
                  </Field>
                </div>
                {!isEditing && conductorStatus === 'loading' && <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest animate-pulse pb-3">Buscando...</span>}
                {!isEditing && conductorStatus === 'found' && <span className="px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-900/30 text-emerald-400 mb-1">✓ Datos cargados</span>}
                {!isEditing && conductorStatus === 'new' && <span className="px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-900/20 text-amber-600 mb-1">Nuevo conductor</span>}
              </div>

              {/* Datos personales */}
              <div>
                <SectionLabel>Datos Personales</SectionLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="col-span-2"><Field label="Nombre Completo *"><input name="nombre" value={conductor.nombre} onChange={handleConductorChange} className={inputCls()} /></Field></div>
                  <Field label="Nacimiento"><input name="fechaNacimiento" type="date" value={toISODate(conductor.fechaNacimiento)} onChange={handleConductorChange} className={inputCls(true)} /></Field>
                  <Field label="Celular"><input name="celular" value={conductor.celular} onChange={handleConductorChange} className={inputCls()} /></Field>
                  <div className="col-span-2"><Field label="Email"><input name="email" type="email" value={conductor.email} onChange={handleConductorChange} className={inputCls()} /></Field></div>
                  <Field label="Dirección"><input name="direccion" value={conductor.direccion} onChange={handleConductorChange} className={inputCls()} /></Field>
                  <Field label="Comuna"><input name="comuna" value={conductor.comuna} onChange={handleConductorChange} className={inputCls()} /></Field>
                </div>
              </div>

              {/* Documentos personales */}
              <div>
                <SectionLabel>Documentos Personales</SectionLabel>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Carnet de Identidad</p>
                    <div className="flex gap-3">
                      <Field label="Desde"><input name="vigenciaCarnetDesde" type="date" value={toISODate(conductor.vigenciaCarnetDesde)} onChange={handleConductorChange} className={inputCls(true)} /></Field>
                      <Field label="Hasta *"><input name="vigenciaCarnetHasta" type="date" value={toISODate(conductor.vigenciaCarnetHasta)} onChange={handleConductorChange} className={inputCls(true)} /></Field>
                    </div>
                    <UploadButton
                      url={conductor.urlCarnet}
                      uploading={uploadingFields.has('conductor-urlCarnet')}
                      onUpload={f => handleConductorUpload('urlCarnet', f)}
                      disabled={!conductor.rut}
                    />
                  </div>
                  <div className="p-4 bg-black/20 rounded-2xl border border-white/5 space-y-3">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Licencia de Conducir</p>
                    <div className="flex gap-3">
                      <Field label="Desde"><input name="vigenciaLicenciaDesde" type="date" value={toISODate(conductor.vigenciaLicenciaDesde)} onChange={handleConductorChange} className={inputCls(true)} /></Field>
                      <Field label="Hasta *"><input name="vigenciaLicenciaHasta" type="date" value={toISODate(conductor.vigenciaLicenciaHasta)} onChange={handleConductorChange} className={inputCls(true)} /></Field>
                    </div>
                    <div className="flex gap-3">
                      <Field label="Clase"><input name="claseLicencia" value={conductor.claseLicencia} onChange={handleConductorChange} className={inputCls()} placeholder="A2, B..." /></Field>
                      <Field label="Ley"><input name="leyLicencia" value={conductor.leyLicencia} onChange={handleConductorChange} className={inputCls()} placeholder="19.495" /></Field>
                    </div>
                    <Field label="Municipalidad"><input name="municipalidadLicencia" value={conductor.municipalidadLicencia} onChange={handleConductorChange} className={inputCls()} /></Field>
                    <UploadButton
                      url={conductor.urlLicencia}
                      uploading={uploadingFields.has('conductor-urlLicencia')}
                      onUpload={f => handleConductorUpload('urlLicencia', f)}
                      disabled={!conductor.rut}
                    />
                  </div>
                  <div className="p-4 bg-amber-950/5 rounded-2xl border border-amber-900/10 space-y-3">
                    <p className="text-[8px] font-black text-amber-700 uppercase tracking-widest">Seguro de Vida</p>
                    <Field label="Vencimiento"><input name="vencimientoSeguroVida" type="date" value={toISODate(conductor.vencimientoSeguroVida)} onChange={handleConductorChange} className={inputCls(true)} /></Field>
                    <Field label="Aseguradora"><input name="aseguradoraVida" value={conductor.aseguradoraVida} onChange={handleConductorChange} className={inputCls()} /></Field>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2: Vehículos ── */}
          {step === 2 && (
            <div className="p-8 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{vehicles.length} vehículo{vehicles.length !== 1 ? 's' : ''} asignado{vehicles.length !== 1 ? 's' : ''}</p>
                <button onClick={addVehicle} className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#C29329]/10 border border-[#C29329]/30 text-[#C29329] hover:bg-[#C29329]/20 transition-all">
                  + Agregar vehículo
                </button>
              </div>

              {vehicles.map((v, idx) => (
                <VehicleCard
                  key={idx}
                  idx={idx}
                  v={v}
                  isExpanded={expanded === idx}
                  isOnly={vehicles.length === 1}
                  onToggle={() => setExpanded(expanded === idx ? -1 : idx)}
                  onChange={(e) => handleVehicleChange(idx, e)}
                  onRemove={() => removeVehicle(idx)}
                  getTaxStatus={() => getTaxStatus(v)}
                  onTaxToggle={(e) => {
                    const val = e.target.value;
                    // Al seleccionar SUJETO se guarda 'Sujeto a Control' como sentinel
                    // (cadena vacía se confundiría con 'Sin Información')
                    setVehicles(prev => prev.map((vv, i) => i === idx ? { ...vv, vencimientoControlTaximetro: val === 'SUJETO' ? 'Sujeto a Control' : val } : vv));
                  }}
                  isEditing={isEditing}
                  onUpload={(field, file) => handleVehicleUpload(idx, field, file)}
                  isUploading={(field) => uploadingFields.has(`${idx}-${field}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center shrink-0">
          <div>
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-6 py-3 btn-secondary rounded-xl text-[9px] font-black uppercase tracking-widest">
                ← Conductor
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 btn-secondary rounded-xl text-[9px] font-black uppercase tracking-widest">Cancelar</button>
            {step === 1 && (
              <button onClick={() => setStep(2)} disabled={!conductor.rut || !conductor.nombre}
                className="px-8 py-3 btn-premium rounded-xl text-[9px] font-black uppercase tracking-widest italic disabled:opacity-30">
                Vehículos →
              </button>
            )}
            {step === 2 && (
              <button onClick={handleSave} disabled={saving || vehicles.some(v => !v.patente)}
                className="px-8 py-3 btn-premium rounded-xl text-[9px] font-black uppercase tracking-widest italic disabled:opacity-30">
                {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Registrar todo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StepPill = ({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) => (
  <div className="flex items-center gap-2">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${active ? 'bg-[#C29329] text-black' : done ? 'bg-emerald-600 text-white' : 'bg-white/10 text-zinc-600'}`}>
      {done ? '✓' : n}
    </div>
    <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-white' : 'text-zinc-600'}`}>{label}</span>
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.25em] mb-3 border-b border-white/5 pb-2">{children}</p>
);

// Módulo-nivel — estables entre renders, los inputs no se desmontan
const VF = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1 min-w-0">
    <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block">{label}</label>
    {children}
  </div>
);

const VS = ({ name, value, opts, onChange }: {
  name: string; value: string;
  opts: { label: string; value: string }[];
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) => (
  <div className="relative">
    <select name={name} value={value} onChange={onChange}
      className="w-full px-3 py-2.5 bg-[#0A0C0E] border border-white/5 rounded-xl font-bold text-zinc-200 focus:border-[#C29329]/40 outline-none transition-all appearance-none text-[11px]">
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-700 text-[8px]">▼</div>
  </div>
);

const VDF = ({ label, fieldKey, vehicle, isUploading, onUpload, children }: {
  label: string; fieldKey: string;
  vehicle: VehicleEntry;
  isUploading: (f: string) => boolean;
  onUpload: (f: string, file: File) => Promise<void>;
  children: React.ReactNode;
}) => (
  <div className="min-w-0">
    <label className="text-[7px] font-black text-zinc-600 uppercase tracking-widest block mb-1">{label}</label>
    {children}
    <UploadButton
      url={(vehicle as unknown as Record<string, unknown>)[fieldKey] as string | undefined}
      uploading={isUploading(fieldKey)}
      onUpload={f => onUpload(fieldKey, f)}
      disabled={!vehicle.patente}
    />
  </div>
);

interface VehicleCardProps {
  idx: number; v: VehicleEntry; isExpanded: boolean; isOnly: boolean; isEditing: boolean;
  onToggle: () => void; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onRemove: () => void; getTaxStatus: () => string;
  onTaxToggle: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onUpload: (field: string, file: File) => Promise<void>;
  isUploading: (field: string) => boolean;
}

const VehicleCard: React.FC<VehicleCardProps> = ({
  idx, v, isExpanded, isOnly, isEditing, onToggle, onChange, onRemove,
  getTaxStatus, onTaxToggle, onUpload, isUploading,
}) => {
  const iCls = (date = false) =>
    `w-full ${date ? 'px-1.5 text-[10px]' : 'px-3 text-[11px]'} py-2.5 bg-[#0A0C0E] border border-white/5 rounded-xl font-semibold text-zinc-200 focus:border-[#C29329]/40 outline-none transition-all placeholder:text-zinc-800 min-w-0`;

  const taxStatus = getTaxStatus();

  return (
    <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-all" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-zinc-500 uppercase">#{idx + 1}</span>
          {v.patente ? (
            <>
              <span className="bg-white/5 text-zinc-200 font-black px-2 py-1 rounded-lg text-[10px] italic">{v.patente}</span>
              <span className="text-[11px] font-black text-zinc-400 uppercase">{[v.marca, v.modelo, v.año > 0 ? v.año : ''].filter(Boolean).join(' ')}</span>
              <span className={`text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${v.statusOperativo === 'Activo' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-zinc-800 text-zinc-600'}`}>{v.statusOperativo}</span>
            </>
          ) : (
            <span className="text-[10px] text-zinc-600 italic">Sin patente — completar</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isOnly && !isEditing && (
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 text-zinc-700 hover:text-red-500 transition-colors text-[10px]">✕</button>
          )}
          <span className="text-zinc-600 text-[10px] transition-transform" style={{ display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
        </div>
      </div>

      {/* Card body */}
      {isExpanded && (
        <div className="px-5 pb-6 pt-1 space-y-5 border-t border-white/5">

          {/* Specs */}
          <div>
            <SectionLabel>Especificaciones</SectionLabel>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
              <VF label="Patente *"><input name="patente" value={v.patente} onChange={onChange} disabled={isEditing} className={iCls()} /></VF>
              <VF label="Tipo"><VS name="tipo" value={v.tipo} onChange={onChange} opts={[
                { label: 'Automóvil', value: 'AUTOMOVIL' }, { label: 'Station Wagon', value: 'STATION WAGON' },
                { label: 'SUV', value: 'SUV' }, { label: 'Minibus', value: 'MINIBUS' },
                { label: 'Taxi Ejecutivo', value: 'TAXI EJECUTIVO' },
              ]} /></VF>
              <VF label="Marca"><input name="marca" value={v.marca} onChange={onChange} className={iCls()} /></VF>
              <VF label="Modelo"><input name="modelo" value={v.modelo} onChange={onChange} className={iCls()} /></VF>
              <VF label="Color"><input name="color" value={v.color} onChange={onChange} className={iCls()} /></VF>
              <VF label="Año"><input name="año" type="number" value={v.año} onChange={onChange} className={iCls()} /></VF>
              <VF label="Asientos"><input name="asientos" type="number" value={v.asientos} onChange={onChange} className={iCls()} /></VF>
              <VF label="Estado"><VS name="estado" value={v.estado} onChange={onChange} opts={[{ label: 'Externo', value: 'Externo' }, { label: 'Casa', value: 'Casa' }]} /></VF>
              <VF label="Operativo"><VS name="statusOperativo" value={v.statusOperativo} onChange={onChange} opts={[{ label: 'Activo', value: 'Activo' }, { label: 'Inactivo', value: 'Inactivo' }]} /></VF>
              <div className="col-span-2"><VF label="Propietario"><input name="nombrePropietario" value={v.nombrePropietario} onChange={onChange} className={iCls()} /></VF></div>
              <VF label="RUT Prop."><input name="rutPropietario" value={v.rutPropietario} onChange={onChange} className={iCls()} /></VF>
            </div>
          </div>

          {/* Documentos */}
          <div>
            <SectionLabel>Documentos del Vehículo</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-start">
              <VDF label="Padrón" fieldKey="urlPadron" vehicle={v} isUploading={isUploading} onUpload={onUpload}>
                <input name="vencimientoPadron" type="date" value={toISODate(v.vencimientoPadron)} onChange={onChange} className={iCls(true)} />
              </VDF>
              <VDF label="P. Circulación" fieldKey="urlPermisoCirculacion" vehicle={v} isUploading={isUploading} onUpload={onUpload}>
                <input name="vencimientoPermisoCirculacion" type="date" value={toISODate(v.vencimientoPermisoCirculacion)} onChange={onChange} className={iCls(true)} />
              </VDF>
              <VF label="Municipalidad"><input name="municipalidadPermiso" value={v.municipalidadPermiso} onChange={onChange} className={iCls()} /></VF>
              <VDF label="Rev. Técnica" fieldKey="urlRevisionTecnica" vehicle={v} isUploading={isUploading} onUpload={onUpload}>
                <input name="vencimientoRevisionTecnica" type="date" value={toISODate(v.vencimientoRevisionTecnica)} onChange={onChange} className={iCls(true)} />
              </VDF>
              <VDF label="SOAP" fieldKey="urlSOAP" vehicle={v} isUploading={isUploading} onUpload={onUpload}>
                <input name="vencimientoSOAP" type="date" value={toISODate(v.vencimientoSOAP)} onChange={onChange} className={iCls(true)} />
              </VDF>
              <VF label="Taxímetro">
                <VS name="taximetro_toggle" value={taxStatus} onChange={onTaxToggle as React.ChangeEventHandler<HTMLSelectElement>} opts={[
                  { label: '— Sin Información', value: 'Sin Información' },
                  { label: '📅 Sujeto a Control', value: 'SUJETO' },
                  { label: '✗ No Aplica', value: 'No Aplica' },
                ]} />
              </VF>
              {taxStatus === 'SUJETO' && (
                <VF label="Próx. Control"><input name="vencimientoControlTaximetro" type="date" value={toISODate(v.vencimientoControlTaximetro)} onChange={onChange} className={iCls(true)} /></VF>
              )}
            </div>
          </div>

          {/* Seguros */}
          <div>
            <SectionLabel>Seguros del Vehículo</SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
              <VF label="Seguro Accidentes"><input name="vencimientoSeguroAccidentes" type="date" value={toISODate(v.vencimientoSeguroAccidentes)} onChange={onChange} className={iCls(true)} /></VF>
              <VF label="Compañía"><input name="lugarSeguroAccidentes" value={v.lugarSeguroAccidentes} onChange={onChange} className={iCls()} /></VF>
              <VDF label="Seguro Asiento" fieldKey="urlSeguroAsiento" vehicle={v} isUploading={isUploading} onUpload={onUpload}>
                <input name="vencimientoSeguroAsiento" type="date" value={toISODate(v.vencimientoSeguroAsiento)} onChange={onChange} className={iCls(true)} />
              </VDF>
              <VF label="Aseguradora Asiento"><input name="aseguradoraAsiento" value={v.aseguradoraAsiento} onChange={onChange} className={iCls()} /></VF>
            </div>
          </div>

          {/* Contratos */}
          <div>
            <SectionLabel>Contratos y Certificados</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: 'certificadoAntecedentes', label: 'Cert. Antecedentes', val: v.certificadoAntecedentes },
                { name: 'prestacionSS', label: 'Prestación SS', val: v.prestacionSS },
                { name: 'contratoArriendo', label: 'Contrato Arriendo', val: v.contratoArriendo },
              ].map(item => (
                <div key={item.name}>
                  <VF label={item.label}>
                    <VS name={item.name} value={item.val} onChange={onChange} opts={[
                      { label: '— Sin Información', value: 'Sin Información' },
                      { label: '✓ OK / Vigente', value: 'OK' },
                      { label: '✗ No Aplica', value: 'No Aplica' },
                    ]} />
                  </VF>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleWizard;
