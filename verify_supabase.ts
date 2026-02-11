
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log('Testing Supabase Connection...');
    try {
        // Try to fetch from vehicles table
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error fetching from vehicles table:', error);
            process.exit(1);
        }

        console.log('Successfully connected to Supabase!');
        console.log('Vehicles found:', data?.length ?? 0);
        console.log('Verification Passed!');
    } catch (error) {
        console.error('Verification Failed:', error);
        process.exit(1);
    }
}

verify();
