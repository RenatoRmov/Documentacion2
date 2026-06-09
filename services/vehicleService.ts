import { supabase } from '../lib/supabaseClient';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';

// Helper to map DB columns (snake_case) to App types (camelCase)
const mapVehicleFromDB = (data: any): Vehicle => {
    return {
        id: data.numero_movil,
        patente: data.patente,
        tipo: data.tipo,
        marca: data.marca,
        modelo: data.modelo,
        color: data.color,
        año: data.anio,
        asientos: data.asientos,
        estado: data.estado as 'Casa' | 'Externo',
        statusOperativo: data.status_operativo as 'Activo' | 'Inactivo',

        nombrePropietario: data.nombre_propietario,
        rutPropietario: data.rut_propietario,

        vencimientoPadron: fromISODate(data.vencimiento_padron) || data.vencimiento_padron,
        vencimientoPermisoCirculacion: fromISODate(data.vencimiento_permiso_circulacion) || data.vencimiento_permiso_circulacion, // Fallback if already text like "No Aplica"
        municipalidadPermiso: data.municipalidad_permiso,
        vencimientoRevisionTecnica: fromISODate(data.vencimiento_revision_tecnica) || data.vencimiento_revision_tecnica,
        vencimientoSOAP: fromISODate(data.vencimiento_soap) || data.vencimiento_soap,
        vencimientoControlTaximetro: fromISODate(data.vencimiento_control_taximetro) || data.vencimiento_control_taximetro,

        certificadoAntecedentes: data.certificado_antecedentes as any,
        prestacionSS: data.prestacion_ss as any,
        contratoArriendo: data.contrato_arriendo as any,

        vencimientoSeguroAccidentes: fromISODate(data.vencimiento_seguro_accidentes) || data.vencimiento_seguro_accidentes,
        lugarSeguroAccidentes: data.lugar_seguro_accidentes,
        vencimientoSeguroAsiento: fromISODate(data.vencimiento_seguro_asiento) || data.vencimiento_seguro_asiento,
        aseguradoraAsiento: data.aseguradora_asiento,
        vencimientoSeguroVidaConductor: fromISODate(data.vencimiento_seguro_vida_conductor) || data.vencimiento_seguro_vida_conductor,
        aseguradoraVida: data.aseguradora_vida,

        nombreConductor: data.nombre_conductor,
        rutConductor: data.rut_conductor,
        fechaNacimiento: fromISODate(data.fecha_nacimiento) || data.fecha_nacimiento,
        celular: data.celular,
        email: data.email,
        direccion: data.direccion,
        comuna: data.comuna,
        claseLicencia: data.clase_licencia,
        leyLicencia: data.ley_licencia,
        municipalidadLicencia: data.municipalidad_licencia,

        vigenciaCarnetDesde: fromISODate(data.vigencia_carnet_desde) || data.vigencia_carnet_desde,
        vigenciaCarnetHasta: fromISODate(data.vigencia_carnet_hasta) || data.vigencia_carnet_hasta,
        vigenciaLicenciaDesde: fromISODate(data.vigencia_licencia_desde) || data.vigencia_licencia_desde,
        vigenciaLicenciaHasta: fromISODate(data.vigencia_licencia_hasta) || data.vigencia_licencia_hasta
    };
};

// Converts DD-MM-YYYY → YYYY-MM-DD for Supabase DATE columns.
// Returns null for empty / "No Aplica" / unrecognized formats.
const safeToISO = (val: string | undefined): string | null => {
    if (!val || !val.trim()) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'no aplica' || lower === 'sin información' || lower === 'sin informacion') return null;
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;          // already ISO
    if (val.match(/^\d{2}-\d{2}-\d{4}$/)) return toISODate(val); // DD-MM-YYYY
    return null;
};

// For fields that can be a date OR a status text (e.g. vencimientoControlTaximetro).
// Returns the normalized text ("No Aplica") or an ISO date string, never garbage.
const safeDateOrStatus = (val: string | undefined): string | null => {
    if (!val || !val.trim()) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'no aplica') return 'No Aplica';
    if (lower === 'sin información' || lower === 'sin informacion') return 'Sin Información';
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
    if (val.match(/^\d{2}-\d{2}-\d{4}$/)) return toISODate(val);
    return null;
};

// Normalizes compliance dropdown values to the casing the DB expects.
const normalizeCompliance = (val: string | undefined): string | null => {
    if (!val) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'ok') return 'OK';
    if (lower === 'no aplica') return 'No Aplica';
    if (lower === 'sin información' || lower === 'sin informacion') return 'Sin Información';
    return null;
};

