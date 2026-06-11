import { supabase } from '../lib/supabaseClient';

export const uploadDoc = async (path: string, file: File): Promise<string> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  // Sanitize path segments to avoid special characters in storage paths
  const safePath = path.replace(/[^a-zA-Z0-9/_\-]/g, '_');
  const fullPath = `${safePath}.${ext}`;

  const { error } = await supabase.storage
    .from('radiomovil-docs')
    .upload(fullPath, file, { upsert: true, contentType: file.type || 'application/octet-stream' });

  if (error) throw new Error(`Storage upload failed: ${error.message} (path: ${fullPath})`);

  const { data } = supabase.storage.from('radiomovil-docs').getPublicUrl(fullPath);
  return data.publicUrl;
};
