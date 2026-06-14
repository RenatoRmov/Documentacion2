
import React, { useState } from 'react';
import { Vehicle } from '../types';
import StatusBadge from './StatusBadge';
import * as XLSX from 'xlsx';

interface FleetTableProps {
  fleet: Vehicle[];
  onEdit: (v: Vehicle) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onSendAlert?: (patentes: string[]) => Promise<void>;
}

const FleetTable: React.FC<FleetTableProps> = ({ fleet, onEdit, onAdd, onDelete, onToggleStatus, onSendAlert }) => {
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [copied, setCopied]         = useState<string | null>(null);
  const [sendingAlert, setSendingAlert] = useState(false);

  const filtered = fleet.filter(v =>
    v.patente.toLowerCase().includes(search.toLowerCase()) ||
    v.nombreConductor.toLowerCase().includes(search.toLowerCase()) ||
    v.id.includes(search)
  ).sort((a, b) => parseInt(a.id) - parseInt(b.id));

  // ── Checkbox helpers ──

  const allFilteredSelected = filtered.length > 0 && filtered.every(v => selected.has(v.patente));
  const someFilteredSelected = filtered.some(v => selected.has(v.patente)) && !allFilteredSelected;

  const toggleRow = (patente: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(patente) ? s.delete(patente) : s.add(patente);
      return s;
    });
  };

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(v => s.delete(v.patente)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(v => s.add(v.patente)); return s; });
    }
  };

  // ── Copy portal link ──

  const copyPortalLink = (v: Vehicle) => {
    const url = `${window.location.origin}/portal`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(v.patente);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // ── Send alert to selected ──

  const handleSendAlert = async () => {
    if (!onSendAlert) return;
    setSendingAlert(true);
    try {
      // If nothing selected → send to all visible vehicles
      const targets = selected.size > 0 ? [...selected] : filtered.map(v => v.patente);
      await onSendAlert(targets);
    } finally {
      setSendingAlert(false);
    }
  };

  // ── Excel export ──

  const handleExportExcel = () => {
    const dataToExport = fleet.map(v => ({
      'Móvil':              v.id,
      'Patente':            v.patente,
      'Estado':             v.statusOperativo,
      'Tipo':               v.tipo,
      'Marca':              v.marca,
      'Modelo':             v.modelo,
      'Año':                v.año,
      'Color':              v.color,
      'Conductor':          v.nombreConductor,
      'RUT Conductor':      v.rutConductor,
      'Celular':            v.celular,
      'Email':              v.email,
      'Carnet (venc.)':     v.vigenciaCarnetHasta,
      'Licencia (venc.)':   v.vigenciaLicenciaHasta,
      'Clase Licencia':     v.claseLicencia,
      'Municipalidad Lic.': v.municipalidadLicencia,
      'Permiso Circ. (venc.)':  v.vencimientoPermisoCirculacion,
      'Municipalidad Permiso':  v.municipalidadPermiso,
      'Rev. Técnica (venc.)':   v.vencimientoRevisionTecnica,
      'SOAP (venc.)':           v.vencimientoSOAP,
      'Seg. Asiento (venc.)':   v.vencimientoSeguroAsiento,
      'Aseguradora Asiento':    v.aseguradoraAsiento,
      'Control Taxímetro':      v.vencimientoControlTaximetro,
      'Padrón (archivo)':       v.urlPadron ? 'Adjunto' : 'Sin adjunto',
      'Propietario':            v.nombrePropietario,
      'RUT Propietario':        v.rutPropietario,
      'Cert. Antecedentes':     v.certificadoAntecedentes,
      'Prestación SS':          v.prestacionSS,
      'Contrato Arriendo':      v.contratoArriendo,
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flota RadioMovil');
    XLSX.writeFile(wb, `Flota_RadioMovil_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-10">
      {/* Top bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="relative group max-w-xl w-full">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C29329] transition-colors text-sm">🔍</span>
          <input type="text"
            placeholder="Buscar por activo, patente o identificación de operador..."
            className="w-full pl-14 pr-6 py-4 bg-[#0A0C0E] border border-white/5 rounded-xl focus:outline-none focus:border-[#C29329]/30 transition-all text-[11px] font-medium text-zinc-300 placeholder:text-zinc-700 italic tracking-wide"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleExportExcel}
            className="px-8 py-4 bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/50 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 group">
            <span className="text-base group-hover:scale-110 transition-transform">📊</span>
            Exportar Excel
          </button>
          <button onClick={onAdd} className="px-10 py-4 btn-premium rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
            Registrar Activo +
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1B1F24] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/5">
                {/* Checkbox header */}
                <th className="px-5 py-6 w-10">
                  <div
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                      allFilteredSelected ? 'bg-[#C29329] border-[#C29329]' :
                      someFilteredSelected ? 'bg-[#C29329]/30 border-[#C29329]/60' :
                      'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {allFilteredSelected && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {someFilteredSelected && <div className="w-2 h-0.5 bg-[#C29329]" />}
                  </div>
                </th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Identificador</th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Activo Fijo</th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Responsable</th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Rev. Técnica</th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Antecedentes</th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Licencia</th>
                <th className="px-6 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.map(v => {
                const isSelected = selected.has(v.patente);
                return (
                  <tr key={v.patente}
                    className={`transition-all group ${v.statusOperativo === 'Inactivo' ? 'opacity-40' : ''} ${isSelected ? 'bg-[#C29329]/[0.04]' : 'hover:bg-white/[0.01]'}`}>

                    {/* Checkbox */}
                    <td className="px-5 py-7">
                      <div onClick={() => toggleRow(v.patente)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                          isSelected ? 'bg-[#C29329] border-[#C29329]' : 'border-zinc-700 hover:border-zinc-500'
                        }`}>
                        {isSelected && <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="black" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </td>

                    <td className="px-6 py-7">
                      <div className={`w-10 h-10 rounded-md bg-[#0A0C0E] border border-white/5 flex items-center justify-center font-black italic text-xs transition-colors ${v.statusOperativo === 'Activo' ? 'text-zinc-400 group-hover:border-[#C29329]/30' : 'text-zinc-700 border-dashed'}`}>
                        {v.id}
                      </div>
                    </td>

                    <td className="px-6 py-7">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-black text-white tracking-widest italic uppercase">{v.patente}</p>
                        {v.statusOperativo === 'Inactivo' && (
                          <span className="text-[7px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">Fuera</span>
                        )}
                      </div>
                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-2">{v.marca} · {v.modelo}</p>
                    </td>

                    <td className="px-6 py-7">
                      <p className="text-[11px] font-bold text-zinc-400">{v.nombreConductor}</p>
                      <p className="text-[8px] text-zinc-700 font-mono mt-1 tracking-tighter uppercase">RUT: {v.rutConductor}</p>
                    </td>

                    <td className="px-6 py-7"><StatusBadge dateStr={v.vencimientoRevisionTecnica} /></td>

                    <td className="px-6 py-7">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${v.certificadoAntecedentes === 'OK' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {v.certificadoAntecedentes || 'Sin Info'}
                      </span>
                    </td>

                    <td className="px-6 py-7"><StatusBadge dateStr={v.vigenciaLicenciaHasta} /></td>

                    {/* Actions */}
                    <td className="px-6 py-7 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(v)}
                          className="p-2.5 text-zinc-600 hover:text-[#C29329] bg-white/[0.02] hover:bg-[#C29329]/10 rounded-lg transition-all border border-white/5"
                          title="Auditar Ficha">📂</button>

                        <button onClick={() => copyPortalLink(v)}
                          className={`p-2.5 rounded-lg transition-all border border-white/5 ${
                            copied === v.patente
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : 'text-zinc-600 hover:text-blue-400 bg-white/[0.02] hover:bg-blue-500/10'
                          }`}
                          title={copied === v.patente ? '¡Copiado!' : 'Copiar link portal conductores'}>
                          {copied === v.patente ? '✓' : '🔗'}
                        </button>

                        <button onClick={() => onToggleStatus(v.patente)}
                          className={`p-2.5 rounded-lg transition-all border border-white/5 ${v.statusOperativo === 'Activo' ? 'text-zinc-600 hover:text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10'}`}
                          title={v.statusOperativo === 'Activo' ? 'Desactivar Móvil' : 'Reactivar Móvil'}>
                          {v.statusOperativo === 'Activo' ? '🚫' : '✅'}
                        </button>

                        <button onClick={() => { if (window.confirm('¿ELIMINAR DEFINITIVAMENTE EL MÓVIL ' + v.id + ' (' + v.patente + ')?')) onDelete(v.patente); }}
                          className="p-2.5 text-zinc-600 hover:text-red-500 bg-white/[0.02] hover:bg-red-500/10 rounded-lg transition-all border border-white/5"
                          title="Borrar Registro">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-40 text-center">
            <div className="text-4xl mb-6 opacity-5">🔍</div>
            <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">Sin Coincidencias</h4>
            <p className="text-[8px] text-zinc-800 uppercase tracking-widest mt-3 italic">Refine los criterios de búsqueda global</p>
          </div>
        )}
      </div>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-[#1B1F24] border border-[#C29329]/30 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest whitespace-nowrap">
            {selected.size} móvil{selected.size !== 1 ? 'es' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="w-px h-5 bg-white/10" />
          {onSendAlert && (
            <button onClick={handleSendAlert} disabled={sendingAlert}
              className="px-5 py-2 text-[9px] font-black uppercase tracking-widest bg-[#C29329]/20 border border-[#C29329]/40 text-[#C29329] rounded-xl hover:bg-[#C29329]/30 transition-all disabled:opacity-40 whitespace-nowrap">
              {sendingAlert ? 'Enviando...' : '📧 Enviar alerta'}
            </button>
          )}
          <button onClick={() => setSelected(new Set())}
            className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-300 transition-all">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default FleetTable;
