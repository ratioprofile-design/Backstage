import { isR2Configured, uploadHeadshotToR2 } from './r2Storage';

// Browser image compressor & thumbnail optimizer
// Downscales raw multi-megabyte photos to lightweight ~20-30KB web avatars
// Prevents Out-Of-Memory (OOM) crashes on Supabase Nano (t4g.nano) instances.

export async function compressHeadshot(src: string, maxDimension = 400, quality = 0.72): Promise<string> {
  if (!src || typeof window === 'undefined') return src;
  
  // If already a small data URL (< 45KB), return as-is
  if (src.startsWith('data:image/') && src.length < 60000) {
    return src;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      // Timeout fallback: if image takes too long to load, return original
      resolve(src);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(src);
        }

        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(src);

        // High quality downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('[ImageOptimizer] Compression failed, using source:', err);
        resolve(src);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(src);
    };

    img.src = src;
  });
}

/**
 * Optimizes an entire talent pool for cloud sync by offloading photos to
 * Cloudflare R2 (zero egress) or compressing to lightweight avatars.
 */
export async function optimizeTalentForCloud(talentList: any[]): Promise<any[]> {
  if (!Array.isArray(talentList) || talentList.length === 0) return talentList;

  return Promise.all(
    talentList.map(async (t) => {
      let optPhotoUrl = t.photoUrl;
      if (t.photoUrl && t.photoUrl.startsWith('data:image/')) {
        if (isR2Configured) {
          try {
            const r2Url = await uploadHeadshotToR2(t.photoUrl, t.id);
            if (r2Url) optPhotoUrl = r2Url;
          } catch (e) {
            console.warn('[R2 Storage] Headshot upload fallback:', e);
          }
        }
        if (!optPhotoUrl || optPhotoUrl.startsWith('data:image/')) {
          optPhotoUrl = await compressHeadshot(t.photoUrl, 380, 0.7);
        }
      }

      let optPhotos = t.photos;
      if (Array.isArray(t.photos) && t.photos.length > 0) {
        optPhotos = await Promise.all(
          t.photos.slice(0, 3).map(async (p: string) => {
            if (p && p.startsWith('data:image/') && isR2Configured) {
              try {
                const r2Url = await uploadHeadshotToR2(p, t.id);
                if (r2Url) return r2Url;
              } catch (e) {
                console.warn('[R2 Storage] Headshot gallery fallback:', e);
              }
            }
            return compressHeadshot(p, 380, 0.7);
          })
        );
      }

      return {
        ...t,
        photoUrl: optPhotoUrl,
        photos: optPhotos,
      };
    })
  );
}
