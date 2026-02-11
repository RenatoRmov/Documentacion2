import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://vaowihyinaneuqcedbdf.supabase.co',
    'sb_publishable_1FjW-8d5E0-UuDE3swyxxA_HNQVK7gs'
);

async function main() {
    const { data } = await supabase.from('vehicles_import').select('*').eq('Movil', 1).single();
    if (!data) { console.log('Not found'); return; }

    // List all keys with their byte codes to identify exact key names
    for (const [key, val] of Object.entries(data)) {
        const escaped = JSON.stringify(key);
        if (key.includes('icencia') || key.includes('unicipal') || key.includes('igencia')) {
            console.log(`KEY: ${escaped} => VALUE: ${JSON.stringify(val)}`);
        }
    }

    // Also check vigencia_hasta
    console.log('\n--- All keys containing "Hasta" or "hasta" ---');
    for (const [key, val] of Object.entries(data)) {
        if (key.toLowerCase().includes('hasta') || key.toLowerCase().includes('vigencia')) {
            console.log(`KEY: ${JSON.stringify(key)} => VALUE: ${JSON.stringify(val)}`);
        }
    }
}

main();
