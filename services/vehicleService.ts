import { supabase } from '../lib/supabaseClient';
import { Vehicle } from '../types';
import { toISODate, fromISODate } from '../constants';

// Maps a DB row (with conductores join) → Vehicle (flattened)
const mapVehicleFromDB = (data: Record<string, unknown>): Vehicle => {
    const c = data.conductores as Record<string, unknown> | null | undefined;
    return {
        // id = conductor's numero_movil for display ("Móvil 03")
        id:             String(c?.numero_movil ?? ''),
        patente:        String(data.patente ?? ''),
        tipo:           String(data.tipo ?? ''),
        marca:          String(data.marca ?? ''),
        modelo:         String(data.modelo ?? ''),
        color:          String(data.color ?? ''),
        año:            Number(data.anio ?? 0),
        asientos:       Number(data.asientos ?? 0),
        estado:         (data.estado as 'Casa' | 'Externo') ?? 'Externo',
        statusOperativo:(data.status_operativo as 'Activo' | 'Inactivo') ?? 'Activo',

        nombrePropietario: String(data.nombre_propietario ?? ''),
        rutPropietario:    String(data.rut_propietario ?? ''),

        vencimientoPadron:             fromISODate(String(data.vencimiento_padron ?? ''))             || String(data.vencimiento_padron ?? ''),
        vencimientoPermisoCirculacion: fromISODate(String(data.vencimiento_permiso_circulacion ?? '')) || String(data.vencimiento_permiso_circulacion ?? ''),
        municipalidadPermiso:          String(data.municipalidad_permiso ?? ''),
        vencimientoRevisionTecnica:    fromISODate(String(data.vencimiento_revision_tecnica ?? ''))    || String(data.vencimiento_revision_tecnica ?? ''),
        vencimientoSOAP:               fromISODate(String(data.vencimiento_soap ?? ''))               || String(data.vencimiento_soap ?? ''),
        vencimientoControlTaximetro:   fromISODate(String(data.vencimiento_control_taximetro ?? ''))   || String(data.vencimiento_control_taximetro ?? ''),

        certificadoAntecedentes: (data.certificado_antecedentes as 'OK' | 'No Aplica' | 'Sin Información') ?? 'Sin Información',
        prestacionSS:            (data.prestacion_ss            as 'OK' | 'No Aplica' | 'Sin Información') ?? 'Sin Información',
        contratoArriendo:        (data.contrato_arriendo         as 'OK' | 'No Aplica' | 'Sin Información') ?? 'Sin Información',

        vencimientoSeguroAccidentes: fromISODate(String(data.vencimiento_seguro_accidentes ?? '')) || String(data.vencimiento_seguro_accidentes ?? ''),
        lugarSeguroAccidentes:       String(data.lugar_seguro_accidentes ?? ''),
        vencimientoSeguroAsiento:    fromISODate(String(data.vencimiento_seguro_asiento ?? ''))    || String(data.vencimiento_seguro_asiento ?? ''),
        aseguradoraAsiento:          String(data.aseguradora_asiento ?? ''),

        // Conductor fields — flattened from join
        nombreConductor:       String(c?.nombre ?? ''),
        rutConductor:          String(c?.rut ?? ''),
        fechaNacimiento:       fromISODate(String(c?.fecha_nacimiento ?? ''))      || String(c?.fecha_nacimiento ?? ''),
        celular:               String(c?.celular ?? ''),
        email:                 String(c?.email ?? ''),
        direccion:             String(c?.direccion ?? ''),
        comuna:                String(c?.comuna ?? ''),
        claseLicencia:         String(c?.clase_licencia ?? ''),
        leyLicencia:           String(c?.ley_licencia ?? ''),
        municipalidadLicencia: String(c?.municipalidad_licencia ?? ''),
        vigenciaCarnetDesde:   fromISODate(String(c?.vigencia_carnet_desde ?? ''))   || String(c?.vigencia_carnet_desde ?? ''),
        vigenciaCarnetHasta:   fromISODate(String(c?.vigencia_carnet_hasta ?? ''))   || String(c?.vigencia_carnet_hasta ?? ''),
        vigenciaLicenciaDesde: fromISODate(String(c?.vigencia_licencia_desde ?? '')) || String(c?.vigencia_licencia_desde ?? ''),
        vigenciaLicenciaHasta: fromISODate(String(c?.vigencia_licencia_hasta ?? '')) || String(c?.vigencia_licencia_hasta ?? ''),
        vencimientoSeguroVidaConductor: fromISODate(String(c?.vencimiento_seguro_vida ?? '')) || String(c?.vencimiento_seguro_vida ?? ''),
        aseguradoraVida:       String(c?.aseguradora_vida ?? ''),

        conductorRut: data.conductor_rut ? String(data.conductor_rut) : null,
    };
};

