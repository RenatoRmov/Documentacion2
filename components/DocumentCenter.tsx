import React, { useState, useMemo } from 'react';
import { Vehicle } from '../types';
import { parseDate } from '../constants';
import { downloadSingle, downloadZip, buildDocFilename, getExt, ZipEntry } from '../services/downloadService';

// ─── Definiciones de documentos ───────────────────────────────────────────────

interface DocDef {
  urlKey:  keyof Vehicle;
  dateKey: keyof Vehicle;
  label:   string;
  slug:    string;
}

const DOC_DEFS: DocDef[] = [
  { urlKey: 'urlCarnet',             dateKey: 'vigenciaCarnetHasta',          label: 'Carnet Conductor',  slug: 'carnet' },
  { urlKey: 'urlLicencia',           dateKey: 'vigenciaLicenciaHasta',         label: 'Licencia Conducir', slug: 'licencia' },
  { urlKey: 'urlPadron',             dateKey: 'vencimientoPadron',             label: 'Padrón',            slug: 'padron' },
  { urlKey: 'urlPermisoCirculacion', dateKey: 'vencimientoPermisoCirculacion', label: 'Permiso Circ.',     slug: 'permiso' },
  { urlKey: 'urlRevisionTecnica',    dateKey: 'vencimientoRevisionTecnica',    label: 'Rev. Técnica',      slug: 'revision' },
  { urlKey: 'urlSOAP',               dateKey: 'vencimientoSOAP',              label: 'SOAP',              slug: 'soap' },
  { urlKey: 'urlSeguroAsiento',      dateKey: 'vencimientoSeguroAsiento',     label: 'Seg. Asiento',      slug: 'seg_asiento' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type DocStatus = 'expired' | 'urgent' | 'soon' | 'ok' | 'missing';

interface DocEntry {
  movil:     string;
  patente:   string;
  conductor: string;
  label:     string;
  slug:      string;
  date:      string;
  status:    DocStatus;
  url:       string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatus(dateStr: string): DocStatus {
  const t = (dateStr ?? '').trim().toLowerCase();
  if (!t || t === 'sin información' || t === 'sin informacion' || t === 'no aplica') return 'missing';
  const parsed = parseDate(dateStr);
  if (!parsed) return 'missing';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days  = Math.ceil((parsed.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)   return 'expired';
  if (days <= 7)  return 'urgent';
  if (days <= 30) return 'soon';
  return 'ok';
}

const STATUS_META: Record<DocStatus, { badge: string; text: string; label: string }> = {
  expired: { badge: 'bg-red-950/60 text-red-400',    text: 'text-red-400',    label: 'Vencido' },
  urgent:  { badge: 'bg-orange-950/60 text-orange-400', text: 'text-orange-400', label: 'Urgente' },
  soon:    { badge: 'bg-amber-950/40 text-amber-400', text: 'text-amber-400',  label: 'Por vencer' },
  ok:      { badge: 'bg-emerald-950/30 text-emerald-500', text: 'text-emerald-500', label: 'Al día' },
  missing: { badge: 'bg-zinc-900 text-zinc-600',     text: 'text-zinc-600',   label: 'Sin fecha' },
};

function buildEntries(fleet: Vehicle[]): DocEntry[] {
  const rows: DocEntry[] = [];
  for (const v of fleet) {
    for (const def of DOC_DEFS) {
      const url  = String(v[def.urlKey] ?? '');
      const date = String(v[def.dateKey] ?? '');
      rows.push({
        movil:     v.id || '—',
        patente:   v.patente,
        conductor: v.nombreConductor || '—',
        label:     def.label,
        slug:      def.slug,
        date,
        status:    getStatus(date),
        url,
      });
    }
  }
  // Sort: movil asc, then expired/urgent first
  const statusOrder: Record<DocStatus, number> = { expired: 0, urgent: 1, soon: 2, ok: 3, missing: 4 };
  return rows.sort((a, b) => {
    const numA = parseInt(a.movil) || 0, numB = parseInt(b.movil) || 0;
    if (numA !== numB) return numA - numB;
    return statusOrder[a.status] - statusOrder[b.status];
  });
}

function toZipEntries(rows: DocEntry[]): ZipEntry[] {
  return rows
    .filter(r => r.url)
    .map(r => {
      const filename = buildDocFilename(r.movil, r.patente, r.slug, r.date, r.url);
      const folder   = `Movil_${r.movil.padStart(2, '0')}_${r.patente.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
      return { url: r.url, zipPath: `${folder}/${filename}` };
    });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props { fleet: Vehicle[] }

const DocumentCenter: React.FC<Props> = ({ fleet }) => {
  const allEntries = useMemo(() => buildEntries(fleet), [fleet]);

  const [filterPatente, setFilterPatente] = useState('');
  const [filterSlug,    setFilterSlug]    = useState('');
  const [filterFile,    setFilterFile]    = useState<'all' | 'with' | 'without'>('all');
  const [dlLabel,       setDlLabel]       = useState<string | null>(null);
  const [dlPct,         setDlPct]         = useState(0);
  const [dlResult,      setDlResult]      = useState<string | null>(null);

  const filtered = useMemo(() => allEntries.filter(e => {
    if (filterPatente && e.patente !== filterPatente) return false;
    if (filterSlug    && e.slug    !== filterSlug)    return false;
    if (filterFile === 'with'    && !e.url) return false;
    if (filterFile === 'without' && e.url)  return false;
    return true;
  }), [allEntries, filterPatente, filterSlug, filterFile]);

  const withFileCount    = allEntries.filter(e => e.url).length;
  const withoutFileCount = allEntries.filter(e => !e.url).length;
  const alertCount       = allEntries.filter(e => e.status === 'expired' || e.status === 'urgent').length;
  const filteredWithFile = filtered.filter(e => e.url).length;

  // Unique vehicles for filter select
  const vehicleOpts = useMemo(() => {
    const seen = new Set<string>();
    return fleet
      .sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0))
      .filter(v => { if (seen.has(v.patente)) return false; seen.add(v.patente); return true; });
  }, [fleet]);

  // ── Download handlers ──

  const startDownload = async (label: string, fn: () => Promise<void>) => {
    setDlLabel(label); setDlPct(0); setDlResult(null);
    try {
      await fn();
      setDlLabel(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setDlLabel(null);
      setDlResult(`Error: ${msg}`);
    }
  };

  const handleDownloadSingle = (entry: DocEntry) => {
    if (!entry.url) return;
    const filename = buildDocFilename(entry.movil, entry.patente, entry.slug, entry.date, entry.url);
    startDownload(`Descargando ${filename}…`, () => downloadSingle(entry.url, filename));
  };

  const handleDownloadFiltered = () => {
    const entries = toZipEntries(filtered);
    if (entries.length === 0) { setDlResult('No hay archivos con documento adjunto en la selección actual.'); return; }

    let zipName = `Flota_RadioMovil_${todayStr()}`;
    if (filterPatente) {
      const v = fleet.find(x => x.patente === filterPatente);
      zipName = `Movil_${(v?.id || '00').padStart(2, '0')}_${filterPatente}`;
    } else if (filterSlug) {
      const def = DOC_DEFS.find(d => d.slug === filterSlug);
      zipName = `Todos_${def?.label.replace(/\s/g, '_') ?? filterSlug}_${todayStr()}`;
    }

    startDownload(`Generando ${zipName}.zip (${entries.length} archivos)…`, async () => {
      const { downloaded, failed } = await downloadZip(entries, zipName, setDlPct);
      if (failed > 0) setDlResult(`✓ Descargados: ${downloaded} · ✗ Fallidos: ${failed}`);
    });
  };

  const handleDownloadAll = () => {
    const entries = toZipEntries(allEntries);
    if (entries.length === 0) { setDlResult('No hay archivos adjuntos en ningún vehículo aún.'); return; }
    const zipName = `Flota_RadioMovil_${todayStr()}`;
    startDownload(`Generando ${zipName}.zip (${entries.length} archivos)…`, async () => {
      const { downloaded, failed } = await downloadZip(entries, zipName, setDlPct);
      if (failed > 0) setDlResult(`✓ Descargados: ${downloaded} · ✗ Fallidos: ${failed}`);
    });
  };

  const selCls = 'bg-[#0A0C0E] border border-white/5 rounded-xl px-4 py-2.5 text-[10px] font-bold text-zinc-300 focus:outline-none focus:border-[#C29329]/40 appearance-none cursor-pointer';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white italic uppercase tracking-widest">Centro de Documentos</h3>
          <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">Gestión y descarga de archivos adjuntos de la flota</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/20 rounded-xl text-[9px] font-black text-emerald-500">
            {withFileCount} con archivo
          </span>
          <span className="px-3 py-1.5 bg-zinc-900/60 border border-white/5 rounded-xl text-[9px] font-black text-zinc-500">
            {withoutFileCount} sin archivo
          </span>
          {alertCount > 0 && (
            <span className="px-3 py-1.5 bg-red-950/40 border border-red-800/20 rounded-xl text-[9px] font-black text-red-400">
              {alertCount} vencidos / urgentes
            </span>
          )}
        </div>
      </div>

      {/* Filters + download actions */}
      <div className="bg-[#1B1F24] rounded-2xl border border-white/5 p-5 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Vehicle filter */}
          <div className="relative">
            <select value={filterPatente} onChange={e => setFilterPatente(e.target.value)} className={selCls}>
              <option value="">Todos los vehículos</option>
              {vehicleOpts.map(v => (
                <option key={v.patente} value={v.patente}>Móvil {v.id.padStart(2,'0')} · {v.patente}</option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 text-[8px] pointer-events-none">▼</span>
          </div>

          {/* Doc type filter */}
          <div className="relative">
            <select value={filterSlug} onChange={e => setFilterSlug(e.target.value)} className={selCls}>
              <option value="">Todos los documentos</option>
              {DOC_DEFS.map(d => <option key={d.slug} value={d.slug}>{d.label}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 text-[8px] pointer-events-none">▼</span>
          </div>

          {/* File filter */}
          <div className="relative">
            <select value={filterFile} onChange={e => setFilterFile(e.target.value as typeof filterFile)} className={selCls}>
              <option value="all">Todos</option>
              <option value="with">Con archivo</option>
              <option value="without">Sin archivo</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700 text-[8px] pointer-events-none">▼</span>
          </div>

          {(filterPatente || filterSlug || filterFile !== 'all') && (
            <button onClick={() => { setFilterPatente(''); setFilterSlug(''); setFilterFile('all'); }}
              className="px-3 py-2.5 text-[9px] font-black uppercase text-zinc-600 hover:text-zinc-300 transition-colors">
              ✕ Limpiar
            </button>
          )}
        </div>

        <div className="flex gap-3 flex-wrap">
          <button onClick={handleDownloadFiltered} disabled={!!dlLabel || filteredWithFile === 0}
            className="px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[#C29329]/10 border border-[#C29329]/30 text-[#C29329] hover:bg-[#C29329]/20 transition-all disabled:opacity-30 whitespace-nowrap">
            ⬇ {filterPatente || filterSlug ? 'ZIP selección' : 'ZIP filtro'} ({filteredWithFile})
          </button>
          <button onClick={handleDownloadAll} disabled={!!dlLabel || withFileCount === 0}
            className="px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30 whitespace-nowrap">
            ⬇ ZIP toda la flota ({withFileCount})
          </button>
        </div>
      </div>

      {/* Download progress */}
      {dlLabel && (
        <div className="bg-[#1B1F24] border border-[#C29329]/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{dlLabel}</p>
            <span className="text-[9px] font-black text-[#C29329]">{dlPct}%</span>
          </div>
          <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
            <div className="h-full bg-[#C29329] rounded-full transition-all duration-300" style={{ width: `${dlPct || 5}%` }} />
          </div>
        </div>
      )}

      {/* Result message */}
      {dlResult && !dlLabel && (
        <div className={`rounded-xl px-5 py-3 text-[10px] font-bold border ${dlResult.startsWith('Error') ? 'bg-red-950/30 border-red-800/20 text-red-400' : 'bg-emerald-950/20 border-emerald-800/20 text-emerald-400'}`}>
          {dlResult}
          <button onClick={() => setDlResult(null)} className="ml-4 text-zinc-600 hover:text-zinc-300">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1B1F24] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/5">
                <th className="px-5 py-4 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Móvil</th>
                <th className="px-5 py-4 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Conductor</th>
                <th className="px-5 py-4 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Documento</th>
                <th className="px-5 py-4 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Vencimiento</th>
                <th className="px-5 py-4 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Estado</th>
                <th className="px-5 py-4 text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] text-right">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.map((entry, idx) => {
                const meta = STATUS_META[entry.status];
                return (
                  <tr key={`${entry.patente}-${entry.slug}-${idx}`}
                    className={`transition-all group ${entry.url ? 'hover:bg-white/[0.01]' : 'opacity-50'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-white/5 text-zinc-200 font-black px-2 py-0.5 rounded-md text-[9px] italic">{entry.movil.padStart(2,'0')}</span>
                        <span className="text-[8px] text-zinc-600 font-mono">{entry.patente}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[10px] font-bold text-zinc-400 max-w-[140px] truncate">{entry.conductor}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[10px] font-black text-zinc-300 uppercase tracking-wide">{entry.label}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[10px] text-zinc-400 font-mono">{entry.date || '—'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {entry.url ? (
                        <div className="flex items-center justify-end gap-2">
                          <a href={entry.url} target="_blank" rel="noopener noreferrer"
                            className="text-[8px] font-black text-emerald-500 hover:text-emerald-300 bg-emerald-950/20 border border-emerald-800/20 px-2.5 py-1.5 rounded-lg transition-all">
                            📎 Ver
                          </a>
                          <button
                            onClick={() => handleDownloadSingle(entry)}
                            disabled={!!dlLabel}
                            className="text-[8px] font-black text-zinc-400 hover:text-white bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-30"
                            title={`Descargar ${buildDocFilename(entry.movil, entry.patente, entry.slug, entry.date, entry.url)}`}>
                            ⬇
                          </button>
                        </div>
                      ) : (
                        <span className="text-[8px] text-zinc-700 uppercase tracking-widest font-black">Sin archivo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-24 text-center">
            <div className="text-3xl mb-4 opacity-10">📁</div>
            <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Sin resultados</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 bg-black/10 flex items-center justify-between">
            <p className="text-[8px] text-zinc-700 uppercase tracking-widest font-black">{filtered.length} documentos</p>
            <p className="text-[8px] text-zinc-700 uppercase tracking-widest font-black">{filteredWithFile} con archivo adjunto</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCenter;
