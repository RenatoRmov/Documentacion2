import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface ZipEntry {
  url:      string;
  zipPath:  string;  // path inside ZIP (may include folder/)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getExt(url: string): string {
  if (!url) return 'jpg';
  const clean = url.split('?')[0];
  const ext   = clean.split('.').pop()?.toLowerCase() ?? '';
  return ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg';
}

export function buildDocFilename(
  movil: string, patente: string, slug: string, expiryDate: string, url: string
): string {
  const ext  = getExt(url);
  const num  = (movil || '00').padStart(2, '0');
  const pat  = patente.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lower = (expiryDate ?? '').trim().toLowerCase();
  let date    = 'sin-fecha';
  if (lower && !['sin información', 'sin informacion', 'no aplica'].includes(lower)) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(expiryDate)) {
      const [d, m, y] = expiryDate.split('-');
      date = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      date = expiryDate;
    }
  }
  return `movil${num}_${pat}_${slug}_${date}.${ext}`;
}

// ─── Single file ─────────────────────────────────────────────────────────────

export async function downloadSingle(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  saveAs(blob, filename);
}

// ─── ZIP download ─────────────────────────────────────────────────────────────

export interface ZipResult { downloaded: number; failed: number }

export async function downloadZip(
  entries:    ZipEntry[],
  zipName:    string,
  onProgress?: (pct: number) => void,
): Promise<ZipResult> {
  const zip = new JSZip();

  const results = await Promise.allSettled(
    entries.map(async ({ url, zipPath }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return { zipPath, blob };
    })
  );

  let downloaded = 0, failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') { zip.file(r.value.zipPath, r.value.blob); downloaded++; }
    else failed++;
  }

  if (downloaded === 0) throw new Error('No se pudo descargar ningún archivo. Verifica la conexión o las políticas de Storage.');

  const content = await zip.generateAsync({ type: 'blob' }, meta => {
    onProgress?.(Math.round(meta.percent));
  });
  saveAs(content, `${zipName}.zip`);
  return { downloaded, failed };
}
