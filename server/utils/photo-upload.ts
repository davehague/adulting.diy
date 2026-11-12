import { readMultipartFormData, type H3Event } from "h3";
import { HttpError } from "@/server/utils/api-errors";
import { photoDimensionsSchema } from "@/server/utils/project-schemas";
import { type PhotoUpload } from "@/server/services/ProjectPhotoService";

// The photo form a browser or a script sends: `full` and `thumb` JPEG files plus the full image's `width` and `height`.
// The service checks the bytes; this only checks that the parts are there.
export const readPhotoUpload = async (event: H3Event): Promise<PhotoUpload> => {
  const parts = (await readMultipartFormData(event)) ?? [];
  const part = (name: string) => parts.find((p) => p.name === name);
  const full = part('full')?.data;
  const thumb = part('thumb')?.data;
  if (!full || !thumb) throw new HttpError('Both the photo and its thumbnail are required', 400);

  const dimensions = photoDimensionsSchema.safeParse({
    width: part('width')?.data.toString('utf8'),
    height: part('height')?.data.toString('utf8'),
  });
  if (!dimensions.success) throw new HttpError('Photo width and height are required', 400);
  return { full, thumb, width: dimensions.data.width, height: dimensions.data.height };
};
