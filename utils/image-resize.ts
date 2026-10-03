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

// Shrinks a picked image in the browser and re-encodes it as JPEG, so uploads stay small on cellular data.
export const resizePhoto = async (file: File): Promise<ResizedPhoto> => {
  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the EXIF rotation phones record, so portrait photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not read this file as a photo');
  }
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