const mapVehicleToDB = (vehicle: Partial<Vehicle>) => {
    const dbData: Record<string, unknown> = {};

    // Only include fields that are actually defined to avoid null-wiping unrelated columns
    if (vehicle.id         !== undefined) dbData.numero_movil        = vehicle.id;
    if (vehicle.patente    !== undefined) dbData.patente              = vehicle.patente;
    if (vehicle.tipo       !== undefined) dbData.tipo                 = vehicle.tipo;
    if (vehicle.marca      !== undefined) dbData.marca                = vehicle.marca;
    if (vehicle.modelo     !== undefined) dbData.modelo               = vehicle.modelo;
    if (vehicle.color      !== undefined) dbData.color                = vehicle.color;
    if (vehicle.año        !== undefined) dbData.anio                 = Number(vehicle.año) || null;
    if (vehicle.asientos   !== undefined) dbData.asientos             = Number(vehicle.asientos) || null;
    if (vehicle.estado     !== undefined) dbData.estado               = vehicle.estado;
    if (vehicle.statusOperativo !== undefined) dbData.status_operativo = vehicle.statusOperativo;

    if (vehicle.nombrePropietario !== undefined) dbData.nombre_propietario = vehicle.nombrePropietario;
    if (vehicle.rutPropietario    !== undefined) dbData.rut_propietario    = vehicle.rutPropietario;

    if (vehicle.municipalidadPermiso !== undefined) dbData.municipalidad_permiso = vehicle.municipalidadPermiso;

    if (vehicle.vencimientoPadron             !== undefined) dbData.vencimiento_padron             = safeToISO(vehicle.vencimientoPadron);
    if (vehicle.vencimientoPermisoCirculacion !== undefined) dbData.vencimiento_permiso_circulacion = safeToISO(vehicle.vencimientoPermisoCirculacion);
    if (vehicle.vencimientoRevisionTecnica    !== undefined) dbData.vencimiento_revision_tecnica    = safeToISO(vehicle.vencimientoRevisionTecnica);
    if (vehicle.vencimientoSOAP               !== undefined) dbData.vencimiento_soap               = safeToISO(vehicle.vencimientoSOAP);
    if (vehicle.vencimientoControlTaximetro   !== undefined) dbData.vencimiento_control_taximetro   = safeDateOrStatus(vehicle.vencimientoControlTaximetro);

    if (vehicle.certificadoAntecedentes !== undefined) dbData.certificado_antecedentes = normalizeCompliance(vehicle.certificadoAntecedentes);
    if (vehicle.prestacionSS            !== undefined) dbData.prestacion_ss            = normalizeCompliance(vehicle.prestacionSS);
    if (vehicle.contratoArriendo        !== undefined) dbData.contrato_arriendo        = normalizeCompliance(vehicle.contratoArriendo);

    if (vehicle.vencimientoSeguroAccidentes    !== undefined) dbData.vencimiento_seguro_accidentes    = safeToISO(vehicle.vencimientoSeguroAccidentes);
    if (vehicle.lugarSeguroAccidentes          !== undefined) dbData.lugar_seguro_accidentes          = vehicle.lugarSeguroAccidentes;
    if (vehicle.vencimientoSeguroAsiento       !== undefined) dbData.vencimiento_seguro_asiento       = safeDateOrStatus(vehicle.vencimientoSeguroAsiento);
    if (vehicle.aseguradoraAsiento             !== undefined) dbData.aseguradora_asiento             = vehicle.aseguradoraAsiento;
    if (vehicle.vencimientoSeguroVidaConductor !== undefined) dbData.vencimiento_seguro_vida_conductor = safeToISO(vehicle.vencimientoSeguroVidaConductor);
    if (vehicle.aseguradoraVida                !== undefined) dbData.aseguradora_vida                = vehicle.aseguradoraVida;

    if (vehicle.nombreConductor      !== undefined) dbData.nombre_conductor      = vehicle.nombreConductor;
    if (vehicle.rutConductor         !== undefined) dbData.rut_conductor         = vehicle.rutConductor;
    if (vehicle.fechaNacimiento      !== undefined) dbData.fecha_nacimiento      = safeToISO(vehicle.fechaNacimiento);
    if (vehicle.celular              !== undefined) dbData.celular               = vehicle.celular;
    if (vehicle.email                !== undefined) dbData.email                 = vehicle.email;
    if (vehicle.direccion            !== undefined) dbData.direccion             = vehicle.direccion;
    if (vehicle.comuna               !== undefined) dbData.comuna                = vehicle.comuna;
    if (vehicle.claseLicencia        !== undefined) dbData.clase_licencia        = vehicle.claseLicencia;
    if (vehicle.leyLicencia          !== undefined) dbData.ley_licencia          = vehicle.leyLicencia;
    if (vehicle.municipalidadLicencia !== undefined) dbData.municipalidad_licencia = vehicle.municipalidadLicencia;

    if (vehicle.vigenciaCarnetDesde   !== undefined) dbData.vigencia_carnet_desde   = safeToISO(vehicle.vigenciaCarnetDesde);
    if (vehicle.vigenciaCarnetHasta   !== undefined) dbData.vigencia_carnet_hasta   = safeToISO(vehicle.vigenciaCarnetHasta);
    if (vehicle.vigenciaLicenciaDesde !== undefined) dbData.vigencia_licencia_desde = safeToISO(vehicle.vigenciaLicenciaDesde);
    if (vehicle.vigenciaLicenciaHasta !== undefined) dbData.vigencia_licencia_hasta = safeToISO(vehicle.vigenciaLicenciaHasta);

    return dbData;
};

export const vehicleService = {
    async fetchVehicles(): Promise<Vehicle[]> {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .order('numero_movil', { ascending: true });

        if (error) {
            console.error('Error fetching vehicles:', error);
            throw error;
        }

        return (data || []).map(mapVehicleFromDB);
    },

    async createVehicle(vehicle: Vehicle): Promise<Vehicle> {
        const dbData = mapVehicleToDB(vehicle);
        // Removing id (UUID) to let Supabase generate it, but we use numero_movil as our functional ID

        const { data, error } = await supabase
            .from('vehicles')
            .insert([dbData])
            .select()
            .single();

        if (error) {
            console.error('Error creating vehicle:', error);
            throw error;
        }

        return mapVehicleFromDB(data);
    },

    async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
        const dbData = mapVehicleToDB(updates);
        delete dbData.numero_movil; // Never update the primary key

        const { data, error } = await supabase
            .from('vehicles')
            .update(dbData)
            .eq('numero_movil', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating vehicle:', error);
            throw error;
        }

        return mapVehicleFromDB(data);
    },

    async deleteVehicle(id: string): Promise<void> {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('numero_movil', id);

        if (error) {
            console.error('Error deleting vehicle:', error);
            throw error;
        }
    }
};
