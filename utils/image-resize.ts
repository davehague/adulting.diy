export interface Size {
  width: number;
  height: number;
}

export interface ResizedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export const FULL_MAX_EDGE = 2000;
export const NOT_A_PHOTO_MESSAGE = 'Could not read this file as a photo';
export const HEIC_FAILED_MESSAGE = 'Could not read this iPhone (HEIC) photo. Export it as a JPEG and try again.';

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
// Major brands an ISO media file declares at bytes 8-11 when it is a HEIC/HEIF still image.
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);

type HeicDecoder = (args: { blob: Blob; type: 'bitmap'; options?: ImageBitmapOptions }) => Promise<ImageBitmap>;

export interface DecodeDeps {
  createBitmap: (file: Blob) => Promise<ImageBitmap>;
  loadHeic: () => Promise<HeicDecoder>;
}
export const THUMB_MAX_EDGE = 400;
const FULL_QUALITY = 0.85;
const THUMB_QUALITY = 0.8;

export const fitWithin = (size: Size, maxEdge: number): Size => {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxEdge) return { width: size.width, height: size.height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
};

const encodeJpeg = (bitmap: ImageBitmap, size: Size, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Could not process this photo'));
      return;
    }
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process this photo'))),
      'image/jpeg',
      quality,
    );
  });

// iPhone photos arrive as HEIC when picked from a Mac (Finder, Downloads, AirDrop). Safari decodes them; Chrome and
// Firefox do not, and often give no media type either, so the name and the file signature are checked too.
export const looksLikeHeic = async (file: File): Promise<boolean> => {
  if (HEIC_TYPES.has(file.type.toLowerCase())) return true;
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (head.length < 12) return false;
  const text = (from: number, to: number): string => String.fromCharCode(...head.slice(from, to));
  return text(4, 8) === 'ftyp' && HEIC_BRANDS.has(text(8, 12));
};

const browserDeps: DecodeDeps = {
  // 'from-image' applies the EXIF rotation phones record, so portrait photos stay upright.
  createBitmap: (file) => createImageBitmap(file, { imageOrientation: 'from-image' }),
  // About 3 MB of WebAssembly, so it is only fetched the first time a browser cannot read a HEIC photo itself.
  loadHeic: async () => (await import('heic-to')).heicTo as HeicDecoder,
};

// The browser's own decoder first; the bundled HEIC decoder only when that fails on a HEIC file.
export const decodeImage = async (file: File, deps: DecodeDeps = browserDeps): Promise<ImageBitmap> => {
  try {
    return await deps.createBitmap(file);
  } catch {
    if (!(await looksLikeHeic(file))) throw new Error(NOT_A_PHOTO_MESSAGE);
  }
  try {
    const heicTo = await deps.loadHeic();
    return await heicTo({ blob: file, type: 'bitmap', options: { imageOrientation: 'from-image' } });
  } catch {
    throw new Error(HEIC_FAILED_MESSAGE);
  }
};

// Shrinks a picked image in the browser and re-encodes it as JPEG, so uploads stay small on cellular data.
export const resizePhoto = async (file: File): Promise<ResizedPhoto> => {
  const bitmap = await decodeImage(file);
  try {
    const fullSize = fitWithin(bitmap, FULL_MAX_EDGE);
    const thumbSize = fitWithin(bitmap, THUMB_MAX_EDGE);
    const full = await encodeJpeg(bitmap, fullSize, FULL_QUALITY);
    const thumb = await encodeJpeg(bitmap, thumbSize, THUMB_QUALITY);
    return { full, thumb, width: fullSize.width, height: fullSize.height };
  } finally {
    bitmap.close();
  }
};
