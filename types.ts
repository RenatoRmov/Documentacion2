
export interface Vehicle {
  id: string; // Número de Móvil
  patente: string;
  tipo: string;
  marca: string;
  modelo: string;
  color: string;
  año: number;
  asientos: number;
  estado: 'Casa' | 'Externo';
  statusOperativo: 'Activo' | 'Inactivo'; // Nuevo estado operativo

  // Datos del Propietario
  nombrePropietario: string;
  rutPropietario: string;

  // Documentación del Vehículo
  vencimientoPadron: string; // Nuevo: Padrón
  vencimientoPermisoCirculacion: string;
  municipalidadPermiso: string;
  vencimientoRevisionTecnica: string;
  vencimientoSOAP: string;
  vencimientoControlTaximetro: string; // Fecha, "No Aplica" o "Sin Información"

  // Nuevos Documentos RM
  certificadoAntecedentes: 'OK' | 'No Aplica' | 'Sin Información'; // Nuevo
  prestacionSS: 'OK' | 'No Aplica' | 'Sin Información';
  contratoArriendo: 'OK' | 'No Aplica' | 'Sin Información';

  // Seguros
  vencimientoSeguroAccidentes: string;
  lugarSeguroAccidentes: string;
  vencimientoSeguroAsiento: string;
  aseguradoraAsiento: string;
  vencimientoSeguroVidaConductor: string;
  aseguradoraVida: string;

  // Conductor
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

  // Vigencias (Desde/Hasta)
  vigenciaCarnetDesde: string;
  vigenciaCarnetHasta: string;
  vigenciaLicenciaDesde: string;
  vigenciaLicenciaHasta: string;

  conductorToken?: string;
}

export type ExpirationStatus = 'Vencido' | 'Próximo a vencer' | 'Al día' | 'No Registra';

export interface DashboardStats {
  totalVehicles: number;
  expiredCount: number;
  warningCount: number;
}

export interface NotificationSettings {
  enabled: boolean;
  email: {
    enabled: boolean;
    address: string; // admin CC
  };
  whatsapp: {
    enabled: boolean;
    number: string;
    apiKey: string;
  };
  priorityDocs: string[];
  daysInAdvance: number[];
  includeMissing: boolean;  // also notify about docs with no date registered
  companyName:     string;
  adminName:       string;
  adminTitle:      string;
  contactEmail:    string;  // shown in email body for conductors to reply to
  contactWhatsApp: string;  // shown in email body (formatted, e.g. "+56 9 5405 7893")
}
