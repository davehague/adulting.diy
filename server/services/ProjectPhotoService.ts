import { randomUUID } from 'node:crypto';
import prisma from '@/server/utils/prisma/client';
import { HttpError } from '@/server/utils/api-errors';
import { getPrivate, putPrivate, removeBlobs, type PrivateBlobRead } from '@/server/utils/blob-storage';
import {
  MAX_FULL_PHOTO_BYTES,
  MAX_PROJECT_PHOTOS,
  MAX_THUMB_PHOTO_BYTES,
  type PhotoVariant,
  type ProjectPhotoDto,
} from '@/types/project';

export interface PhotoUpload {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const isJpeg = (data: Buffer): boolean =>
  data.length >= JPEG_MAGIC.length && JPEG_MAGIC.every((byte, i) => data[i] === byte);

export class ProjectPhotoService {
  async add(householdId: string, projectId: string, userId: string, upload: PhotoUpload): Promise<ProjectPhotoDto> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, householdId, metaStatus: 'active' },
      select: { id: true },
    });
    if (!project) throw new HttpError('Project not found', 404);

    const existing = await prisma.projectPhoto.findMany({ where: { projectId }, select: { position: true } });
    if (existing.length >= MAX_PROJECT_PHOTOS) {
      throw new HttpError(`This project already has ${MAX_PROJECT_PHOTOS} photos`, 409);
    }
    if (!isJpeg(upload.full) || !isJpeg(upload.thumb)) {
      throw new HttpError('Only JPEG photos are accepted', 400);
    }
    if (upload.full.length > MAX_FULL_PHOTO_BYTES || upload.thumb.length > MAX_THUMB_PHOTO_BYTES) {
      throw new HttpError('Photo is too large', 413);
    }

    const id = randomUUID();
    const base = `households/${householdId}/projects/${projectId}/${id}`;
    const fullPath = `${base}-full.jpg`;
    const thumbPath = `${base}-thumb.jpg`;
    const position = existing.reduce((max, photo) => Math.max(max, photo.position), -1) + 1;

    try {
      await putPrivate(fullPath, upload.full);
      await putPrivate(thumbPath, upload.thumb);
    } catch (error) {
      console.error('[ProjectPhotoService] storing photo failed:', error);
      await this.cleanUp([fullPath, thumbPath]);
      throw new HttpError('Photo storage is unavailable. Try again.', 502);
    }

    try {
      const photo = await prisma.projectPhoto.create({
        data: { id, projectId, fullPath, thumbPath, width: upload.width, height: upload.height, position, uploadedById: userId },
      });
      return { id: photo.id, width: photo.width, height: photo.height, position: photo.position };
    } catch (error) {
      await this.cleanUp([fullPath, thumbPath]);
      throw error;
    }
  }

  async read(
    householdId: string,
    projectId: string,
    photoId: string,
    variant: PhotoVariant,
    ifNoneMatch?: string,
  ): Promise<PrivateBlobRead> {
    const photo = await this.requirePhoto(householdId, projectId, photoId);
    const pathname = variant === 'thumb' ? photo.thumbPath : photo.fullPath;
    let result: PrivateBlobRead | null;
    try {
      result = await getPrivate(pathname, ifNoneMatch);
    } catch (error) {
      console.error('[ProjectPhotoService] reading photo failed:', error);
      throw new HttpError('Photo storage is unavailable. Try again.', 502);
    }
    if (!result) throw new HttpError('Photo not found', 404);
    return result;
  }

  async remove(householdId: string, projectId: string, photoId: string): Promise<void> {
    const photo = await this.requirePhoto(householdId, projectId, photoId);
    await prisma.projectPhoto.delete({ where: { id: photo.id } });
    await this.cleanUp([photo.fullPath, photo.thumbPath]);
  }

  // Best effort: an orphaned blob is unreachable (no row points at it), so a failure here must not fail the request.
  private async cleanUp(pathnames: string[]): Promise<void> {
    try {
      await removeBlobs(pathnames);
    } catch (error) {
      console.error('[ProjectPhotoService] removing blobs failed:', pathnames, error);
    }
  }

  private async requirePhoto(householdId: string, projectId: string, photoId: string) {
    const photo = await prisma.projectPhoto.findFirst({
      where: { id: photoId, projectId, project: { householdId, metaStatus: 'active' } },
    });
    if (!photo) throw new HttpError('Photo not found', 404);
    return photo;
  }
}
