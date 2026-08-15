import React, { useState, useEffect, useRef } from 'react';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';
import { inviteService, Invite } from '../services/inviteService';
import { conductorService } from '../services/conductorService';
import { vehicleService } from '../services/vehicleService';
import { uploadDoc } from '../services/storageService';
import ConductorPortal from './ConductorPortal';

function normalizeRut(value: string): string {
  const c = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (c.length > 1) return `${c.slice(0, -1)}-${c.slice(-1)}`;
  return c;
}

const TIPO_OPTIONS = [
  { label: 'Automóvil',      value: 'AUTOMOVIL' },
  { label: 'Station Wagon',  value: 'STATION WAGON' },
  { label: 'SUV',            value: 'SUV' },
  { label: 'Minibus',        value: 'MINIBUS' },
  { label: 'Taxi Ejecutivo', value: 'TAXI EJECUTIVO' },
];

type ToggleMode = 'Sin Información' | 'SUJETO' | 'No Aplica';

type Field =
  | 'rut' | 'nombre' | 'fechaNacimiento' | 'celular' | 'email' | 'direccion' | 'comuna'
  | 'claseLicencia' | 'leyLicencia' | 'municipalidadLicencia'
  | 'vigenciaCarnetDesde' | 'vigenciaCarnetHasta' | 'urlCarnet' | 'urlCarnetReverso'
  | 'vigenciaLicenciaDesde' | 'vigenciaLicenciaHasta' | 'urlLicencia' | 'urlLicenciaReverso'
  | 'patente' | 'tipo' | 'marca' | 'modelo' | 'color' | 'año' | 'asientos'
  | 'vencimientoPermisoCirculacion' | 'municipalidadPermiso' | 'urlPermisoCirculacion'
  | 'vencimientoRevisionTecnica' | 'urlRevisionTecnica'
  | 'vencimientoSOAP' | 'urlSOAP'
  | 'vencimientoSeguroAsiento' | 'aseguradoraAsiento' | 'urlSeguroAsiento' | 'seguroAsientoModo'
  | 'vencimientoControlTaximetro' | 'urlControlTaximetro' | 'taximetroModo'
  | 'urlPadron';

type FormState = Record<Field, string>;

const EMPTY: FormState = {
  rut: '', nombre: '', fechaNacimiento: '', celular: '', email: '', direccion: '', comuna: '',
  claseLicencia: '', leyLicencia: '', municipalidadLicencia: '',
  vigenciaCarnetDesde: '', vigenciaCarnetHasta: '', urlCarnet: '', urlCarnetReverso: '',
  vigenciaLicenciaDesde: '', vigenciaLicenciaHasta: '', urlLicencia: '', urlLicenciaReverso: '',
  patente: '', tipo: 'AUTOMOVIL', marca: '', modelo: '', color: '',
  año: String(new Date().getFullYear()), asientos: '5',
  vencimientoPermisoCirculacion: '', municipalidadPermiso: '', urlPermisoCirculacion: '',
  vencimientoRevisionTecnica: '', urlRevisionTecnica: '',
  vencimientoSOAP: '', urlSOAP: '',
  vencimientoSeguroAsiento: '', aseguradoraAsiento: '', urlSeguroAsiento: '', seguroAsientoModo: 'Sin Información',
  vencimientoControlTaximetro: '', urlControlTaximetro: '', taximetroModo: 'Sin Información',
  urlPadron: '',
};

// ── UI atoms ──────────────────────────────────────────────────────────────────

const Label = ({ text, required }: { text: string; required?: boolean }) => (
  <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
    {text}{required && <span className="text-[#C29329]"> *</span>}
  </label>
);

const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]";

