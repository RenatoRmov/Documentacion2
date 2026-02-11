
import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';

const Label = ({ text }: { text: string }) => (
  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block mb-2 px-1">{text}</label>
);

interface InputProps {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (name: string, value: string) => void;
}

const Input = ({ name, label, type = "date", placeholder = "", value, onChange }: InputProps) => (
  <div className="flex-1 space-y-1">
    <Label text={label} />
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      placeholder={placeholder}
      className={`w-full ${type === 'date' ? 'px-3' : 'px-5'} py-4 bg-[#0A0C0E] border border-white/5 rounded-xl focus:border-[#C29329]/40 focus:bg-black/40 outline-none text-xs transition-all text-zinc-200 font-semibold min-w-0`}
    />
  </div>
);

const Select = ({ name, label, value, options, onChange }: { name: string, label: string, value: string, options: { label: string, value: string }[], onChange: (name: string, value: string) => void }) => (
  <div className="flex-1 space-y-1">
    <Label text={label} />
    <select
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      className="w-full px-5 py-4 bg-[#0A0C0E] border border-white/5 rounded-xl focus:border-[#C29329]/40 outline-none text-xs transition-all text-zinc-200 font-bold appearance-none cursor-pointer"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

interface QuickUpdateProps {
  fleet: Vehicle[];
  onUpdate: (vehicleId: string, updates: Partial<Vehicle>) => void;
}

const QuickUpdate: React.FC<QuickUpdateProps> = ({ fleet, onUpdate }) => {
  const [selectedMovil, setSelectedMovil] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const docOptions = [
    { label: '📝 Padrón', value: 'padron' },
    { label: '🎫 Permiso de Circulación', value: 'permiso' },
    { label: '👮 Certificado Antecedentes', value: 'antecedentes' },
    { label: '📟 Control Taxímetro', value: 'taximetro' },
    { label: '🔍 Revisión Técnica', value: 'revision' },
    { label: '📜 SOAP', value: 'soap' },
    { label: '🛡️ Seguro Accidentes', value: 'seguro_accidentes' },
    { label: '🪑 Seguro Asiento', value: 'seguro_asiento' },
    { label: '❤️ Seguro Vida Conductor', value: 'seguro_vida' },
    { label: '🆔 Carnet de Identidad', value: 'carnet' },
    { label: '🪪 Licencia de Conducir', value: 'licencia' },
    { label: '📁 Prestación de SS', value: 'prestacion' },
    { label: '📝 Contrato Arriendo', value: 'arriendo' },
  ];

  useEffect(() => {
    setFormData({});
    setSuccess(false);
  }, [selectedDoc, selectedMovil]);

  const handleUpdate = () => {
    if (!selectedMovil || !selectedDoc) return;

    let updates: Partial<Vehicle> = {};
    const f = formData;

    switch (selectedDoc) {
      case 'padron':
        updates = { vencimientoPadron: f.fecha }; break;
      case 'permiso':
        updates = { vencimientoPermisoCirculacion: f.fecha, municipalidadPermiso: f.extra || '' }; break;
      case 'antecedentes':
        updates = { certificadoAntecedentes: f.status as any }; break;
      case 'taximetro':
        updates = { vencimientoControlTaximetro: f.mode === 'No Aplica' ? 'No Aplica' : (f.mode === 'Sin Información' ? 'Sin Información' : f.fecha) }; break;
      case 'revision':
        updates = { vencimientoRevisionTecnica: f.fecha }; break;
      case 'soap':
        updates = { vencimientoSOAP: f.fecha }; break;
      case 'seguro_accidentes':
        updates = { vencimientoSeguroAccidentes: f.fecha, lugarSeguroAccidentes: f.extra || '' }; break;
      case 'seguro_asiento':
        updates = { vencimientoSeguroAsiento: f.fecha, aseguradoraAsiento: f.extra || '' }; break;
      case 'seguro_vida':
        updates = { vencimientoSeguroVidaConductor: f.fecha, aseguradoraVida: f.extra || '' }; break;
      case 'carnet':
        updates = { vigenciaCarnetDesde: f.desde || '', vigenciaCarnetHasta: f.fecha }; break;
      case 'licencia':
        updates = { vigenciaLicenciaDesde: f.desde || '', vigenciaLicenciaHasta: f.fecha }; break;
      case 'prestacion':
        updates = { prestacionSS: f.status as any }; break;
      case 'arriendo':
        updates = { contratoArriendo: f.status as any }; break;
    }

    onUpdate(selectedMovil, updates);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setFormData({});
      setSelectedDoc('');
    }, 2000);
  };

  const handleInputChange = (name: string, value: string) => {
    const finalValue = value.includes('-') && value.length === 10 && value.split('-')[0].length === 4
      ? fromISODate(value)
      : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const isFormValid = selectedMovil && selectedDoc && (
    formData.fecha ||
    formData.status ||
    (selectedDoc === 'taximetro' && (formData.mode === 'No Aplica' || formData.mode === 'Sin Información')) ||
    (selectedDoc === 'taximetro' && formData.mode === 'Fecha' && formData.fecha)
  );

  const renderFields = () => {
    const commonProps = { onChange: handleInputChange };

    switch (selectedDoc) {
      case 'prestacion':
      case 'arriendo':
      case 'antecedentes':
        return (
          <div className="max-w-xs animate-in fade-in slide-in-from-top-2 duration-400">
            <Select
              name="status"
              label="Actualizar Estado Operativo"
              value={formData.status || 'Sin Información'}
              options={[
                { label: '--- Sin Información ---', value: 'Sin Información' },
                { label: '✓ OK / Vigente', value: 'OK' },
                { label: '✗ No Aplica', value: 'No Aplica' }
              ]}
              {...commonProps}
            />
          </div>
        );
      case 'taximetro':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Select
              name="mode"
              label="Modo de Registro"
              value={formData.mode || 'Sin Información'}
              options={[
                { label: '--- Sin Información ---', value: 'Sin Información' },
                { label: '📅 Nueva Fecha Vencimiento', value: 'Fecha' },
                { label: '✗ Marcar como "No Aplica"', value: 'No Aplica' }
              ]}
              {...commonProps}
            />
            {formData.mode === 'Fecha' && (
              <Input name="fecha" label="Nueva Fecha" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
            )}
          </div>
        );
      case 'permiso':
      case 'seguro_accidentes':
      case 'seguro_asiento':
      case 'seguro_vida':
        return (
          <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="fecha" label="Nueva Fecha Vencimiento" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
            <Input name="extra" label={selectedDoc === 'permiso' ? 'Municipalidad' : 'Compañía / Lugar'} type="text" placeholder="Especificar..." value={formData.extra || ''} {...commonProps} />
          </div>
        );
      case 'padron':
        return (
          <div className="max-w-xs animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="fecha" label="Nueva Fecha Vencimiento" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
          </div>
        );
      case 'carnet':
      case 'licencia':
        return (
          <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="desde" label="Fecha Emisión" type="date" value={toISODate(formData.desde || '')} {...commonProps} />
            <Input name="fecha" label="Fecha Vencimiento" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
          </div>
        );
      default:
        return (
          <div className="max-w-xs animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="fecha" label="Vencimiento Final" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-250px)] w-full py-4">
      <div className="bg-[#1B1F24] shadow-[0_30px_100px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden w-full max-w-2xl relative border border-white/5">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#C29329]/5 blur-[80px] rounded-full -mr-24 -mt-24"></div>

        <div className="p-12 space-y-10 relative z-10">
          <div className="flex items-center justify-between border-b border-white/5 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 brand-gradient rounded-xl flex items-center justify-center text-[#0A0C0E] shadow-[0_0_20px_rgba(194,147,41,0.2)]">
                <span className="text-xl">⚡</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-widest uppercase italic leading-none">Terminal de Sincronización</h3>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Protocolo RM-SYNC v5.0</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label text="01. Identificador de Activo" />
              <div className="relative">
                <select
                  value={selectedMovil}
                  onChange={(e) => setSelectedMovil(e.target.value)}
                  className="w-full pl-5 pr-10 py-4 bg-[#0A0C0E] border border-white/5 rounded-xl focus:border-[#C29329]/40 outline-none text-[11px] font-black text-zinc-200 appearance-none cursor-pointer hover:bg-black transition-all"
                >
                  <option value="" className="bg-[#1B1F24]">ELEGIR MÓVIL...</option>
                  {fleet.sort((a, b) => parseInt(a.id) - parseInt(b.id)).map(v => (
                    <option key={v.id} value={v.id} className="bg-[#1B1F24]">MÓVIL {v.id} · [{v.patente}]</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#C29329] text-[9px] opacity-30">▼</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label text="02. Parámetro de Auditoría" />
              <div className="relative">
                <select
                  value={selectedDoc}
                  onChange={(e) => setSelectedDoc(e.target.value)}
                  className="w-full pl-5 pr-10 py-4 bg-[#0A0C0E] border border-white/5 rounded-xl focus:border-[#C29329]/40 outline-none text-[11px] font-bold text-zinc-200 appearance-none cursor-pointer hover:bg-black transition-all"
                >
                  <option value="" className="bg-[#1B1F24]">REGISTRO OPERATIVO...</option>
                  {docOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-[#1B1F24]">{opt.label}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#C29329] text-[9px] opacity-30">▼</div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-black/40 border border-white/[0.03] min-h-[160px] flex flex-col justify-center transition-all duration-500">
            {selectedDoc ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-[1px] w-8 bg-zinc-800"></div>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.5em]">Actualización de Registro Global</span>
                </div>
                {renderFields()}
              </div>
            ) : (
              <div className="text-center py-6 opacity-10">
                <div className="text-5xl mb-4">⌨</div>
                <p className="text-white font-black uppercase tracking-[0.3em] text-[9px]">Aguardando Entrada de Parámetros de Auditoría</p>
              </div>
            )}
          </div>

          <button
            onClick={handleUpdate}
            disabled={!isFormValid}
            className={`w-full py-5 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-3 ${isFormValid
                ? 'btn-premium'
                : 'bg-white/[0.02] text-zinc-800 border border-white/[0.02] cursor-not-allowed'
              }`}
          >
            {success ? '✓ SINCRONIZACIÓN EXITOSA' : 'Ejecutar Comando de Sincronización'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickUpdate;