const safeToISO = (val: string | undefined): string | null => {
    if (!val || !val.trim()) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'no aplica' || lower === 'sin información' || lower === 'sin informacion') return null;
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
    if (val.match(/^\d{2}-\d{2}-\d{4}$/)) return toISODate(val);
    return null;
};

const safeDateOrStatus = (val: string | undefined): string | null => {
    if (!val || !val.trim()) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'no aplica') return 'No Aplica';
    if (lower === 'sin información' || lower === 'sin informacion') return 'Sin Información';
    if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
    if (val.match(/^\d{2}-\d{2}-\d{4}$/)) return toISODate(val);
    return null;
};

const normalizeCompliance = (val: string | undefined): string | null => {
    if (!val) return null;
    const lower = val.toLowerCase().trim();
    if (lower === 'ok') return 'OK';
    if (lower === 'no aplica') return 'No Aplica';
    if (lower === 'sin información' || lower === 'sin informacion') return 'Sin Información';
    return null;
};

// Maps Vehicle → conductor DB row (for upsert into conductores)
const mapConductorToDB = (vehicle: Partial<Vehicle>): Record<string, unknown> => {
    const d: Record<string, unknown> = {};
    if (vehicle.id            !== undefined) d.numero_movil            = vehicle.id;
    if (vehicle.rutConductor  !== undefined) d.rut                     = vehicle.rutConductor;
    if (vehicle.nombreConductor !== undefined) d.nombre                 = vehicle.nombreConductor;
    if (vehicle.fechaNacimiento !== undefined) d.fecha_nacimiento        = safeToISO(vehicle.fechaNacimiento);
    if (vehicle.celular       !== undefined) d.celular                  = vehicle.celular;
    if (vehicle.email         !== undefined) d.email                    = vehicle.email;
    if (vehicle.direccion     !== undefined) d.direccion                = vehicle.direccion;
    if (vehicle.comuna        !== undefined) d.comuna                   = vehicle.comuna;
    if (vehicle.claseLicencia !== undefined) d.clase_licencia           = vehicle.claseLicencia;
    if (vehicle.leyLicencia   !== undefined) d.ley_licencia             = vehicle.leyLicencia;
    if (vehicle.municipalidadLicencia !== undefined) d.municipalidad_licencia = vehicle.municipalidadLicencia;
    if (vehicle.vigenciaCarnetDesde   !== undefined) d.vigencia_carnet_desde   = safeToISO(vehicle.vigenciaCarnetDesde);
    if (vehicle.vigenciaCarnetHasta   !== undefined) d.vigencia_carnet_hasta   = safeToISO(vehicle.vigenciaCarnetHasta);
    if (vehicle.vigenciaLicenciaDesde !== undefined) d.vigencia_licencia_desde = safeToISO(vehicle.vigenciaLicenciaDesde);
    if (vehicle.vigenciaLicenciaHasta !== undefined) d.vigencia_licencia_hasta = safeToISO(vehicle.vigenciaLicenciaHasta);
    if (vehicle.vencimientoSeguroVidaConductor !== undefined) d.vencimiento_seguro_vida = safeToISO(vehicle.vencimientoSeguroVidaConductor);
    if (vehicle.aseguradoraVida !== undefined) d.aseguradora_vida       = vehicle.aseguradoraVida;
    return d;
};