const TextField = ({ label, value, onChange, required, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; type?: string;
}) => (
  <div>
    <Label text={label} required={required} />
    <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={inputCls} />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[];
}) => (
  <div>
    <Label text={label} />
    <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const UploadField = ({ label, url, uploading, onUpload }: {
  label: string; url: string; uploading: boolean; onUpload: (file: File) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Label text={label} />
      <input ref={ref} type="file" accept="image/*,.pdf,.heic,.heif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        className={`w-full py-2.5 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-center gap-2 ${
          uploading ? 'bg-zinc-800 border-zinc-700 text-zinc-400 animate-pulse'
          : url ? 'bg-white/5 border-white/10 text-zinc-300 hover:text-white'
          : 'bg-[#C29329]/10 border-[#C29329]/30 text-[#C29329] hover:bg-[#C29329]/20'
        }`}>
        {uploading ? '⏳ Subiendo...' : url ? '📎 Reemplazar' : '📎 Adjuntar foto o PDF'}
      </button>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5 space-y-4">
    <p className="text-[9px] font-black text-white uppercase tracking-widest">{title}</p>
    {children}
  </div>
);

const SubBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="pt-3 border-t border-white/5 space-y-3">
    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{title}</p>
    {children}
  </div>
);

const TOGGLE_OPTIONS = [
  { label: '— Sin información', value: 'Sin Información' },
  { label: '📅 Sí, tiene / aplica (con fecha)', value: 'SUJETO' },
  { label: '✗ No aplica', value: 'No Aplica' },
];

// ── Componente principal ────────────────────────────────────────────────────

const OnboardingForm: React.FC<{ token: string }> = ({ token }) => {
  const [loading, setLoading]           = useState(true);
  const [invite, setInvite]             = useState<Invite | null>(null);
  const [inviteError, setInviteError]   = useState<string | null>(null);
  const [form, setForm]                 = useState<FormState>(EMPTY);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [createdRut, setCreatedRut]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const inv = await inviteService.fetchInvite(token);
        if (!inv)       { setInviteError('Este enlace no es válido.'); return; }
        if (inv.usedAt) { setInviteError('Este enlace ya fue utilizado. Pide uno nuevo al encargado.'); return; }
        if (new Date(inv.expiresAt) < new Date()) { setInviteError('Este enlace expiró. Pide uno nuevo al encargado.'); return; }
        setInvite(inv);
      } catch {
        setInviteError('Error de conexión. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const set = (k: Field, v: string) => setForm(p => ({ ...p, [k]: k === 'rut' ? normalizeRut(v) : v }));

  const handleUpload = async (key: Field, isConductor: boolean, file: File) => {
    const idRaw = isConductor ? form.rut : form.patente;
    if (!idRaw.trim()) {
      alert(isConductor ? 'Ingresa tu RUT antes de adjuntar documentos.' : 'Ingresa la patente antes de adjuntar documentos.');
      return;
    }
    setUploadingKey(key);
    try {
      const id   = isConductor ? idRaw.replace(/[^a-zA-Z0-9]/g, '') : idRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const path = `${isConductor ? 'conductores' : 'vehicles'}/${id}/${key}`;
      const url  = await uploadDoc(path, file);
      set(key, url);
    } catch {
      alert('Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSubmit = async () => {
    if (!invite) return;
    const rut     = form.rut.trim();
    const patente = form.patente.trim().toUpperCase();
    if (!rut.includes('-') || !form.nombre.trim() || !form.email.trim() || !patente) {
      setSubmitError('Completa al menos tu RUT, nombre, correo y la patente del vehículo.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const existing = await conductorService.fetchConductorByRut(rut);
      if (existing) {
        setSubmitError('Ese RUT ya está registrado en el sistema. Si crees que es un error, contacta al encargado.');
        return;
      }

      const taximetroFinal = form.taximetroModo === 'No Aplica' ? 'No Aplica'
        : form.taximetroModo === 'Sin Información' ? 'Sin Información'
        : (form.vencimientoControlTaximetro || 'Sujeto a Control');

      const seguroAsientoFinal = form.seguroAsientoModo === 'No Aplica' ? 'No Aplica'
        : form.seguroAsientoModo === 'Sin Información' ? 'Sin Información'
        : (form.vencimientoSeguroAsiento || 'Sujeto a Control');

      const vehicle: Vehicle = {
        id: invite.numeroMovil, patente,
        tipo: form.tipo, marca: form.marca.trim(), modelo: form.modelo.trim(), color: form.color.trim(),
        año: Number(form.año) || 0, asientos: Number(form.asientos) || 0,
        estado: 'Externo', statusOperativo: 'Activo',
        nombrePropietario: '', rutPropietario: '',
        vencimientoPadron: '',
        vencimientoPermisoCirculacion: form.vencimientoPermisoCirculacion, municipalidadPermiso: form.municipalidadPermiso.trim(),
        vencimientoRevisionTecnica: form.vencimientoRevisionTecnica,
        vencimientoSOAP: form.vencimientoSOAP,
        vencimientoControlTaximetro: taximetroFinal,
        certificadoAntecedentes: 'Sin Información', prestacionSS: 'Sin Información', contratoArriendo: 'Sin Información',
        vencimientoSeguroAccidentes: '', lugarSeguroAccidentes: '',
        vencimientoSeguroAsiento: seguroAsientoFinal, aseguradoraAsiento: form.aseguradoraAsiento.trim(),
        vencimientoSeguroVidaConductor: '', aseguradoraVida: '',
        nombreConductor: form.nombre.trim(), rutConductor: rut,
        fechaNacimiento: form.fechaNacimiento, celular: form.celular.trim(), email: form.email.trim(),
        direccion: form.direccion.trim(), comuna: form.comuna.trim(),
        claseLicencia: form.claseLicencia.trim(), leyLicencia: form.leyLicencia.trim(), municipalidadLicencia: form.municipalidadLicencia.trim(),
        vigenciaCarnetDesde: form.vigenciaCarnetDesde, vigenciaCarnetHasta: form.vigenciaCarnetHasta,
        vigenciaLicenciaDesde: form.vigenciaLicenciaDesde, vigenciaLicenciaHasta: form.vigenciaLicenciaHasta,
        conductorRut: rut,
        urlCarnet: form.urlCarnet, urlLicencia: form.urlLicencia,
        urlCarnetReverso: form.urlCarnetReverso, urlLicenciaReverso: form.urlLicenciaReverso,
        urlPadron: form.urlPadron, urlPermisoCirculacion: form.urlPermisoCirculacion,
        urlRevisionTecnica: form.urlRevisionTecnica, urlSOAP: form.urlSOAP,
        urlSeguroAsiento: form.urlSeguroAsiento, urlControlTaximetro: form.urlControlTaximetro,
      };

      await vehicleService.createVehicle(vehicle);
      await inviteService.markUsed(token, rut);

      fetch('/api/log-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conductor_rut: rut, conductor_nombre: form.nombre.trim(),
          movil: invite.numeroMovil, patente,
          field_label: 'Registro inicial (alta de móvil nuevo)',
        }),
      }).catch(() => {});

      setCreatedRut(rut);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(
        msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')
          ? 'Esa patente ya existe en el sistema. Verifica que esté bien escrita.'
          : `Error al registrar: ${msg}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Estados de carga / error ──

  if (createdRut) return <ConductorPortal rut={createdRut} />;

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#C29329] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-500 text-xs uppercase tracking-widest">Verificando enlace...</p>
      </div>
    </div>
  );

  if (inviteError || !invite) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-white font-black uppercase tracking-widest text-sm mb-2">Enlace no válido</p>
        <p className="text-zinc-500 text-xs">{inviteError}</p>
      </div>
    </div>
  );

  // ── Formulario ──

  return (
    <div className="min-h-screen bg-[#0f1117]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="bg-[#1B1F24] border-b border-white/5 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-[8px] font-black text-[#C29329] uppercase tracking-[0.25em]">RadioMovil</p>
            <p className="text-[7px] text-zinc-600 uppercase tracking-widest">Registro de móvil nuevo</p>
          </div>
          <div className="bg-[#C29329] text-black font-black px-3 py-1.5 rounded-xl text-sm italic">
            Móvil {invite.numeroMovil}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">

        <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5">
          <p className="text-white font-black uppercase tracking-widest text-sm mb-1">¡Bienvenido a RadioMovil!</p>
          <p className="text-zinc-500 text-[11px] leading-relaxed">
            Completa tus datos y los de tu vehículo para quedar registrado en el sistema. Lo que no tengas a mano ahora puedes dejarlo en blanco y completarlo después desde tu propio portal.
          </p>
        </div>

        <Section title="Tus Datos">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="RUT" required value={form.rut} onChange={v => set('rut', v)} placeholder="12345678-9" />
            <TextField label="Nombre completo" required value={form.nombre} onChange={v => set('nombre', v)} />
            <TextField label="Fecha de nacimiento" type="date" value={toISODate(form.fechaNacimiento)} onChange={v => set('fechaNacimiento', fromISODate(v))} />
            <TextField label="Celular" value={form.celular} onChange={v => set('celular', v)} placeholder="9XXXXXXXX" />
            <div className="col-span-2"><TextField label="Correo electrónico" required type="email" value={form.email} onChange={v => set('email', v)} /></div>
            <div className="col-span-2"><TextField label="Dirección" value={form.direccion} onChange={v => set('direccion', v)} /></div>
            <TextField label="Comuna" value={form.comuna} onChange={v => set('comuna', v)} />
          </div>

          <SubBlock title="Licencia de Conducir">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Clase" value={form.claseLicencia} onChange={v => set('claseLicencia', v)} placeholder="A2" />
              <TextField label="Ley" value={form.leyLicencia} onChange={v => set('leyLicencia', v)} />
              <div className="col-span-2"><TextField label="Municipalidad que la otorga" value={form.municipalidadLicencia} onChange={v => set('municipalidadLicencia', v)} /></div>
              <TextField label="Vigente desde" type="date" value={toISODate(form.vigenciaLicenciaDesde)} onChange={v => set('vigenciaLicenciaDesde', fromISODate(v))} />
              <TextField label="Vigente hasta" type="date" value={toISODate(form.vigenciaLicenciaHasta)} onChange={v => set('vigenciaLicenciaHasta', fromISODate(v))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <UploadField label="Foto (anverso)" url={form.urlLicencia} uploading={uploadingKey === 'urlLicencia'} onUpload={f => handleUpload('urlLicencia', true, f)} />
              <UploadField label="Foto (reverso)" url={form.urlLicenciaReverso} uploading={uploadingKey === 'urlLicenciaReverso'} onUpload={f => handleUpload('urlLicenciaReverso', true, f)} />
            </div>
          </SubBlock>

          <SubBlock title="Carnet de Identidad">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Vigente desde" type="date" value={toISODate(form.vigenciaCarnetDesde)} onChange={v => set('vigenciaCarnetDesde', fromISODate(v))} />
              <TextField label="Vigente hasta" type="date" value={toISODate(form.vigenciaCarnetHasta)} onChange={v => set('vigenciaCarnetHasta', fromISODate(v))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <UploadField label="Foto (anverso)" url={form.urlCarnet} uploading={uploadingKey === 'urlCarnet'} onUpload={f => handleUpload('urlCarnet', true, f)} />
              <UploadField label="Foto (reverso)" url={form.urlCarnetReverso} uploading={uploadingKey === 'urlCarnetReverso'} onUpload={f => handleUpload('urlCarnetReverso', true, f)} />
            </div>
          </SubBlock>
        </Section>

        <Section title="Tu Vehículo">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Patente" required value={form.patente} onChange={v => set('patente', v.toUpperCase())} placeholder="AB1234" />
            <SelectField label="Tipo" value={form.tipo} onChange={v => set('tipo', v)} options={TIPO_OPTIONS} />
            <TextField label="Marca" value={form.marca} onChange={v => set('marca', v)} />
            <TextField label="Modelo" value={form.modelo} onChange={v => set('modelo', v)} />
            <TextField label="Color" value={form.color} onChange={v => set('color', v)} />
            <TextField label="Año" type="number" value={form.año} onChange={v => set('año', v)} />
            <TextField label="Asientos" type="number" value={form.asientos} onChange={v => set('asientos', v)} />
          </div>

          <SubBlock title="Permiso de Circulación">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Vencimiento" type="date" value={toISODate(form.vencimientoPermisoCirculacion)} onChange={v => set('vencimientoPermisoCirculacion', fromISODate(v))} />
              <TextField label="Municipalidad" value={form.municipalidadPermiso} onChange={v => set('municipalidadPermiso', v)} />
            </div>
            <UploadField label="Foto o PDF" url={form.urlPermisoCirculacion} uploading={uploadingKey === 'urlPermisoCirculacion'} onUpload={f => handleUpload('urlPermisoCirculacion', false, f)} />
          </SubBlock>

          <SubBlock title="Revisión Técnica">
            <TextField label="Vencimiento" type="date" value={toISODate(form.vencimientoRevisionTecnica)} onChange={v => set('vencimientoRevisionTecnica', fromISODate(v))} />
            <UploadField label="Foto o PDF" url={form.urlRevisionTecnica} uploading={uploadingKey === 'urlRevisionTecnica'} onUpload={f => handleUpload('urlRevisionTecnica', false, f)} />
          </SubBlock>

          <SubBlock title="SOAP">
            <TextField label="Vencimiento" type="date" value={toISODate(form.vencimientoSOAP)} onChange={v => set('vencimientoSOAP', fromISODate(v))} />
            <UploadField label="Foto o PDF" url={form.urlSOAP} uploading={uploadingKey === 'urlSOAP'} onUpload={f => handleUpload('urlSOAP', false, f)} />
          </SubBlock>

          <SubBlock title="Seguro de Asientos">
            <SelectField label="¿Aplica seguro de asiento?" value={form.seguroAsientoModo} onChange={v => set('seguroAsientoModo', v as ToggleMode)} options={TOGGLE_OPTIONS} />
            {form.seguroAsientoModo === 'SUJETO' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Vencimiento" type="date" value={toISODate(form.vencimientoSeguroAsiento)} onChange={v => set('vencimientoSeguroAsiento', fromISODate(v))} />
                  <TextField label="Aseguradora" value={form.aseguradoraAsiento} onChange={v => set('aseguradoraAsiento', v)} />
                </div>
                <UploadField label="Foto o PDF" url={form.urlSeguroAsiento} uploading={uploadingKey === 'urlSeguroAsiento'} onUpload={f => handleUpload('urlSeguroAsiento', false, f)} />
              </>
            )}
          </SubBlock>

          <SubBlock title="Control de Taxímetro">
            <SelectField label="¿Tu vehículo tiene taxímetro?" value={form.taximetroModo} onChange={v => set('taximetroModo', v as ToggleMode)} options={TOGGLE_OPTIONS} />
            {form.taximetroModo === 'SUJETO' && (
              <>
                <TextField label="Vencimiento (si lo sabes)" type="date" value={toISODate(form.vencimientoControlTaximetro)} onChange={v => set('vencimientoControlTaximetro', fromISODate(v))} />
                <UploadField label="Foto o PDF" url={form.urlControlTaximetro} uploading={uploadingKey === 'urlControlTaximetro'} onUpload={f => handleUpload('urlControlTaximetro', false, f)} />
              </>
            )}
          </SubBlock>

          <SubBlock title="Padrón">
            <UploadField label="Foto o PDF" url={form.urlPadron} uploading={uploadingKey === 'urlPadron'} onUpload={f => handleUpload('urlPadron', false, f)} />
          </SubBlock>
        </Section>

        {submitError && (
          <div className="p-4 rounded-xl border border-red-700/30 bg-red-900/20 text-red-400 text-[11px] font-bold leading-relaxed">
            {submitError}
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-4 rounded-xl text-[12px] font-black uppercase tracking-widest bg-[#C29329] text-black hover:bg-amber-500 transition-all disabled:opacity-40">
          {submitting ? 'Registrando...' : '✓ Completar registro'}
        </button>

        <p className="text-center text-[7px] text-zinc-700 uppercase tracking-widest pb-4">
          Radiomóvil · Sistema de Gestión Documental
        </p>
      </div>
    </div>
  );
};

export default OnboardingForm;
