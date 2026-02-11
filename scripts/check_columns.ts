import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://vaowihyinaneuqcedbdf.supabase.co',
    'sb_publishable_1FjW-8d5E0-UuDE3swyxxA_HNQVK7gs'
);

async function main() {
    // Test: try to insert a row with the new columns to see if they exist already
    const { data, error } = await supabase
        .from('vehicles')
        .select('direccion, comuna, municipalidad_licencia, ley_licencia')
        .limit(1);

    if (error) {
        console.log('NEW COLUMNS DO NOT EXIST YET:', error.message);
        console.log('\nPlease run this SQL in the Supabase SQL Editor:');
        console.log(`
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS comuna TEXT,
ADD COLUMN IF NOT EXISTS municipalidad_licencia TEXT,
ADD COLUMN IF NOT EXISTS ley_licencia TEXT;
    `);
    } else {
        console.log('New columns already exist:', data);
    }
}

main();
