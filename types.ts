
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
  vencimientoPermisoCirculacion: string;
  municipalidadPermiso: string;
  vencimientoRevisionTecnica: string;
  vencimientoSOAP: string;
  vencimientoControlTaximetro: string; // Fecha, "No Aplica" o "Sin Información"
  
  // Nuevos Documentos RM
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
  claseLicencia: string;
  
  // Vigencias (Desde/Hasta)
  vigenciaCarnetDesde: string;
  vigenciaCarnetHasta: string; 
  vigenciaLicenciaDesde: string;
  vigenciaLicenciaHasta: string; 
}

export type ExpirationStatus = 'Vencido' | 'Próximo a vencer' | 'Al día' | 'No Registra';

export interface DashboardStats {
  totalVehicles: number;
  expiredCount: number;
  warningCount: number; 
}
