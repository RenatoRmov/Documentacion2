
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
}

const FleetTable: React.FC<FleetTableProps> = ({ fleet, onEdit, onAdd, onDelete, onToggleStatus }) => {
  const [search, setSearch] = useState('');
  const filtered = fleet.filter(v => 
    v.patente.toLowerCase().includes(search.toLowerCase()) ||
    v.nombreConductor.toLowerCase().includes(search.toLowerCase()) ||
    v.id.includes(search)
  ).sort((a, b) => parseInt(a.id) - parseInt(b.id));

  const handleExportExcel = () => {
    const dataToExport = fleet.map(v => ({
      'Móvil': v.id,
      'Patente': v.patente,
      'Estado Operativo': v.statusOperativo,
      'Tipo': v.tipo,
      'Marca': v.marca,
      'Modelo': v.modelo,
      'Año': v.año,
      'Conductor': v.nombreConductor,
      'Venc. Revisión Técnica': v.vencimientoRevisionTecnica,
      'Venc. Permiso Circulación': v.vencimientoPermisoCirculacion,
      'Venc. SOAP': v.vencimientoSOAP
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Flota RadioMovil");
    XLSX.writeFile(workbook, `Flota_RadioMovil_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="relative group max-w-xl w-full">
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-[#C29329] transition-colors text-sm">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar por activo, patente o identificación de operador..." 
            className="w-full pl-14 pr-6 py-4 bg-[#0A0C0E] border border-white/5 rounded-xl focus:outline-none focus:border-[#C29329]/30 transition-all text-[11px] font-medium text-zinc-300 placeholder:text-zinc-700 italic tracking-wide"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleExportExcel}
            className="px-8 py-4 bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/50 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 group"
          >
            <span className="text-base group-hover:scale-110 transition-transform">📊</span>
            Exportar Excel
          </button>
          <button onClick={onAdd} className="px-10 py-4 btn-premium rounded-xl text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
            Registrar Activo +
          </button>
        </div>
      </div>

      <div className="bg-[#1B1F24] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/5">
                <th className="px-10 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Identificador</th>
                <th className="px-10 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Activo Fijo</th>
                <th className="px-10 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Responsable</th>
                <th className="px-10 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Rev. Técnica</th>
                <th className="px-10 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Licencia</th>
                <th className="px-10 py-6 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.map((v) => (
                <tr key={v.id} className={`hover:bg-white/[0.01] transition-all group ${v.statusOperativo === 'Inactivo' ? 'opacity-40' : ''}`}>
                  <td className="px-10 py-7">
                    <div className={`w-10 h-10 rounded-md bg-[#0A0C0E] border border-white/5 flex items-center justify-center font-black italic text-xs transition-colors ${v.statusOperativo === 'Activo' ? 'text-zinc-400 group-hover:border-[#C29329]/30' : 'text-zinc-700 border-dashed'}`}>
                      {v.id}
                    </div>
                  </td>
                  <td className="px-10 py-7">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-black text-white tracking-widest italic uppercase">{v.patente}</p>
                      {v.statusOperativo === 'Inactivo' && (
                        <span className="text-[7px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">Fuera</span>
                      )}
                    </div>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-2">{v.marca} · {v.modelo}</p>
                  </td>
                  <td className="px-10 py-7">
                    <p className="text-[11px] font-bold text-zinc-400">{v.nombreConductor}</p>
                    <p className="text-[8px] text-zinc-700 font-mono mt-1 tracking-tighter uppercase">RUT: {v.rutConductor}</p>
                  </td>
                  <td className="px-10 py-7">
                    <StatusBadge dateStr={v.vencimientoRevisionTecnica} />
                  </td>
                  <td className="px-10 py-7">
                    <StatusBadge dateStr={v.vigenciaLicenciaHasta} />
                  </td>
                  <td className="px-10 py-7 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEdit(v)}
                        className="p-2.5 text-zinc-600 hover:text-[#C29329] bg-white/[0.02] hover:bg-[#C29329]/10 rounded-lg transition-all border border-white/5"
                        title="Auditar Ficha"
                      >
                        📂
                      </button>
                      <button 
                        onClick={() => onToggleStatus(v.id)}
                        className={`p-2.5 rounded-lg transition-all border border-white/5 ${v.statusOperativo === 'Activo' ? 'text-zinc-600 hover:text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10'}`}
                        title={v.statusOperativo === 'Activo' ? 'Desactivar Móvil' : 'Reactivar Móvil'}
                      >
                        {v.statusOperativo === 'Activo' ? '🚫' : '✅'}
                      </button>
                      <button 
                        onClick={() => { if(window.confirm('¿ELIMINAR DEFINITIVAMENTE EL MÓVIL ' + v.id + '?')) onDelete(v.id); }}
                        className="p-2.5 text-zinc-600 hover:text-red-500 bg-white/[0.02] hover:bg-red-500/10 rounded-lg transition-all border border-white/5"
                        title="Borrar Registro"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
};

export default FleetTable;
