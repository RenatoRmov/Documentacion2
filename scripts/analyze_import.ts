import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://vaowihyinaneuqcedbdf.supabase.co',
    'sb_publishable_1FjW-8d5E0-UuDE3swyxxA_HNQVK7gs'
);

async function main() {
    // 1. Fetch all rows from vehicles_import
    const { data, error } = await supabase
        .from('vehicles_import')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No data found in vehicles_import');
        return;
    }

    // 2. Print column names
    const cols = Object.keys(data[0]);
    console.log('=== COLUMNS (' + cols.length + ') ===');
    cols.forEach(c => console.log('  -', c));

    // 3. Print sample rows
    console.log('\n=== SAMPLE DATA (first 3 rows) ===');
    data.slice(0, 3).forEach((row: any, i: number) => {
        console.log(`\n--- Row ${i + 1} ---`);
        for (const [key, val] of Object.entries(row)) {
            console.log(`  ${key}: ${JSON.stringify(val)}`);
        }
    });

    // 4. Total count
    const { count } = await supabase
        .from('vehicles_import')
        .select('*', { count: 'exact', head: true });
    console.log('\n=== TOTAL ROWS:', count, '===');
}

main();
