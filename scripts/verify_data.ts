import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://vaowihyinaneuqcedbdf.supabase.co',
    'sb_publishable_1FjW-8d5E0-UuDE3swyxxA_HNQVK7gs'
);

async function main() {
    // 1. Total count
    const { count } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
    console.log(`Total vehicles: ${count}`);

    // 2. Sample 3 rows to verify
    const { data } = await supabase.from('vehicles').select('*').in('numero_movil', ['1', '14', '125']).order('numero_movil');

    if (data) {
        for (const v of data) {
            console.log(`\n=== Movil ${v.numero_movil} (${v.patente}) ===`);
            console.log(`  vencimiento_permiso_circulacion: ${v.vencimiento_permiso_circulacion}`);
            console.log(`  vencimiento_revision_tecnica: ${v.vencimiento_revision_tecnica}`);
            console.log(`  vencimiento_soap: ${v.vencimiento_soap}`);
            console.log(`  vencimiento_control_taximetro: ${v.vencimiento_control_taximetro}`);
            console.log(`  certificado_antecedentes: ${v.certificado_antecedentes}`);
            console.log(`  nombre_propietario: ${v.nombre_propietario}`);
            console.log(`  rut_propietario: ${v.rut_propietario}`);
            console.log(`  nombre_conductor: ${v.nombre_conductor}`);
            console.log(`  direccion: ${v.direccion}`);
            console.log(`  comuna: ${v.comuna}`);
            console.log(`  municipalidad_licencia: ${v.municipalidad_licencia}`);
            console.log(`  vigencia_licencia_desde: ${v.vigencia_licencia_desde}`);
            console.log(`  vigencia_licencia_hasta: ${v.vigencia_licencia_hasta}`);
        }
    }

    // 3. Check for nulls in date fields we parsed (spot check for "sept" dates)
    const { data: septRows } = await supabase.from('vehicles').select('numero_movil, patente, vencimiento_revision_tecnica').in('numero_movil', ['14', '84', '125']);
    console.log('\n=== Sept vehicles check ===');
    septRows?.forEach(r => console.log(`  Movil ${r.numero_movil}: rev_tecnica=${r.vencimiento_revision_tecnica}`));
}

main();
