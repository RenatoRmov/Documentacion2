import { supabase } from '../lib/supabaseClient';

const BUCKET = 'radiomovil-docs';

// Extrae el path relativo dentro del bucket desde una URL pública de Supabase Storage
function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = `/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    // Strip query params (cache busters) if present
    return decodeURIComponent(publicUrl.slice(idx + marker.length).split('?')[0]);
  } catch {
    return null;
  }
}

export const uploadDoc = async (
  path: string,
  file: File,
  oldUrl?: string,   // URL del archivo anterior para eliminarlo después de subir
): Promise<string> => {
  const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safePath = path.replace(/[^a-zA-Z0-9/_\-]/g, '_');
  // Timestamp en el nombre → URL única en cada subida → nunca hay cache del archivo anterior
  const fullPath = `${safePath}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, file, { contentType: file.type || 'application/octet-stream' });

  if (error) throw new Error(`Error al subir archivo: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);

  // Eliminar archivo anterior del storage (fire-and-forget — no bloquea ni falla si no se puede)
  if (oldUrl) {
    const oldPath = extractStoragePath(oldUrl);
    if (oldPath) {
      supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {});
    }
  }

  return data.publicUrl;
};
