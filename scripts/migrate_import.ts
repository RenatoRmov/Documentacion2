import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://vaowihyinaneuqcedbdf.supabase.co',
    'sb_publishable_1FjW-8d5E0-UuDE3swyxxA_HNQVK7gs'
);

// Spanish month abbreviations to month number
const MONTH_MAP: Record<string, string> = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'ago': '08',
    'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dic': '12'
};

/**
 * Parse Spanish date formats into ISO YYYY-MM-DD:
 * "31-may-26" => "2026-05-31"
 * "may-26"    => "2026-05-15" (default day 15)
 * "17-10-2024" => "2024-10-17"
 * "29-05-2025" => "2025-05-29"
 * "No Aplica" / null / "" => null
 */
function parseDate(raw: any): string | null {
    if (!raw || raw === 'NULL' || raw === 'null') return null;
    const s = String(raw).trim();
    if (!s) return null;

    // Check if it's a non-date string like "No Aplica"
    const lower = s.toLowerCase();
    if (lower === 'no aplica' || lower === 'sin información' || lower === 'sin informacion') return null;

    // Format: DD-MMM-YY (e.g. "31-may-26")
    const match3 = s.match(/^(\d{1,2})-([a-zA-Z]{3,4})-(\d{2})$/i);
    if (match3) {
        const day = match3[1].padStart(2, '0');
        const monthStr = match3[2].toLowerCase();
        const month = MONTH_MAP[monthStr];
        if (!month) { console.warn(`Unknown month: ${monthStr} in "${s}"`); return null; }
        const year = parseInt(match3[3]) < 50 ? `20${match3[3]}` : `19${match3[3]}`;
        return `${year}-${month}-${day}`;
    }

    // Format: MMM-YY (e.g. "may-26") — no day, default to 15
    const match2 = s.match(/^([a-zA-Z]{3,4})-(\d{2})$/i);
    if (match2) {
        const monthStr = match2[1].toLowerCase();
        const month = MONTH_MAP[monthStr];
        if (!month) { console.warn(`Unknown month: ${monthStr} in "${s}"`); return null; }
        const year = parseInt(match2[2]) < 50 ? `20${match2[2]}` : `19${match2[2]}`;
        return `${year}-${month}-15`;
    }

    // Format: DD-MM-YYYY (e.g. "17-10-2024")
    const match4 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (match4) {
        const day = match4[1].padStart(2, '0');
        const month = match4[2].padStart(2, '0');
        return `${match4[3]}-${month}-${day}`;
    }

    // Already ISO?
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;

    console.warn(`Could not parse date: "${s}"`);
    return null;
}

/** Normalize text fields: "NO Aplica" => "No Aplica", "NULL"/""/"null" => null, uppercase text */
function normalizeText(raw: any): string | null {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s || s === 'NULL' || s === 'null') return null;
    return s.toUpperCase();
}

/** Normalize compliance fields: prestacion_ss, contrato_arriendo, certificado_antecedentes */
function normalizeCompliance(raw: any): string | null {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s || s === 'NULL' || s === 'null') return null;
    const lower = s.toLowerCase();
    if (lower === 'ok') return 'OK';
    if (lower === 'no aplica') return 'No Aplica';
    if (lower === 'sin información' || lower === 'sin informacion') return 'Sin Información';
    return s;
}

/** Normalize date-or-status fields (e.g. CONTROL TAXIMETRO can be a date OR "No Aplica") */
function normalizeDateOrStatus(raw: any): string | null {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (!s || s === 'NULL' || s === 'null') return null;
    const lower = s.toLowerCase();
    if (lower === 'no aplica') return 'No Aplica';
    if (lower === 'sin información' || lower === 'sin informacion') return 'Sin Información';
    return parseDate(s);
}

