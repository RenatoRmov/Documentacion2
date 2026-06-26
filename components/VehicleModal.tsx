
import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';
import { conductorService } from '../services/conductorService';

const SectionTitle = ({ title, icon }: { title: string, icon: string }) => (
  <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-6 border-b border-white/5 pb-3 flex items-center gap-3">
    <span className="text-sm">{icon}</span> {title}
  </h3>
);

interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  disabled?: boolean;
  highlight?: boolean;
}

const InputField = ({ label, name, type = "text", required = false, placeholder = "", value, onChange, onBlur, disabled = false, highlight = false }: InputFieldProps) => (
  <div className="space-y-2 flex-1 min-w-0">
    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest block px-1 truncate">{label}</label>
    <input
      required={required}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full ${type === 'date' ? 'px-1.5 text-[10px]' : 'px-5 text-xs'} py-3.5 bg-[#0A0C0E] border rounded-xl font-semibold text-zinc-200 focus:border-[#C29329]/40 outline-none transition-all placeholder:text-zinc-800 min-w-0 ${disabled ? 'opacity-20 cursor-not-allowed' : ''} ${highlight ? 'border-emerald-700/40' : 'border-white/5'}`}
    />
  </div>
);

const SelectField = ({ label, name, value, options, onChange }: { label: string, name: string, value: string, options: { label: string, value: string }[], onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) => (
  <div className="space-y-2 flex-1 min-w-0">
    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest block px-1 truncate">{label}</label>
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-5 py-3.5 bg-[#0A0C0E] border border-white/5 rounded-xl font-bold text-zinc-200 focus:border-[#C29329]/40 outline-none transition-all appearance-none text-xs"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-700 text-[10px]">▼</div>
    </div>
  </div>
);

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vehicle: Vehicle) => void;
  initialData?: Vehicle | null;
}

type ConductorStatus = 'idle' | 'loading' | 'found' | 'new';

const EMPTY_FORM: Partial<Vehicle> = {
  id: '', patente: '', tipo: 'AUTOMOVIL', marca: '', modelo: '', color: '', año: 2024, asientos: 5, estado: 'Externo', statusOperativo: 'Activo',
  nombrePropietario: '', rutPropietario: '',
  vencimientoPermisoCirculacion: '', municipalidadPermiso: '',
  vencimientoRevisionTecnica: '', vencimientoSOAP: '',
  vencimientoControlTaximetro: 'SIN INFORMACIÓN',
  certificadoAntecedentes: 'Sin Información',
  prestacionSS: 'Sin Información', contratoArriendo: 'Sin Información',
  vencimientoSeguroAccidentes: '', lugarSeguroAccidentes: '',
  vencimientoSeguroAsiento: '', aseguradoraAsiento: '',
  vencimientoSeguroVidaConductor: '', aseguradoraVida: '',
  nombreConductor: '', rutConductor: '', fechaNacimiento: '', celular: '', email: '',
  direccion: '', comuna: '', claseLicencia: '', leyLicencia: '', municipalidadLicencia: '',
  vigenciaCarnetDesde: '', vigenciaCarnetHasta: '',
  vigenciaLicenciaDesde: '', vigenciaLicenciaHasta: ''
};

const VehicleModal: React.FC<VehicleModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Vehicle>>({});
  const [conductorStatus, setConductorStatus] = useState<ConductorStatus>('idle');

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setConductorStatus('idle');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Vehicle);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value, type } = e.target;

    if (type === 'text' || type === 'email') {
      value = value.toUpperCase();
    }

    if ((name === 'rutPropietario' || name === 'rutConductor') && value.length > 1) {
      let clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
      if (clean.length > 1) {
        const body = clean.slice(0, -1);
        const dv = clean.slice(-1);
        value = `${body}-${dv}`;
      } else {
        value = clean;
      }
    }

    const finalValue = type === 'date' ? fromISODate(value) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleRutBlur = async () => {
    const rut = formData.rutConductor?.trim();
    if (!rut || !rut.includes('-') || initialData) return;
    setConductorStatus('loading');
    try {
      const found = await conductorService.fetchConductorByRut(rut);
      if (found) {
        setFormData(prev => ({
          ...prev,
          id:                          found.numeroMovil || prev.id,
          nombreConductor:             found.nombre,
          fechaNacimiento:             found.fechaNacimiento,
          celular:                     found.celular,
          email:                       found.email,
          direccion:                   found.direccion,
          comuna:                      found.comuna,
          claseLicencia:               found.claseLicencia,
          leyLicencia:                 found.leyLicencia,
          municipalidadLicencia:       found.municipalidadLicencia,
          vigenciaCarnetDesde:         found.vigenciaCarnetDesde,
          vigenciaCarnetHasta:         found.vigenciaCarnetHasta,
          vigenciaLicenciaDesde:       found.vigenciaLicenciaDesde,
          vigenciaLicenciaHasta:       found.vigenciaLicenciaHasta,
          vencimientoSeguroVidaConductor: found.vencimientoSeguroVida,
          aseguradoraVida:             found.aseguradoraVida,
        }));
        setConductorStatus('found');
      } else {
        setConductorStatus('new');
      }
    } catch {
      setConductorStatus('new');
    }
  };

  const handleTaximetroToggle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      vencimientoControlTaximetro: val === 'SUJETO' ? '' : val
    }));
  };

  const handleSeguroAsientoToggle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFormData(prev => ({
      ...prev,
      vencimientoSeguroAsiento: val === 'APLICA' ? '' : val
    }));
  };

  const getSeguroAsientoStatus = () => {
    const val = formData.vencimientoSeguroAsiento;
    if (!val || val.toLowerCase() === 'sin información' || val.toLowerCase() === 'sin informacion') return 'Sin Información';
    if (val.toLowerCase() === 'no aplica') return 'No Aplica';
    return 'APLICA';
  };

  const seguroAsientoOptions = [
    { label: '--- Sin Información ---', value: 'Sin Información' },
    { label: '📅 Aplica (con fecha)', value: 'APLICA' },
    { label: '✗ No Aplica', value: 'No Aplica' }
  ];

  const complianceOptions = [
    { label: '--- Sin Información ---', value: 'Sin Información' },
    { label: '✓ OK / Vigente', value: 'OK' },
    { label: '✗ No Aplica', value: 'No Aplica' }
  ];

  const taximetroOptions = [
    { label: '--- Sin Información ---', value: 'Sin Información' },
    { label: '📅 Sujeto a Control', value: 'SUJETO' },
    { label: '✗ No Aplica', value: 'No Aplica' }
  ];

  const getTaximetroStatus = () => {
    const val = formData.vencimientoControlTaximetro;
    if (!val || val.toLowerCase() === 'sin información' || val.toLowerCase() === 'sin informacion') return 'Sin Información';
    if (val.toLowerCase() === 'no aplica') return 'No Aplica';
    return 'SUJETO';
  };

  const hl = conductorStatus === 'found'; // highlight pre-filled conductor fields

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#1B1F24] rounded-3xl shadow-[0_50px_100px_rgba(0,0,0,0.5)] w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-white/5">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">{initialData ? 'AUDITAR MÓVIL ' + initialData.id : 'NUEVO REGISTRO GLOBAL'}</h2>
            <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Protocolo de Gestión Documental RadioMovil</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-12 space-y-16 custom-scrollbar">
          {/* Vehículo */}
          <section>
            <SectionTitle title="Especificaciones Técnicas del Activo" icon="🚕" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
              <InputField label="N° Móvil" name="id" required value={formData.id || ''} onChange={handleChange} />
              <InputField label="Patente" name="patente" required disabled={!!initialData} value={formData.patente || ''} onChange={handleChange} />
              <SelectField
                label="Tipo"
                name="tipo"
                value={formData.tipo || ''}
                onChange={handleChange}
                options={[
                  { label: 'Automóvil', value: 'AUTOMOVIL' },
                  { label: 'Station Wagon', value: 'STATION WAGON' },
                  { label: 'SUV', value: 'SUV' },
                  { label: 'Minibus', value: 'MINIBUS' },
                  { label: 'Taxi Ejecutivo', value: 'TAXI EJECUTIVO' }
                ]}
              />
              <SelectField
                label="Estado Operativo"
                name="statusOperativo"
                value={formData.statusOperativo || 'Activo'}
                onChange={handleChange}
                options={[{ label: 'Activo / En Servicio', value: 'Activo' }, { label: 'Inactivo / Fuera', value: 'Inactivo' }]}
              />
              <InputField label="Marca" name="marca" required value={formData.marca || ''} onChange={handleChange} />
              <InputField label="Modelo" name="modelo" required value={formData.modelo || ''} onChange={handleChange} />
              <InputField label="Color" name="color" required value={formData.color || ''} onChange={handleChange} />
              <InputField label="Capacidad" name="asientos" type="number" value={String(formData.asientos || '')} onChange={handleChange} />
              <SelectField
                label="Categoría"
                name="estado"
                value={formData.estado || 'Externo'}
                onChange={handleChange}
                options={[{ label: 'Casa', value: 'Casa' }, { label: 'Externo', value: 'Externo' }]}
              />
              <InputField label="Año" name="año" type="number" value={String(formData.año || '')} onChange={handleChange} />
              <InputField label="Nombre Propietario" name="nombrePropietario" value={formData.nombrePropietario || ''} onChange={handleChange} />
              <InputField label="RUT Propietario" name="rutPropietario" value={formData.rutPropietario || ''} onChange={handleChange} />
            </div>
          </section>

          {/* Documentos */}
          <section>
            <SectionTitle title="Vencimientos y Certificaciones" icon="📄" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[8px] font-black text-zinc-500 uppercase block border-b border-white/5 pb-2 tracking-[0.2em]">Padrón</label>
                <InputField label="Vencimiento" name="vencimientoPadron" type="date" required value={toISODate(formData.vencimientoPadron || '')} onChange={handleChange} />
              </div>

              <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[8px] font-black text-zinc-500 uppercase block border-b border-white/5 pb-2 tracking-[0.2em]">P. Circulación</label>
                <InputField label="Vencimiento" name="vencimientoPermisoCirculacion" type="date" required value={toISODate(formData.vencimientoPermisoCirculacion || '')} onChange={handleChange} />
                <InputField label="Municipalidad" name="municipalidadPermiso" required value={formData.municipalidadPermiso || ''} onChange={handleChange} />
              </div>

              <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[8px] font-black text-zinc-500 uppercase block border-b border-white/5 pb-2 tracking-[0.2em]">Taxímetro</label>
                <SelectField
                  label="Estado"
                  name="taximetro_toggle"
                  value={getTaximetroStatus()}
                  onChange={handleTaximetroToggle}
                  options={taximetroOptions}
                />
                <InputField
                  label="Próx. Inspección"
                  name="vencimientoControlTaximetro"
                  type="date"
                  disabled={getTaximetroStatus() !== 'SUJETO'}
                  value={getTaximetroStatus() === 'SUJETO' ? toISODate(formData.vencimientoControlTaximetro || '') : ''}
                  onChange={handleChange}
                />
              </div>

              <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[8px] font-black text-zinc-500 uppercase block border-b border-white/5 pb-2 tracking-[0.2em]">Rev. Técnica</label>
                <InputField label="Fecha Límite" name="vencimientoRevisionTecnica" type="date" required value={toISODate(formData.vencimientoRevisionTecnica || '')} onChange={handleChange} />
              </div>

              <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[8px] font-black text-zinc-500 uppercase block border-b border-white/5 pb-2 tracking-[0.2em]">Póliza SOAP</label>
                <InputField label="Vencimiento" name="vencimientoSOAP" type="date" required value={toISODate(formData.vencimientoSOAP || '')} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* Contratos */}
          <section>
            <SectionTitle title="Contratos y Servicios Internos" icon="📁" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-indigo-950/5 rounded-2xl border border-indigo-900/10 flex gap-6">
                <SelectField
                  label="Prestación de Servicios"
                  name="prestacionSS"
                  value={formData.prestacionSS || 'Sin Información'}
                  onChange={handleChange}
                  options={complianceOptions}
                />
                <div className="flex-1 flex items-center px-4">
                  <p className="text-[8px] text-zinc-600 font-bold uppercase leading-relaxed italic">Documentación que acredita la relación de servicio con el operador.</p>
                </div>
              </div>
              <div className="p-6 bg-indigo-950/5 rounded-2xl border border-indigo-900/10 flex gap-6">
                <SelectField
                  label="Certificado Antecedentes"
                  name="certificadoAntecedentes"
                  value={formData.certificadoAntecedentes || 'Sin Información'}
                  onChange={handleChange}
                  options={complianceOptions}
                />
                <div className="flex-1 flex items-center px-4">
                  <p className="text-[8px] text-zinc-600 font-bold uppercase leading-relaxed italic">Certificado de antecedentes del conductor.</p>
                </div>
              </div>
              <div className="p-6 bg-indigo-950/5 rounded-2xl border border-indigo-900/10 flex gap-6">
                <SelectField
                  label="Contrato de Arriendo"
                  name="contratoArriendo"
                  value={formData.contratoArriendo || 'Sin Información'}
                  onChange={handleChange}
                  options={complianceOptions}
                />
                <div className="flex-1 flex items-center px-4">
                  <p className="text-[8px] text-zinc-600 font-bold uppercase leading-relaxed italic">Contrato legal de arrendamiento del activo para su explotación comercial.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Seguros */}
          <section>
            <SectionTitle title="Coberturas de Riesgo Global" icon="🛡️" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 bg-amber-950/5 rounded-2xl border border-amber-900/10 space-y-4">
                <label className="text-[8px] font-black text-amber-700 uppercase block border-b border-amber-900/20 pb-2 tracking-[0.2em]">Accidentes</label>
                <InputField label="Expiración" name="vencimientoSeguroAccidentes" type="date" value={toISODate(formData.vencimientoSeguroAccidentes || '')} onChange={handleChange} />
                <InputField label="Compañía" name="lugarSeguroAccidentes" value={formData.lugarSeguroAccidentes || ''} onChange={handleChange} />
              </div>
              <div className="p-5 bg-amber-950/5 rounded-2xl border border-amber-900/10 space-y-4">
                <label className="text-[8px] font-black text-amber-700 uppercase block border-b border-amber-900/20 pb-2 tracking-[0.2em]">S. Asiento</label>
                <SelectField
                  label="Estado"
                  name="seguroAsiento_toggle"
                  value={getSeguroAsientoStatus()}
                  onChange={handleSeguroAsientoToggle}
                  options={seguroAsientoOptions}
                />
                <InputField
                  label="Expiración"
                  name="vencimientoSeguroAsiento"
                  type="date"
                  disabled={getSeguroAsientoStatus() !== 'APLICA'}
                  value={getSeguroAsientoStatus() === 'APLICA' ? toISODate(formData.vencimientoSeguroAsiento || '') : ''}
                  onChange={handleChange}
                />
                <InputField label="Aseguradora" name="aseguradoraAsiento" value={formData.aseguradoraAsiento || ''} onChange={handleChange} />
              </div>
              <div className="p-5 bg-amber-950/5 rounded-2xl border border-amber-900/10 space-y-4">
                <label className="text-[8px] font-black text-amber-700 uppercase block border-b border-amber-900/20 pb-2 tracking-[0.2em]">S. Vida Conductor</label>
                <InputField label="Expiración" name="vencimientoSeguroVidaConductor" type="date" value={toISODate(formData.vencimientoSeguroVidaConductor || '')} onChange={handleChange} highlight={hl} />
                <InputField label="Aseguradora" name="aseguradoraVida" value={formData.aseguradoraVida || ''} onChange={handleChange} highlight={hl} />
              </div>
            </div>
          </section>

          {/* Conductor */}
          <section>
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-6">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] flex items-center gap-3">
                <span className="text-sm">🆔</span> Gestión de Operador Humano
              </h3>
              {!initialData && conductorStatus === 'loading' && (
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest animate-pulse">Buscando conductor...</span>
              )}
              {!initialData && conductorStatus === 'found' && (
                <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-900/30 text-emerald-400">
                  ✓ Conductor registrado — datos cargados
                </span>
              )}
              {!initialData && conductorStatus === 'new' && (
                <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-amber-900/20 text-amber-600">
                  Nuevo conductor
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                <InputField label="RUT Operador" name="rutConductor" required value={formData.rutConductor || ''} onChange={handleChange} onBlur={handleRutBlur} />
                <InputField label="Nombre Completo" name="nombreConductor" required value={formData.nombreConductor || ''} onChange={handleChange} highlight={hl} />
                <InputField label="Nacimiento" name="fechaNacimiento" type="date" required value={toISODate(formData.fechaNacimiento || '')} onChange={handleChange} highlight={hl} />
                <InputField label="Celular" name="celular" value={formData.celular || ''} onChange={handleChange} highlight={hl} />
                <InputField label="Email" name="email" type="email" value={formData.email || ''} onChange={handleChange} highlight={hl} />
                <InputField label="Dirección" name="direccion" value={formData.direccion || ''} onChange={handleChange} highlight={hl} />
                <InputField label="Comuna" name="comuna" value={formData.comuna || ''} onChange={handleChange} highlight={hl} />
              </div>

              <div className="p-6 bg-emerald-950/5 rounded-2xl border border-emerald-900/10 space-y-5">
                <label className="text-[8px] font-black text-emerald-800 uppercase block border-b border-emerald-900/20 pb-2 tracking-[0.2em]">Identidad (C.I.)</label>
                <div className="flex gap-4">
                  <InputField label="Desde" name="vigenciaCarnetDesde" type="date" value={toISODate(formData.vigenciaCarnetDesde || '')} onChange={handleChange} highlight={hl} />
                  <InputField label="Hasta" name="vigenciaCarnetHasta" type="date" required value={toISODate(formData.vigenciaCarnetHasta || '')} onChange={handleChange} highlight={hl} />
                </div>
              </div>

              <div className="p-6 bg-emerald-950/5 rounded-2xl border border-emerald-900/10 space-y-5">
                <label className="text-[8px] font-black text-emerald-800 uppercase block border-b border-emerald-900/20 pb-2 tracking-[0.2em]">Licencia Conducir</label>
                <div className="flex gap-4">
                  <InputField label="Emisión" name="vigenciaLicenciaDesde" type="date" value={toISODate(formData.vigenciaLicenciaDesde || '')} onChange={handleChange} highlight={hl} />
                  <InputField label="Control" name="vigenciaLicenciaHasta" type="date" required value={toISODate(formData.vigenciaLicenciaHasta || '')} onChange={handleChange} highlight={hl} />
                </div>
                <InputField label="Clase" name="claseLicencia" placeholder="A2, A3, B..." value={formData.claseLicencia || ''} onChange={handleChange} highlight={hl} />
                <InputField label="Municipalidad que otorga" name="municipalidadLicencia" value={formData.municipalidadLicencia || ''} onChange={handleChange} highlight={hl} />
                <InputField label="Ley Licencia" name="leyLicencia" placeholder="19.495" value={formData.leyLicencia || ''} onChange={handleChange} highlight={hl} />
              </div>
            </div>
          </section>
        </form>

        <div className="p-8 border-t border-white/5 bg-black/20 flex justify-end gap-6">
          <button onClick={onClose} className="px-8 py-3.5 btn-secondary rounded-xl text-[10px] font-black uppercase tracking-widest">Descartar</button>
          <button onClick={handleSubmit} className="px-12 py-3.5 btn-premium rounded-xl font-black text-[10px] uppercase tracking-[0.2em] italic">
            Sincronizar Cambios Globales
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleModal;
