import React, { useState } from 'react';
import { conductorService } from '../services/conductorService';
import ConductorPortal from './ConductorPortal';

function normalizeRut(value: string): string {
  let c = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (c.length > 1) return `${c.slice(0, -1)}-${c.slice(-1)}`;
  return c;
}

const PortalLogin: React.FC = () => {
  const [rut,     setRut]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [authedRut, setAuthedRut] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRut(normalizeRut(e.target.value));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rut.trim();
    if (!trimmed || !trimmed.includes('-')) {
      setError('Ingresa tu RUT con formato correcto. Ej: 12345678-9');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const c = await conductorService.fetchConductorByRut(trimmed);
      if (!c) {
        setError('RUT no encontrado. Verifica el formato o consulta al encargado.');
        return;
      }
      setAuthedRut(c.rut);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (authedRut) return <ConductorPortal rut={authedRut} />;

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center p-6"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <div className="w-full max-w-sm">
        {/* Logo / header */}
        <div className="text-center mb-10">
          <div className="inline-block bg-[#C29329] text-black font-black text-xs px-4 py-1.5 rounded-lg uppercase tracking-[0.3em] italic mb-4">
            RadioMovil
          </div>
          <h1 className="text-white font-black uppercase tracking-widest text-lg leading-tight">
            Portal del Conductor
          </h1>
          <p className="text-zinc-600 text-[10px] uppercase tracking-widest mt-2">
            Ingresa tu RUT para acceder a tu documentación
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#1B1F24] rounded-2xl border border-white/5 p-6 space-y-4">
          <div>
            <label className="block text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">
              Tu RUT
            </label>
            <input
              type="text"
              value={rut}
              onChange={handleChange}
              placeholder="12345678-9"
              maxLength={12}
              autoComplete="off"
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-[15px] font-mono tracking-widest focus:outline-none focus:border-[#C29329]/60 transition-colors placeholder-zinc-700"
            />
            {error && (
              <p className="text-red-400 text-[10px] font-bold mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !rut.includes('-')}
            className="w-full py-3.5 bg-[#C29329] text-black font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-amber-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            {loading ? 'Verificando...' : 'Acceder →'}
          </button>
        </form>

        <p className="text-center text-[8px] text-zinc-700 uppercase tracking-widest mt-8">
          Sistema de Gestión Documental · RadioMovil
        </p>
      </div>
    </div>
  );
};

export default PortalLogin;
