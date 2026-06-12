
import React, { useState, useEffect, useRef } from 'react';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';
import { uploadDoc } from '../services/storageService';

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

// URL field in Vehicle for each doc type (null = no file storage)
const DOC_URL_KEY: Record<string, keyof Vehicle | null> = {
  padron:            'urlPadron',
  permiso:           'urlPermisoCirculacion',
  revision:          'urlRevisionTecnica',
  soap:              'urlSOAP',
  seguro_asiento:    'urlSeguroAsiento',
  carnet:            'urlCarnet',
  licencia:          'urlLicencia',
  antecedentes:      null,
  taximetro:         null,
  seguro_accidentes: null,
  seguro_vida:       null,
  prestacion:        null,
  arriendo:          null,
};

// These URL keys belong to conductores table, need RUT path
const CONDUCTOR_URL_KEYS = new Set(['urlCarnet', 'urlLicencia']);

interface QuickUpdateProps {
  fleet: Vehicle[];
  onUpdate: (vehicleId: string, updates: Partial<Vehicle>) => void;
}

const QuickUpdate: React.FC<QuickUpdateProps> = ({ fleet, onUpdate }) => {
  const [selectedMovil, setSelectedMovil] = useState('');
  const [selectedDoc, setSelectedDoc]     = useState<string>('');
  const [formData, setFormData]           = useState<Record<string, string>>({});
  const [success, setSuccess]             = useState(false);
  const [uploading, setUploading]         = useState(false);
  const [uploadedUrl, setUploadedUrl]     = useState<string | null>(null);
  const [uploadedName, setUploadedName]   = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const docOptions = [
    { label: '📝 Padrón',                   value: 'padron' },
    { label: '🎫 Permiso de Circulación',    value: 'permiso' },
    { label: '👮 Certificado Antecedentes',  value: 'antecedentes' },
    { label: '📟 Control Taxímetro',         value: 'taximetro' },
    { label: '🔍 Revisión Técnica',          value: 'revision' },
    { label: '📜 SOAP',                      value: 'soap' },
    { label: '🛡️ Seguro Accidentes',        value: 'seguro_accidentes' },
    { label: '🪑 Seguro Asiento',            value: 'seguro_asiento' },
    { label: '❤️ Seguro Vida Conductor',     value: 'seguro_vida' },
    { label: '🆔 Carnet de Identidad',       value: 'carnet' },
    { label: '🪪 Licencia de Conducir',      value: 'licencia' },
    { label: '📁 Prestación de SS',          value: 'prestacion' },
    { label: '📝 Contrato Arriendo',         value: 'arriendo' },
  ];

  useEffect(() => {
    setFormData({});
    setSuccess(false);
    setUploadedUrl(null);
    setUploadedName('');
  }, [selectedDoc, selectedMovil]);

  const urlKey = DOC_URL_KEY[selectedDoc] as string | null | undefined;
  const supportsFile = !!(urlKey);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !urlKey || !selectedMovil) return;

    const vehicle = fleet.find(v => v.patente === selectedMovil);
    if (!vehicle) return;

    setUploading(true);
    setUploadedUrl(null);
    try {
      const storagePath = CONDUCTOR_URL_KEYS.has(urlKey)
        ? `conductores/${(vehicle.rutConductor || '').replace(/\./g, '')}/${urlKey}`
        : `vehicles/${selectedMovil}/${urlKey}`;
      const url = await uploadDoc(storagePath, file);
      setUploadedUrl(url);
      setUploadedName(file.name);
    } catch (err: unknown) {
      alert(`Error al subir el archivo:\n${err instanceof Error ? err.message : JSON.stringify(err)}`);
    } finally {
      setUploading(false);
    }
  };

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
        updates = { certificadoAntecedentes: f.status as Vehicle['certificadoAntecedentes'] }; break;
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
        updates = { prestacionSS: f.status as Vehicle['prestacionSS'] }; break;
      case 'arriendo':
        updates = { contratoArriendo: f.status as Vehicle['contratoArriendo'] }; break;
    }

    if (uploadedUrl && urlKey) {
      updates = { ...updates, [urlKey]: uploadedUrl };
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
    uploadedUrl ||
    (selectedDoc === 'taximetro' && (formData.mode === 'No Aplica' || formData.mode === 'Sin Información')) ||
    (selectedDoc === 'taximetro' && formData.mode === 'Fecha' && formData.fecha)
  );

  const renderFields = () => {
    const commonProps = { onChange: handleInputChange };

    const fileZone = supportsFile ? (
      <div className="col-span-full mt-2">
        <Label text="Documento Adjunto (foto o PDF)" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !selectedMovil}
          className={`w-full flex items-center gap-3 px-5 py-4 rounded-xl border transition-all text-left
            ${uploadedUrl
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
              : 'border-white/5 bg-[#0A0C0E] text-zinc-500 hover:border-[#C29329]/30 hover:text-zinc-300'
            } ${uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        >
          {uploading ? (
            <>
              <span className="animate-spin text-base">⏳</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">Subiendo...</span>
            </>
          ) : uploadedUrl ? (
            <>
              <span className="text-base">✅</span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Archivo cargado</p>
                <p className="text-[9px] text-zinc-500 truncate max-w-xs">{uploadedName}</p>
              </div>
              <span className="ml-auto text-[9px] text-zinc-600 hover:text-zinc-400 shrink-0">Cambiar →</span>
            </>
          ) : (
            <>
              <span className="text-base">📎</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest">Subir documento</p>
                <p className="text-[9px] text-zinc-700">Foto, PDF o HEIC · Opcional</p>
              </div>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.heic,.heif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    ) : null;

    switch (selectedDoc) {
      case 'prestacion':
      case 'arriendo':
      case 'antecedentes':
        return (
          <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <div className="max-w-xs">
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
            {fileZone}
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
            {fileZone}
          </div>
        );
      case 'permiso':
      case 'seguro_accidentes':
      case 'seguro_asiento':
      case 'seguro_vida':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="fecha" label="Nueva Fecha Vencimiento" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
            <Input name="extra" label={selectedDoc === 'permiso' ? 'Municipalidad' : 'Compañía / Lugar'} type="text" placeholder="Especificar..." value={formData.extra || ''} {...commonProps} />
            {fileZone}
          </div>
        );
      case 'padron':
      case 'revision':
      case 'soap':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="fecha" label="Nueva Fecha Vencimiento" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
            {fileZone}
          </div>
        );
      case 'carnet':
      case 'licencia':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="desde" label="Fecha Emisión"    type="date" value={toISODate(formData.desde || '')} {...commonProps} />
            <Input name="fecha" label="Fecha Vencimiento" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
            {fileZone}
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-400">
            <Input name="fecha" label="Vencimiento Final" type="date" value={toISODate(formData.fecha || '')} {...commonProps} />
            {fileZone}
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
                    <option key={v.patente} value={v.patente} className="bg-[#1B1F24]">MÓVIL {v.id} · [{v.patente}]</option>
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
            disabled={!isFormValid || uploading}
            className={`w-full py-5 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-3 ${isFormValid && !uploading
                ? 'btn-premium'
                : 'bg-white/[0.02] text-zinc-800 border border-white/[0.02] cursor-not-allowed'
              }`}
          >
            {success ? '✓ SINCRONIZACIÓN EXITOSA' : uploading ? '⏳ SUBIENDO ARCHIVO...' : 'Ejecutar Comando de Sincronización'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickUpdate;
