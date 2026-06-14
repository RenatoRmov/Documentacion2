
import React, { useState } from 'react';
import { Vehicle } from '../types';
import { parseDate } from '../constants';
import StatusBadge from './StatusBadge';

interface DashboardProps {
  fleet: Vehicle[];
  onSelectVehicle: (v: Vehicle) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ fleet, onSelectVehicle }) => {
  const [showAuditBreakdown, setShowAuditBreakdown] = useState(false);
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const auditFields: { key: keyof Vehicle; label: string }[] = [
    { key: 'vigenciaCarnetHasta',           label: 'Carnet de Identidad' },
    { key: 'vigenciaLicenciaHasta',         label: 'Licencia de Conducir' },
    { key: 'vencimientoPermisoCirculacion', label: 'Permiso de Circulación' },
    { key: 'vencimientoRevisionTecnica',    label: 'Revisión Técnica' },
    { key: 'vencimientoSOAP',               label: 'SOAP' },
    { key: 'vencimientoSeguroAsiento',      label: 'Seguro de Asientos' },
    { key: 'vencimientoControlTaximetro',   label: 'Control Taxímetro' },
  ];

  const stats = fleet.reduce((acc, v) => {
    // 0. Contar Totales (Independiente de si es Activo o no)
    acc.total++;
    if (v.statusOperativo === 'Activo') acc.activeCount++;
    else acc.inactiveCount++;

    // SOLO PROCESAR ALERTAS PARA MÓVILES ACTIVOS
    if (v.statusOperativo === 'Activo') {
      // 1. Auditoría
      auditFields.forEach(field => {
        const val = v[field.key];
        const isMissing = !val || val === '' || val === 'Sin Información';
        if (isMissing) {
          acc.missing++;
          acc.breakdown[field.label] = (acc.breakdown[field.label] || 0) + 1;
        }
      });

      // 2. Vencimientos
      const docValues = [
        v.vigenciaCarnetHasta, v.vigenciaLicenciaHasta,
        v.vencimientoPermisoCirculacion, v.vencimientoRevisionTecnica, v.vencimientoSOAP,
        v.vencimientoSeguroAsiento, v.vencimientoControlTaximetro,
      ];

      const validDocs = docValues.filter(d => d && d.toLowerCase() !== 'no aplica' && d !== 'Sin Información' && d.trim() !== '');
      let isExpired = false;
      let isWarning = false;
      
      validDocs.forEach(d => {
        const date = parseDate(d);
        if (date) {
          if (date < today) isExpired = true;
          else if (date < thirtyDaysFromNow) isWarning = true;
        }
      });

      if (isExpired) acc.expired++;
      else if (isWarning) acc.warning++;
      else acc.ok++;
    }
    
    return acc;
  }, { ok: 0, warning: 0, expired: 0, missing: 0, total: 0, activeCount: 0, inactiveCount: 0, breakdown: {} as Record<string, number> });

  const criticalList = fleet
    .filter(v => v.statusOperativo === 'Activo') // Solo móviles activos en el radar crítico
    .map(v => {
      const docDates = [
        { name: 'Permiso Circulación', date: parseDate(v.vencimientoPermisoCirculacion), str: v.vencimientoPermisoCirculacion },
        { name: 'Carnet Identidad', date: parseDate(v.vigenciaCarnetHasta), str: v.vigenciaCarnetHasta },
        { name: 'Licencia Operativa', date: parseDate(v.vigenciaLicenciaHasta), str: v.vigenciaLicenciaHasta },
        { name: 'Revisión Técnica', date: parseDate(v.vencimientoRevisionTecnica), str: v.vencimientoRevisionTecnica },
      ].filter(d => d.date && d.date < thirtyDaysFromNow);
      return { vehicle: v, criticalDocs: docDates };
    })
    .filter(item => item.criticalDocs.length > 0)
    .sort((a, b) => {
      const minA = Math.min(...a.criticalDocs.map(d => d.date!.getTime())) as number;
      const minB = Math.min(...b.criticalDocs.map(d => d.date!.getTime())) as number;
      return minA - minB;
    });

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Nueva Tarjeta: Total Flota */}
        <div className="bg-[#1B1F24] p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-[#C29329] font-black text-4xl group-hover:scale-110 transition-transform">Σ</div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Total Activos Registrados</p>
          <p className="text-4xl font-light text-white mt-2 tracking-tighter">{stats.total}</p>
          <div className="flex items-center gap-3 mt-4">
            <span className="text-[7px] font-black text-emerald-600 uppercase italic">{stats.activeCount} Activos</span>
            <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
            <span className="text-[7px] font-black text-zinc-600 uppercase italic">{stats.inactiveCount} Inactivos</span>
          </div>
        </div>

        <div className="bg-[#1B1F24] p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-red-900 font-black text-4xl group-hover:scale-110 transition-transform">!</div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Fallas de Cumplimiento</p>
          <p className="text-4xl font-light text-red-500 mt-2 tracking-tighter">{stats.expired}</p>
          <div className="h-1 w-12 bg-red-900/30 mt-4 rounded-full overflow-hidden">
            <div className="h-full bg-red-600 w-1/2"></div>
          </div>
        </div>
        
        <div className="bg-[#1B1F24] p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-amber-900 font-black text-4xl group-hover:scale-110 transition-transform">?</div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Riesgo Inminente</p>
          <p className="text-4xl font-light text-amber-600 mt-2 tracking-tighter">{stats.warning}</p>
          <div className="h-1 w-12 bg-amber-900/30 mt-4 rounded-full overflow-hidden">
            <div className="h-full bg-amber-600 w-2/3"></div>
          </div>
        </div>

        <button 
          onClick={() => setShowAuditBreakdown(true)}
          className="bg-[#1B1F24] p-6 rounded-xl border border-white/5 relative overflow-hidden group text-left transition-all hover:bg-zinc-800/40"
        >
          <div className="absolute top-0 right-0 p-3 opacity-20 text-zinc-800 font-black text-4xl group-hover:scale-110 transition-transform">#</div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Pendiente Auditoría</p>
          <p className="text-4xl font-light text-zinc-400 mt-2 tracking-tighter">{stats.missing}</p>
          <div className="flex items-center gap-2 mt-4">
            <div className="h-1 flex-1 bg-zinc-800 rounded-full"></div>
            <span className="text-[7px] font-black text-zinc-600 uppercase italic">Ver Reporte</span>
          </div>
        </button>

        <div className="bg-[#1B1F24] p-6 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-emerald-900 font-black text-4xl group-hover:scale-110 transition-transform">ok</div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Integridad de Flota</p>
          <p className="text-4xl font-light text-emerald-600 mt-2 tracking-tighter">{stats.ok}</p>
          <div className="h-1 w-12 bg-emerald-900/30 mt-4 rounded-full">
            <div className="h-full bg-emerald-600 w-full"></div>
          </div>
        </div>
      </div>

      <div className="bg-[#1B1F24] rounded-2xl overflow-hidden border border-white/5">
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <h3 className="text-sm font-black text-zinc-100 uppercase tracking-[0.4em] italic">Radar Operativo</h3>
            </div>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-2">Detección de Anomalías Documentales (Solo Activos)</p>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {criticalList.length > 0 ? criticalList.map((item, idx) => (
            <div key={idx} className="p-8 flex flex-col xl:flex-row xl:items-center gap-10 hover:bg-white/[0.01] transition-all group">
              <div className="flex items-center gap-8 min-w-[350px]">
                <div className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-lg border transition-all ${
                  item.criticalDocs.some(d => d.date! < today) 
                  ? 'bg-red-950/20 border-red-900/50 text-red-700' 
                  : 'bg-amber-950/20 border-amber-900/50 text-amber-700'
                }`}>
                  {item.vehicle.id}
                </div>
                <div>
                  <div className="text-xl font-black text-white tracking-widest uppercase italic leading-none">{item.vehicle.patente}</div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Activo {item.vehicle.id}</span>
                    <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{item.vehicle.marca} {item.vehicle.modelo}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6">
                {item.criticalDocs.map((doc, dIdx) => (
                  <div key={dIdx} className="bg-black/20 p-4 rounded-lg border border-white/[0.03] hover:border-white/10 transition-all group/card">
                    <span className="text-[7px] font-black text-zinc-700 uppercase tracking-[0.2em] block mb-3 group-hover/card:text-zinc-500 transition-colors">{doc.name}</span>
                    <StatusBadge dateStr={doc.str} />
                  </div>
                ))}
              </div>

              <button 
                onClick={() => onSelectVehicle(item.vehicle)}
                className="xl:ml-auto px-6 py-3 bg-white/[0.03] hover:bg-[#C29329] hover:text-black border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Abrir Expediente
              </button>
            </div>
          )) : (
            <div className="p-32 text-center">
              <div className="text-4xl mb-4 opacity-10">📡</div>
              <h4 className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">Flota Sincronizada</h4>
              <p className="text-[8px] text-zinc-800 uppercase tracking-widest mt-3 italic">No se detectan desviaciones en los activos en servicio</p>
            </div>
          )}
        </div>
      </div>

      {showAuditBreakdown && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#1B1F24] rounded-3xl border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)] w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="text-lg font-black text-white tracking-widest uppercase italic">Desglose Crítico de Auditoría</h3>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Brechas de Información (Solo Flota Activa)</p>
              </div>
              <button onClick={() => setShowAuditBreakdown(false)} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 text-zinc-500 hover:text-white transition-all">&times;</button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {Object.entries(stats.breakdown).length > 0 ? Object.entries(stats.breakdown)
                .sort((a, b) => (b[1] as number) - (a[1] as number)) 
                .map(([label, count]) => (
                <div key={label} className="p-5 bg-black/20 rounded-2xl border border-white/[0.03] flex items-center justify-between group hover:border-[#C29329]/30 transition-all">
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{label}</span>
                      <span className="text-xs font-mono font-bold text-[#C29329] italic">{count} Faltantes</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full brand-gradient transition-all duration-1000 ease-out" 
                        style={{ width: `${((count as number) / (stats.activeCount || 1)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-zinc-500 text-[10px] font-bold uppercase italic tracking-widest">
                  No hay documentos pendientes de auditoría en la flota operativa.
                </div>
              )}
            </div>

            <div className="p-8 border-t border-white/5 bg-black/20 flex justify-between items-center">
              <div className="text-[9px] font-black text-zinc-500 uppercase italic">Flota Operativa: {stats.activeCount}</div>
              <button 
                onClick={() => setShowAuditBreakdown(false)}
                className="px-8 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Cerrar Reporte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
