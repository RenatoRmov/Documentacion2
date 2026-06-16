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

        conductorRut:   data.conductor_rut ? String(data.conductor_rut) : null,
        conductorToken: c?.conductor_token ? String(c.conductor_token) : undefined,

        urlPadron:             String(data.url_padron ?? ''),
        urlPermisoCirculacion: String(data.url_permiso_circulacion ?? ''),
        urlRevisionTecnica:    String(data.url_revision_tecnica ?? ''),
        urlSOAP:               String(data.url_soap ?? ''),
        urlSeguroAsiento:      String(data.url_seguro_asiento ?? ''),
        urlControlTaximetro:   String(data.url_control_taximetro ?? ''),
        urlCarnet:             String(c?.url_carnet ?? ''),
        urlLicencia:           String(c?.url_licencia ?? ''),
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
    if (lower === 'sujeto a control') return 'Sujeto a Control';
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
// Only includes fields with real values so upsert never overwrites existing data with empty strings
const mapConductorToDB = (vehicle: Partial<Vehicle>): Record<string, unknown> => {
    const d: Record<string, unknown> = {};
    const str = (v: string | undefined) => v?.trim() || null;
    if (str(vehicle.id))                d.numero_movil            = vehicle.id!.trim();
    if (str(vehicle.rutConductor))      d.rut                     = vehicle.rutConductor!.trim();
    if (str(vehicle.nombreConductor))   d.nombre                  = vehicle.nombreConductor!.trim();
    const fn = safeToISO(vehicle.fechaNacimiento); if (fn) d.fecha_nacimiento = fn;
    if (str(vehicle.celular))           d.celular                 = vehicle.celular!.trim();
    if (str(vehicle.email))             d.email                   = vehicle.email!.trim();
    if (str(vehicle.direccion))         d.direccion               = vehicle.direccion!.trim();
    if (str(vehicle.comuna))            d.comuna                  = vehicle.comuna!.trim();
    if (str(vehicle.claseLicencia))     d.clase_licencia          = vehicle.claseLicencia!.trim();
    if (str(vehicle.leyLicencia))       d.ley_licencia            = vehicle.leyLicencia!.trim();
    if (str(vehicle.municipalidadLicencia)) d.municipalidad_licencia = vehicle.municipalidadLicencia!.trim();
    const cd = safeToISO(vehicle.vigenciaCarnetDesde);   if (cd) d.vigencia_carnet_desde   = cd;
    const ch = safeToISO(vehicle.vigenciaCarnetHasta);   if (ch) d.vigencia_carnet_hasta   = ch;
    const ld = safeToISO(vehicle.vigenciaLicenciaDesde); if (ld) d.vigencia_licencia_desde = ld;
    const lh = safeToISO(vehicle.vigenciaLicenciaHasta); if (lh) d.vigencia_licencia_hasta = lh;
    const sv = safeToISO(vehicle.vencimientoSeguroVidaConductor); if (sv) d.vencimiento_seguro_vida = sv;
    if (str(vehicle.aseguradoraVida))   d.aseguradora_vida        = vehicle.aseguradoraVida!.trim();
    if (str(vehicle.urlCarnet))         d.url_carnet              = vehicle.urlCarnet!.trim();
    if (str(vehicle.urlLicencia))       d.url_licencia            = vehicle.urlLicencia!.trim();
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
    // Document URLs
    if (vehicle.urlPadron             !== undefined) d.url_padron              = vehicle.urlPadron             || null;
    if (vehicle.urlPermisoCirculacion !== undefined) d.url_permiso_circulacion = vehicle.urlPermisoCirculacion || null;
    if (vehicle.urlRevisionTecnica    !== undefined) d.url_revision_tecnica    = vehicle.urlRevisionTecnica    || null;
    if (vehicle.urlSOAP               !== undefined) d.url_soap                = vehicle.urlSOAP               || null;
    if (vehicle.urlSeguroAsiento      !== undefined) d.url_seguro_asiento      = vehicle.urlSeguroAsiento      || null;
    if (vehicle.urlControlTaximetro   !== undefined) d.url_control_taximetro   = vehicle.urlControlTaximetro   || null;
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
        // Obtener el conductor_rut antes de eliminar para verificar huérfanos después
        const { data: vehicle } = await supabase
            .from('vehicles')
            .select('conductor_rut')
            .eq('patente', patente)
            .single();

        const conductorRut = vehicle?.conductor_rut as string | null;

        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('patente', patente);
        if (error) throw error;

        // Si era el último vehículo de este conductor, eliminar también el conductor
        if (conductorRut) {
            const { count } = await supabase
                .from('vehicles')
                .select('*', { count: 'exact', head: true })
                .eq('conductor_rut', conductorRut);
            if (count === 0) {
                await supabase.from('conductores').delete().eq('rut', conductorRut);
            }
        }
    },
};