// Maps Vehicle → vehicle DB row (only vehicle-specific fields)
const mapVehicleToDB = (vehicle: Partial<Vehicle>): Record<string, unknown> => {
    const d: Record<string, unknown> = {};
    if (vehicle.patente       !== undefined) d.patente                  = vehicle.patente;
    if (vehicle.tipo          !== undefined) d.tipo                     = vehicle.tipo;
    if (vehicle.marca         !== undefined) d.marca                    = vehicle.marca;
    if (vehicle.modelo        !== undefined) d.modelo                   = vehicle.modelo;
    if (vehicle.color         !== undefined) d.color                    = vehicle.color;
    if (vehicle.año           !== undefined) d.anio                     = Number(vehicle.año) || null;
    if (vehicle.asientos      !== undefined) d.asientos                 = Number(vehicle.asientos) || null;
    if (vehicle.estado        !== undefined) d.estado                   = vehicle.estado;
    if (vehicle.statusOperativo !== undefined) d.status_operativo       = vehicle.statusOperativo;
    if (vehicle.nombrePropietario !== undefined) d.nombre_propietario   = vehicle.nombrePropietario;
    if (vehicle.rutPropietario    !== undefined) d.rut_propietario      = vehicle.rutPropietario;
    if (vehicle.municipalidadPermiso !== undefined) d.municipalidad_permiso = vehicle.municipalidadPermiso;
    if (vehicle.vencimientoPadron             !== undefined) d.vencimiento_padron             = safeToISO(vehicle.vencimientoPadron);
    if (vehicle.vencimientoPermisoCirculacion !== undefined) d.vencimiento_permiso_circulacion = safeToISO(vehicle.vencimientoPermisoCirculacion);
    if (vehicle.vencimientoRevisionTecnica    !== undefined) d.vencimiento_revision_tecnica    = safeToISO(vehicle.vencimientoRevisionTecnica);
    if (vehicle.vencimientoSOAP               !== undefined) d.vencimiento_soap               = safeToISO(vehicle.vencimientoSOAP);
    if (vehicle.vencimientoControlTaximetro   !== undefined) d.vencimiento_control_taximetro   = safeDateOrStatus(vehicle.vencimientoControlTaximetro);
    if (vehicle.certificadoAntecedentes !== undefined) d.certificado_antecedentes = normalizeCompliance(vehicle.certificadoAntecedentes);
    if (vehicle.prestacionSS            !== undefined) d.prestacion_ss            = normalizeCompliance(vehicle.prestacionSS);
    if (vehicle.contratoArriendo        !== undefined) d.contrato_arriendo        = normalizeCompliance(vehicle.contratoArriendo);
    if (vehicle.vencimientoSeguroAccidentes !== undefined) d.vencimiento_seguro_accidentes = safeToISO(vehicle.vencimientoSeguroAccidentes);
    if (vehicle.lugarSeguroAccidentes   !== undefined) d.lugar_seguro_accidentes  = vehicle.lugarSeguroAccidentes;
    if (vehicle.vencimientoSeguroAsiento !== undefined) d.vencimiento_seguro_asiento = safeDateOrStatus(vehicle.vencimientoSeguroAsiento);
    if (vehicle.aseguradoraAsiento      !== undefined) d.aseguradora_asiento      = vehicle.aseguradoraAsiento;
    // FK to conductor
    if (vehicle.rutConductor !== undefined) d.conductor_rut = vehicle.rutConductor || null;
    return d;
};

export const vehicleService = {
    async fetchVehicles(): Promise<Vehicle[]> {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*, conductores(*)')
            .order('patente', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapVehicleFromDB);
    },

    async fetchVehiclesByRut(rut: string): Promise<Vehicle[]> {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*, conductores(*)')
            .eq('conductor_rut', rut)
            .order('patente', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapVehicleFromDB);
    },

    async createVehicle(vehicle: Vehicle): Promise<Vehicle> {
        // 1. Upsert conductor
        if (vehicle.rutConductor?.trim()) {
            const conductorData = mapConductorToDB(vehicle);
            const { error: cErr } = await supabase
                .from('conductores')
                .upsert(conductorData, { onConflict: 'rut' });
            if (cErr) throw cErr;
        }

        // 2. Create vehicle
        const vehicleData = mapVehicleToDB(vehicle);
        const { data, error } = await supabase
            .from('vehicles')
            .insert([vehicleData])
            .select('*, conductores(*)')
            .single();
        if (error) throw error;
        return mapVehicleFromDB(data as Record<string, unknown>);
    },

    async updateVehicle(patente: string, updates: Partial<Vehicle>): Promise<Vehicle> {
        // 1. Update conductor if conductor fields are present
        if (updates.rutConductor?.trim()) {
            const conductorData = mapConductorToDB(updates);
            const { error: cErr } = await supabase
                .from('conductores')
                .upsert(conductorData, { onConflict: 'rut' });
            if (cErr) throw cErr;
        }

        // 2. Update vehicle by patente
        const vehicleData = mapVehicleToDB(updates);
        delete vehicleData.patente; // never update PK

        const { data, error } = await supabase
            .from('vehicles')
            .update(vehicleData)
            .eq('patente', patente)
            .select('*, conductores(*)')
            .single();
        if (error) throw error;
        return mapVehicleFromDB(data as Record<string, unknown>);
    },

    async deleteVehicle(patente: string): Promise<void> {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('patente', patente);
        if (error) throw error;
    },
};
