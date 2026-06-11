import { supabase } from '../lib/supabaseClient';

export const uploadDoc = async (path: string, file: File): Promise<string> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const fullPath = `${path}.${ext}`;
  const { error } = await supabase.storage
    .from('radiomovil-docs')
    .upload(fullPath, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage
    .from('radiomovil-docs')
    .getPublicUrl(fullPath);
  return data.publicUrl;
};