async function main() {
    console.log('=== MIGRATION: vehicles_import → vehicles ===\n');

    // 1. Fetch all from vehicles_import
    const { data: importRows, error: fetchError } = await supabase
        .from('vehicles_import')
        .select('*');

    if (fetchError) {
        console.error('Error fetching vehicles_import:', fetchError.message);
        return;
    }

    if (!importRows || importRows.length === 0) {
        console.log('No rows found in vehicles_import');
        return;
    }

    console.log(`Found ${importRows.length} rows in vehicles_import\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of importRows) {
        const movilId = String(row['Movil']);

        // Helper to find keys with newlines/spaces
        const getVal = (partialKey: string) => {
            const keys = Object.keys(row);
            // Normalize both sides: collapse whitespace (spaces, newlines, etc.) to single space
            const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
            const target = normalize(partialKey);
            const found = keys.find(k => normalize(k) === target);
            return found ? row[found] : undefined;
        };

        const mapped: Record<string, any> = {
            numero_movil: movilId,
            patente: normalizeText(getVal('PATENTE')),
            tipo: normalizeText(getVal('TIPO')),
            marca: normalizeText(getVal('MARCA')),
            modelo: normalizeText(getVal('MODELO')),
            color: normalizeText(getVal('COLOR')),
            asientos: getVal('ASIENTOS') ? Number(getVal('ASIENTOS')) : null,
            estado: getVal('ESTADO') || 'Externo',
            anio: getVal('AÑO') ? Number(getVal('AÑO')) : null,
            status_operativo: 'Activo',

            nombre_propietario: normalizeText(getVal('NOMPROP')),
            rut_propietario: normalizeText(getVal('RUTPROP')),

            certificado_antecedentes: normalizeCompliance(getVal('Certificado Antecedentes')),
            prestacion_ss: normalizeCompliance(getVal('PRESTACION DE SS')),
            contrato_arriendo: normalizeCompliance(getVal('CONTRATO ARRIENDO')),

            vencimiento_permiso_circulacion: parseDate(getVal('PERMISO CIRCULACION')),
            municipalidad_permiso: normalizeText(getVal('MUNI. PERM.CIRC.')),
            vencimiento_control_taximetro: normalizeDateOrStatus(getVal('CONTROL TAXIMETRO')),
            vencimiento_revision_tecnica: parseDate(getVal('REVISION TECNICA')),
            vencimiento_soap: parseDate(getVal('SOAP')),

            vencimiento_seguro_accidentes: parseDate(getVal('VIGENCIA SEG.ACC.')),
            lugar_seguro_accidentes: normalizeText(getVal('COMPAÑIA SEGURO ACCIDENTE')),
            vencimiento_seguro_asiento: normalizeDateOrStatus(getVal('SEGURO ASIENTO')),
            aseguradora_asiento: normalizeText(getVal('ASEGURADORA Seguro ASIENTO')),
            vencimiento_seguro_vida_conductor: parseDate(getVal('SEGURO VIDA Cond.')),
            aseguradora_vida: normalizeText(getVal('ASEGURADORA Seguro VIDA Cond.')),

            nombre_conductor: normalizeText(getVal('NOMBRE CONDUCTOR')),
            rut_conductor: normalizeText(getVal('RUTCOND')),
            fecha_nacimiento: parseDate(getVal('Fecha Nacimiento')),
            celular: getVal('CELULAR') ? String(getVal('CELULAR')) : null,
            email: normalizeText(getVal('MAIL')),
            direccion: normalizeText(getVal('DIRECCION')),
            comuna: normalizeText(getVal('COMUNA')),
            clase_licencia: normalizeText(getVal('CLASE LICENCIA')),
            ley_licencia: normalizeText(getVal('LEY LICENCIA')),
            municipalidad_licencia: normalizeText(getVal('Municipalidad que otorga Licencia')),

            vigencia_carnet_desde: parseDate(getVal('Fecha Emision Carnet')),
            vigencia_carnet_hasta: parseDate(getVal('Fecha VCMTO Carnet.')),
            vigencia_licencia_desde: parseDate(getVal('Vigencia Desde')),
            vigencia_licencia_hasta: parseDate(getVal('Vigencia Hasta')),
        };

        // Remove null/undefined keys to avoid overwriting with null
        const cleanMapped: Record<string, any> = {};
        for (const [key, val] of Object.entries(mapped)) {
            if (val !== undefined) cleanMapped[key] = val;
        }

        // Upsert by numero_movil
        const { error: upsertError } = await supabase
            .from('vehicles')
            .upsert(cleanMapped, { onConflict: 'numero_movil' });

        if (upsertError) {
            console.error(`✗ Móvil ${movilId}: ${upsertError.message}`);
            errorCount++;
        } else {
            console.log(`✓ Móvil ${movilId} (${mapped.patente}) migrado correctamente`);
            successCount++;
        }
    }

    console.log(`\n=== RESULTADO ===`);
    console.log(`Éxitos: ${successCount}`);
    console.log(`Errores: ${errorCount}`);
    console.log(`Total procesados: ${importRows.length}`);

    // Verify
    const { count } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true });
    console.log(`\nFilas en tabla vehicles (producción): ${count}`);
}

main();
