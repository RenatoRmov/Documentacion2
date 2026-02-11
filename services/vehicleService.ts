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

const mapVehicleToDB = (vehicle: Partial<Vehicle>) => {
    const dbData: any = {
        numero_movil: vehicle.id,
        patente: vehicle.patente,
        tipo: vehicle.tipo,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        color: vehicle.color,
        anio: vehicle.año,
        asientos: vehicle.asientos,
        estado: vehicle.estado,
        status_operativo: vehicle.statusOperativo,

        nombre_propietario: vehicle.nombrePropietario,
        rut_propietario: vehicle.rutPropietario,

        municipalidad_permiso: vehicle.municipalidadPermiso,
        vencimiento_padron: vehicle.vencimientoPadron,
        certificado_antecedentes: vehicle.certificadoAntecedentes,
        prestacion_ss: vehicle.prestacionSS,
        contrato_arriendo: vehicle.contratoArriendo,
        lugar_seguro_accidentes: vehicle.lugarSeguroAccidentes,
        aseguradora_asiento: vehicle.aseguradoraAsiento,
        aseguradora_vida: vehicle.aseguradoraVida,

        nombre_conductor: vehicle.nombreConductor,
        rut_conductor: vehicle.rutConductor,
        celular: vehicle.celular,
        email: vehicle.email,
        direccion: vehicle.direccion,
        comuna: vehicle.comuna,
        clase_licencia: vehicle.claseLicencia,
        ley_licencia: vehicle.leyLicencia,
        municipalidad_licencia: vehicle.municipalidadLicencia,
    };

    // Convert dates to ISO YYYY-MM-DD or keep text if "No Aplica" etc.
    // Helper to safely convert if it looks like a date DD-MM-YYYY
    const safeToISO = (val: string | undefined) => {
        if (!val) return null;
        if (val.match(/^\d{2}-\d{2}-\d{4}$/)) return toISODate(val);
        return val;
    };

    if (vehicle.vencimientoPadron !== undefined) dbData.vencimiento_padron = safeToISO(vehicle.vencimientoPadron);
    if (vehicle.vencimientoPermisoCirculacion !== undefined) dbData.vencimiento_permiso_circulacion = safeToISO(vehicle.vencimientoPermisoCirculacion);
    if (vehicle.vencimientoRevisionTecnica !== undefined) dbData.vencimiento_revision_tecnica = safeToISO(vehicle.vencimientoRevisionTecnica);
    if (vehicle.vencimientoSOAP !== undefined) dbData.vencimiento_soap = safeToISO(vehicle.vencimientoSOAP);
    if (vehicle.vencimientoControlTaximetro !== undefined) dbData.vencimiento_control_taximetro = safeToISO(vehicle.vencimientoControlTaximetro);

    if (vehicle.vencimientoSeguroAccidentes !== undefined) dbData.vencimiento_seguro_accidentes = safeToISO(vehicle.vencimientoSeguroAccidentes);
    if (vehicle.vencimientoSeguroAsiento !== undefined) dbData.vencimiento_seguro_asiento = safeToISO(vehicle.vencimientoSeguroAsiento);
    if (vehicle.vencimientoSeguroVidaConductor !== undefined) dbData.vencimiento_seguro_vida_conductor = safeToISO(vehicle.vencimientoSeguroVidaConductor);

    if (vehicle.fechaNacimiento !== undefined) dbData.fecha_nacimiento = safeToISO(vehicle.fechaNacimiento);

    if (vehicle.vigenciaCarnetDesde !== undefined) dbData.vigencia_carnet_desde = safeToISO(vehicle.vigenciaCarnetDesde);
    if (vehicle.vigenciaCarnetHasta !== undefined) dbData.vigencia_carnet_hasta = safeToISO(vehicle.vigenciaCarnetHasta);
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

        // We update by numero_movil (which is 'id' in our app)
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
