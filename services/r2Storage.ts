import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 Configuration (Loaded from .env.local / environment)
const R2_ACCOUNT_ID = (import.meta as any)?.env?.VITE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = (import.meta as any)?.env?.VITE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = (import.meta as any)?.env?.VITE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = (import.meta as any)?.env?.VITE_R2_BUCKET_NAME || 'backstage-media';
const R2_PUBLIC_URL = ((import.meta as any)?.env?.VITE_R2_PUBLIC_URL || 'https://pub-a18a2f1ff83a4c27b52b4d4d13e03800.r2.dev').replace(/\/+$/, '');

export const isR2Configured = !!(
  R2_ACCOUNT_ID &&
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  R2_BUCKET_NAME &&
  R2_PUBLIC_URL
);

let s3ClientInstance: S3Client | null = null;

function getR2Client(): S3Client | null {
  if (!isR2Configured) return null;
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Converts a base64 data URL to a Uint8Array binary buffer and MIME type.
 */
function dataUrlToBinary(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  try {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return null;

    const mimeMatch = dataUrl.substring(0, commaIndex).match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const base64Data = dataUrl.substring(commaIndex + 1);
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mime };
  } catch (e) {
    console.warn('[R2 Storage] Failed to convert data URL to binary:', e);
    return null;
  }
}

/**
 * Uploads any File, Blob, or Data URL to Cloudflare R2.
 * Returns the public CDN URL on success, or null on failure.
 */
export async function uploadToR2(options: {
  key: string;
  data: File | Blob | Uint8Array | string;
  contentType?: string;
  folder?: string;
}): Promise<string | null> {
  const client = getR2Client();
  if (!client) {
    console.warn('[R2 Storage] R2 is not configured.');
    return null;
  }

  try {
    let bodyData: Uint8Array | Blob;
    let detectedMime = options.contentType || 'application/octet-stream';

    if (typeof options.data === 'string') {
      if (options.data.startsWith('data:')) {
        const parsed = dataUrlToBinary(options.data);
        if (!parsed) return null;
        bodyData = parsed.bytes;
        detectedMime = options.contentType || parsed.mime;
      } else {
        // Plain text or string
        bodyData = new TextEncoder().encode(options.data);
        detectedMime = options.contentType || 'text/plain';
      }
    } else if (options.data instanceof Uint8Array) {
      bodyData = options.data;
    } else if ((typeof Blob !== 'undefined' && (options.data as any) instanceof Blob) || (typeof File !== 'undefined' && (options.data as any) instanceof File)) {
      const arrayBuffer = await options.data.arrayBuffer();
      bodyData = new Uint8Array(arrayBuffer);
      detectedMime = options.contentType || options.data.type || 'application/octet-stream';
    } else {
      console.warn('[R2 Storage] Unsupported data format for upload');
      return null;
    }

    const folderPrefix = options.folder ? `${options.folder.replace(/^\/+|\/+$/g, '')}/` : '';
    const cleanKey = options.key.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${folderPrefix}${cleanKey}`;

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: fullPath,
        Body: bodyData,
        ContentType: detectedMime,
      })
    );

    const publicUrl = `${R2_PUBLIC_URL}/${fullPath}`;
    console.log('[R2 Storage] Upload successful:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[R2 Storage] Upload failed:', err);
    return null;
  }
}

/**
 * Uploads a document binary (PDF, docx, image) to Cloudflare R2.
 */
export async function uploadDocumentToR2(
  projectId: string,
  fileName: string,
  dataUrl?: string
): Promise<string | null> {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }

  const cleanName = (fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${Date.now()}_${cleanName}`;
  const folder = `documents/${projectId || 'general'}`;

  return uploadToR2({
    key,
    data: dataUrl,
    folder,
  });
}

/**
 * Uploads talent headshot image to Cloudflare R2.
 */
export async function uploadHeadshotToR2(
  photoDataUrl: string,
  artistId: string
): Promise<string | null> {
  if (!photoDataUrl || photoDataUrl.startsWith('http')) {
    return photoDataUrl || null;
  }

  const key = `${artistId || 'artist'}_${Date.now()}.jpg`;
  return uploadToR2({
    key,
    data: photoDataUrl,
    folder: 'talent',
    contentType: 'image/jpeg',
  });
}

/**
 * Deletes an object from Cloudflare R2 by its public URL or key.
 */
export async function deleteFromR2(fileUrlOrKey: string): Promise<boolean> {
  const client = getR2Client();
  if (!client || !fileUrlOrKey) return false;

  try {
    let key = fileUrlOrKey;
    if (fileUrlOrKey.startsWith(R2_PUBLIC_URL)) {
      key = fileUrlOrKey.replace(`${R2_PUBLIC_URL}/`, '');
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    console.log('[R2 Storage] Deleted object:', key);
    return true;
  } catch (err) {
    console.warn('[R2 Storage] Delete error:', err);
    return false;
  }
}
