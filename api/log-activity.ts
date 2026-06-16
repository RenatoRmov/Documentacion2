// Registra cada guardado del conductor en portal_activity para el resumen diario
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow from browser (portal is same origin but this makes intent explicit)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { conductor_rut, conductor_nombre, movil, patente, field_label } = req.body ?? {};
  if (!conductor_rut || !conductor_nombre || !movil || !field_label) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.from('portal_activity').insert({
    conductor_rut,
    conductor_nombre,
    movil: String(movil),
    patente: patente ?? null,
    field_label,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
