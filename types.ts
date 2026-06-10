
export interface Conductor {
  rut: string;
  numeroMovil: string;
  nombre: string;
  fechaNacimiento: string;
  celular: string;
  email: string;
  direccion: string;
  comuna: string;
  claseLicencia: string;
  leyLicencia: string;
  municipalidadLicencia: string;
  vigenciaCarnetDesde: string;
  vigenciaCarnetHasta: string;
  vigenciaLicenciaDesde: string;
  vigenciaLicenciaHasta: string;
  vencimientoSeguroVida: string;
  aseguradoraVida: string;
  conductorToken?: string;
}

export interface Vehicle {
  id: string;      // conductor's numero_movil — display identifier ("Móvil 03")
  patente: string; // physical vehicle PK in DB — used for all DB operations
  tipo: string;
  marca: string;
  modelo: string;
  color: string;
  año: number;
  asientos: number;
  estado: 'Casa' | 'Externo';
  statusOperativo: 'Activo' | 'Inactivo';

  nombrePropietario: string;
  rutPropietario: string;

  vencimientoPadron: string;
  vencimientoPermisoCirculacion: string;
  municipalidadPermiso: string;
  vencimientoRevisionTecnica: string;
  vencimientoSOAP: string;
  vencimientoControlTaximetro: string;

  certificadoAntecedentes: 'OK' | 'No Aplica' | 'Sin Información';
  prestacionSS: 'OK' | 'No Aplica' | 'Sin Información';
  contratoArriendo: 'OK' | 'No Aplica' | 'Sin Información';

  vencimientoSeguroAccidentes: string;
  lugarSeguroAccidentes: string;
  vencimientoSeguroAsiento: string;
  aseguradoraAsiento: string;

  // Conductor fields — flattened from conductores join (backward compat with UI)
  vencimientoSeguroVidaConductor: string;
  aseguradoraVida: string;
  nombreConductor: string;
  rutConductor: string;
  fechaNacimiento: string;
  celular: string;
  email: string;
  direccion: string;
  comuna: string;
  claseLicencia: string;
  leyLicencia: string;
  municipalidadLicencia: string;
  vigenciaCarnetDesde: string;
  vigenciaCarnetHasta: string;
  vigenciaLicenciaDesde: string;
  vigenciaLicenciaHasta: string;

  conductorRut: string | null;
}

export type ExpirationStatus = 'Vencido' | 'Próximo a vencer' | 'Al día' | 'No Registra';

export interface DashboardStats {
  totalVehicles: number;
  expiredCount: number;
  warningCount: number;
}

export interface NotificationSettings {
  enabled: boolean;
  email: { enabled: boolean; address: string };
  whatsapp: { enabled: boolean; number: string; apiKey: string };
  priorityDocs: string[];
  daysInAdvance: number[];
  includeMissing: boolean;
  companyName:     string;
  adminName:       string;
  adminTitle:      string;
  contactEmail:    string;
  contactWhatsApp: string;
}
