import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

async function downloadAndCacheImage(url: string, handlePrefix: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url;
  try {
    const cacheDir = path.resolve(__dirname, 'public/talent_cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 10);
    const cleanPrefix = (handlePrefix || 'actor').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `${cleanPrefix}_${hash}.jpg`;
    const filePath = path.join(cacheDir, filename);

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
      const fileBuf = fs.readFileSync(filePath);
      return `data:image/jpeg;base64,${fileBuf.toString('base64')}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
      }
    });

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 500) {
        fs.writeFileSync(filePath, Buffer.from(buffer));
        // Return base64 data URL so it saves directly into Supabase Cloud project state for multi-user collaboration
        return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn('[TalentCache] Failed to download image:', err);
  }
  return url;
}

function talentSyncPlugin() {
  const syncQueue: any[] = [];
  return {
    name: 'talent-sync-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        // Image proxy to bypass Instagram CDN expiration or hotlink blocking
        if (req.url.startsWith('/api/talent/image-proxy')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          const urlObj = new URL(req.url, 'http://localhost:3000');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing url');
            return;
          }
          try {
            const localUrl = await downloadAndCacheImage(targetUrl, 'actor');
            if (localUrl.startsWith('/talent_cache/')) {
              const fullPath = path.resolve(__dirname, 'public', localUrl.replace(/^\//, ''));
              if (fs.existsSync(fullPath)) {
                res.setHeader('Content-Type', 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                fs.createReadStream(fullPath).pipe(res);
                return;
              }
            }
          } catch (e) {}
        }

        if (req.url === '/api/talent/sync') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const handle = parsed.handle || 'actor';

                // Download and cache primary photo permanently
                if (parsed.photoUrl && parsed.photoUrl.startsWith('http')) {
                  parsed.photoUrl = await downloadAndCacheImage(parsed.photoUrl, handle);
                }

                // Download and cache any additional photos
                if (Array.isArray(parsed.photos)) {
                  const cachedPhotos: string[] = [];
                  for (const pUrl of parsed.photos) {
                    if (pUrl && pUrl.startsWith('http')) {
                      const cached = await downloadAndCacheImage(pUrl, handle);
                      cachedPhotos.push(cached);
                    } else if (pUrl) {
                      cachedPhotos.push(pUrl);
                    }
                  }
                  parsed.photos = cachedPhotos;
                }

                syncQueue.push(parsed);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, count: syncQueue.length, item: parsed }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            const items = syncQueue.splice(0, syncQueue.length);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ items }));
            return;
          }
        }

        // Local disk backup endpoint for 100+ actors and photos
        if (req.url === '/api/talent/backup-disk' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const cacheDir = path.resolve(__dirname, 'public/talent_cache');
              if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
              fs.writeFileSync(path.join(cacheDir, 'local_project_backup.json'), body);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://scvdsajwsuzstagjjltg.supabase.co';
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdmRzYWp3c3V6c3RhZ2pqbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjAzODcsImV4cCI6MjA4MjczNjM4N30._JbsT7W4NRESXqVggSE_Ahel6aXYOymPk9zlzYiMGGU';

    return {
      clearScreen: false,
      server: {
        port: 3000,
        strictPort: true,
        host: '0.0.0.0',
        proxy: {
          // TokenRouter blocks browser CORS, so tunnel it through the dev server.
          '/tokenrouter': {
            target: 'https://api.tokenrouter.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/tokenrouter/, ''),
          },
        },
      },
      plugins: [react(), talentSyncPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
        'process.env.OPENROUTER_API_KEY': JSON.stringify(env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || ''),
        'process.env.TOKENROUTER_API_KEY': JSON.stringify(env.VITE_TOKENROUTER_API_KEY || env.TOKENROUTER_API_KEY || ''),
        'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''),
        'process.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
