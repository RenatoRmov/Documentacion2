
import { Vehicle } from './types';

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.toLowerCase() === 'no aplica' || dateStr === 'Sin Información' || dateStr.trim() === '') return null;

  const parts = dateStr.split(/[-/]/);
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0]);
  const monthMap: Record<string, number> = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sept': 8, 'oct': 9, 'nov': 10, 'dic': 11,
    '01': 0, '02': 1, '03': 2, '04': 3, '05': 4, '06': 5,
    '07': 6, '08': 7, '09': 8, '10': 9, '11': 10, '12': 11
  };

  let month = monthMap[parts[1].toLowerCase().substring(0, 3)];
  if (month === undefined) month = parseInt(parts[1]) - 1;

  let year = parseInt(parts[2]);
  if (year < 100) year += 2000;

  return new Date(year, month, day);
};

export const toISODate = (dateStr: string): string => {
  if (!dateStr || dateStr.toLowerCase() === 'no aplica' || dateStr === 'Sin Información') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const fromISODate = (isoStr: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "1", patente: "RWCT79", tipo: "STATION WAGON", marca: "CHEVROLET", modelo: "GROOVE", color: "BLANCO", año: 2022, asientos: 5, estado: "Externo", statusOperativo: "Activo",
    nombrePropietario: "SANDRA MARIA LLANTEN", rutPropietario: "10.920.570-2",
    vencimientoPadron: '', certificadoAntecedentes: 'OK',
    vencimientoPermisoCirculacion: "31-05-2026", municipalidadPermiso: "PUENTE ALTO",
    vencimientoRevisionTecnica: "16-03-2026", vencimientoSOAP: "31-03-2026", vencimientoControlTaximetro: "No Aplica",
    prestacionSS: "OK", contratoArriendo: "OK",
    vencimientoSeguroAccidentes: "30-09-2025", lugarSeguroAccidentes: "SURA",
    vencimientoSeguroAsiento: "30-09-2025", aseguradoraAsiento: "HDI",
    vencimientoSeguroVidaConductor: "15-05-2026", aseguradoraVida: "BCI",
    nombreConductor: "SANDRA MARIA LLANTEN TOBAR", rutConductor: "10920570-2", fechaNacimiento: "12-05-1970", celular: "976785460", email: "sandrallantent@gmail.com",
    direccion: "PUERTO VALPARAISO 791", comuna: "QUILICURA", claseLicencia: "A2", leyLicencia: "19.495", municipalidadLicencia: "QUINTA NORMAL",
    vigenciaCarnetDesde: "01-01-2020", vigenciaCarnetHasta: "01-01-2030",
    vigenciaLicenciaDesde: "20-02-2022", vigenciaLicenciaHasta: "20-02-2028"
  },
  {
    id: "3", patente: "HGDR71", tipo: "AUTOMOVIL", marca: "MAZDA", modelo: "NEW MAZDA 6", color: "GRIS", año: 2019, asientos: 5, estado: "Casa", statusOperativo: "Activo",
    nombrePropietario: "RENATO OLIVA", rutPropietario: "21.082.151-1",
    vencimientoPadron: '', certificadoAntecedentes: 'No Aplica',
    vencimientoPermisoCirculacion: "31-08-2024", municipalidadPermiso: "SANTIAGO",
    vencimientoRevisionTecnica: "30-04-2026", vencimientoSOAP: "31-03-2026", vencimientoControlTaximetro: "15-12-2025",
    prestacionSS: "OK", contratoArriendo: "OK",
    vencimientoSeguroAccidentes: "01-01-2025", lugarSeguroAccidentes: "SANTIAGO",
    vencimientoSeguroAsiento: "No Aplica", aseguradoraAsiento: "No Aplica",
    vencimientoSeguroVidaConductor: "01-01-2025", aseguradoraVida: "MAPFRE",
    nombreConductor: "RENATO JESUS OLIVA AGUIRRE", rutConductor: "21082151-1", fechaNacimiento: "09-09-1999", celular: "954057893", email: "renatoliva9@gmail.com",
    direccion: "VALLE LO CAMPINO", comuna: "QUILICURA", claseLicencia: "B", leyLicencia: '', municipalidadLicencia: '',
    vigenciaCarnetDesde: "10-10-2015", vigenciaCarnetHasta: "10-10-2025",
    vigenciaLicenciaDesde: "01-01-2020", vigenciaLicenciaHasta: "01-01-2025"
  }
];
