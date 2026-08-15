import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { error } = await supabase
        .from('onboarding_invites')
        .select('token')
        .limit(1);

    if (error) {
        console.log('TABLE DOES NOT EXIST YET:', error.message);
        console.log('\nRun this SQL in the Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS onboarding_invites (
  token         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_movil  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at       timestamptz,
  conductor_rut text
);

ALTER TABLE onboarding_invites DISABLE ROW LEVEL SECURITY;
    `);
    } else {
        console.log('onboarding_invites table already exists.');
    }
}

main();
