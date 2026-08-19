import React, { useState, useMemo } from 'react';
import { Vehicle } from '../types';
import { vehicleService } from '../services/vehicleService';

interface Row {
  key: string;
  patente: string;
  targetRut: string;
}

interface ConductorOption {
  rut: string;
  nombre: string;
  numeroMovil: string;
}

let rowCounter = 0;
const newRow = (): Row => ({ key: `row-${++rowCounter}-${Date.now()}`, patente: '', targetRut: '' });

interface Props {
  fleet: Vehicle[];
  onClose: () => void;
}

const VehicleTransfer: React.FC<Props> = ({ fleet, onClose }) => {
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [ackCarless, setAckCarless] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // ── Datos base (snapshot de la flota al abrir el modal) ──

  const vehicleByPatente = useMemo(() => {
    const m = new Map<string, Vehicle>();
    fleet.forEach(v => m.set(v.patente, v));
    return m;
  }, [fleet]);

  const conductores = useMemo(() => {
    const m = new Map<string, ConductorOption>();
    fleet.forEach(v => {
      if (v.rutConductor && !m.has(v.rutConductor)) {
        m.set(v.rutConductor, { rut: v.rutConductor, nombre: v.nombreConductor || 'Sin nombre', numeroMovil: v.id });
      }
    });
    return [...m.values()].sort((a, b) => (parseInt(a.numeroMovil) || 0) - (parseInt(b.numeroMovil) || 0));
  }, [fleet]);

  const sortedFleet = useMemo(
    () => [...fleet].sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0)),
    [fleet]
  );

  // ── Manejo de filas ──

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => setRows(prev => [...prev, newRow()]);
  const removeRow = (key: string) => setRows(prev => (prev.length === 1 ? prev : prev.filter(r => r.key !== key)));

  const usedPatentes = new Set(rows.map(r => r.patente).filter(Boolean));

  // ── Validación + vista previa ──

  const validRows = rows.filter(r => r.patente && r.targetRut);

  const duplicatePatentes = (() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    validRows.forEach(r => { if (seen.has(r.patente)) dup.add(r.patente); seen.add(r.patente); });
    return dup;
  })();

  const noopRows = validRows.filter(r => vehicleByPatente.get(r.patente)?.rutConductor === r.targetRut);

  interface PreviewEntry { rut: string; nombre: string; numeroMovil: string; before: number; after: number; }

  const preview = useMemo(() => {
    const map = new Map<string, PreviewEntry>();
    const ensure = (rut: string): PreviewEntry => {
      let e = map.get(rut);
      if (!e) {
        const known = conductores.find(c => c.rut === rut);
        const before = fleet.filter(v => v.rutConductor === rut).length;
        e = { rut, nombre: known?.nombre ?? '—', numeroMovil: known?.numeroMovil ?? '—', before, after: before };
        map.set(rut, e);
      }
      return e;
    };

    for (const r of validRows) {
      if (duplicatePatentes.has(r.patente) || noopRows.includes(r)) continue;
      const vehicle = vehicleByPatente.get(r.patente);
      const fromRut = vehicle?.rutConductor;
      if (fromRut) ensure(fromRut).after -= 1;
      ensure(r.targetRut).after += 1;
    }
    return [...map.values()];
  }, [validRows, duplicatePatentes, noopRows, vehicleByPatente, conductores, fleet]);

  const willBeCarless = preview.filter(p => p.before > 0 && p.after <= 0);

  const hasBlockingIssues = duplicatePatentes.size > 0 || noopRows.length > 0;
  const canSubmit =
    validRows.length > 0 &&
    validRows.length === rows.length && // todas las filas completas
    !hasBlockingIssues &&
    (willBeCarless.length === 0 || ackCarless);

  // ── Envío ──

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const r of validRows) {
        await vehicleService.updateVehicle(r.patente, { rutConductor: r.targetRut });
      }
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      setError(`Error al aplicar el movimiento: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const selectCls = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-[12px] text-white focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-[#1B1F24] rounded-3xl border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
          <div>
            <h3 className="text-lg font-black text-white tracking-widest uppercase italic">Movimiento de Vehículos</h3>
            <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.4em] mt-2">Reasignar uno o varios vehículos entre conductores</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 text-zinc-500 hover:text-white transition-all">&times;</button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">

          {done ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-4">✓</p>
              <p className="text-white font-black uppercase tracking-widest text-sm">Movimiento aplicado</p>
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-2">La flota y las alertas ya reflejan los cambios</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {rows.map((row, idx) => {
                  const vehicle = vehicleByPatente.get(row.patente);
                  const isDup = row.patente && duplicatePatentes.has(row.patente);
                  const isNoop = row.patente && row.targetRut && vehicle?.rutConductor === row.targetRut;
                  return (
                    <div key={row.key} className="p-4 rounded-xl border border-white/5 bg-black/20 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-center">
                        <div>
                          <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Vehículo</label>
                          <select value={row.patente} onChange={e => updateRow(row.key, { patente: e.target.value })} className={selectCls}>
                            <option value="">Selecciona patente...</option>
                            {sortedFleet.map(v => (
                              <option key={v.patente} value={v.patente} disabled={usedPatentes.has(v.patente) && v.patente !== row.patente}>
                                {v.patente} — Móvil {v.id || '—'} ({v.nombreConductor || 'sin conductor'})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="hidden sm:block text-zinc-600 text-lg pt-4">→</div>
                        <div>
                          <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Nuevo conductor</label>
                          <select value={row.targetRut} onChange={e => updateRow(row.key, { targetRut: e.target.value })} className={selectCls}>
                            <option value="">Selecciona conductor...</option>
                            {conductores.map(c => (
                              <option key={c.rut} value={c.rut}>Móvil {c.numeroMovil} — {c.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={() => removeRow(row.key)} disabled={rows.length === 1}
                          className="mt-4 sm:mt-5 w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Quitar movimiento">🗑️</button>
                      </div>
                      {isDup && <p className="text-[9px] font-bold text-red-400">Esta patente está repetida en otra fila.</p>}
                      {isNoop && <p className="text-[9px] font-bold text-amber-400">Este vehículo ya pertenece a ese conductor.</p>}
                      <p className="text-[8px] text-zinc-600">#{idx + 1}</p>
                    </div>
                  );
                })}
              </div>

              <button onClick={addRow}
                className="w-full py-3 rounded-xl border border-dashed border-white/10 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#C29329] hover:border-[#C29329]/30 transition-all">
                + Agregar otro movimiento
              </button>

              {preview.length > 0 && (
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 bg-black/30 border-b border-white/5">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest">Vista previa</p>
                  </div>
                  <div className="divide-y divide-white/5">
                    {preview.map(p => {
                      const carless = p.before > 0 && p.after <= 0;
                      return (
                        <div key={p.rut} className="px-4 py-3 flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold text-zinc-300">Móvil {p.numeroMovil} — {p.nombre}</span>
                          <span className={`text-[10px] font-black ${carless ? 'text-red-400' : 'text-emerald-400'}`}>
                            {p.before} → {p.after} vehículo{p.after !== 1 ? 's' : ''}
                            {carless && '  ⚠️ Quedará sin vehículo'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {willBeCarless.length > 0 && (
                <label className="flex items-start gap-3 p-4 rounded-xl border border-amber-700/30 bg-amber-900/10 cursor-pointer">
                  <input type="checkbox" checked={ackCarless} onChange={e => setAckCarless(e.target.checked)} className="mt-0.5" />
                  <span className="text-[10px] text-amber-300 leading-relaxed">
                    Confirmo que {willBeCarless.map(p => `Móvil ${p.numeroMovil} (${p.nombre})`).join(', ')} quedará sin vehículo asignado después de este movimiento.
                  </span>
                </label>
              )}

              {error && (
                <div className="p-4 rounded-xl border border-red-700/30 bg-red-900/20 text-red-400 text-[11px] font-bold leading-relaxed">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="p-8 border-t border-white/5 bg-black/20 flex justify-between items-center shrink-0">
            <div className="text-[9px] font-black text-zinc-500 uppercase italic">
              {validRows.length} movimiento{validRows.length !== 1 ? 's' : ''} listo{validRows.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} disabled={submitting}
                className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all">
                Cancelar
              </button>
              <button onClick={handleSubmit} disabled={!canSubmit || submitting}
                className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#C29329] text-black hover:bg-amber-500 transition-all disabled:opacity-30">
                {submitting ? 'Aplicando...' : '✓ Aplicar Movimiento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleTransfer;
