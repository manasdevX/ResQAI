import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config({ quiet: true });

// ─────────────────────────────────────────────────────────────────────────────
// WHY LAZY CONFIG:
//
// In an ES-module project, all `import` statements are hoisted and evaluated
// BEFORE any top-level code in the importing file runs. This means:
//
//   server.js → imports upload.js → upload.js top-level runs → dotenv NOT yet loaded
//   → cloudinary.config({ cloud_name: undefined, ... }) → SDK poisoned permanently
//   → every upload returns HTTP 403
//
// Fix: configure Cloudinary lazily inside `getCloudinary()`, which is called
// only at request time — well after dotenv has loaded the .env file.
// ─────────────────────────────────────────────────────────────────────────────

let _cloudinaryConfigured = false;

const getCloudinary = () => {
  if (!_cloudinaryConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
      api_key:    process.env.CLOUDINARY_API_KEY?.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
      secure:     true, // always use HTTPS
    });
    _cloudinaryConfigured = true;

    // Log once so we can confirm credentials are loaded (never logs the secret)
    const cfg = cloudinary.config();
    if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
      console.error('[cloudinary] ⚠️  Missing credentials — uploads will fail.');
      console.error('  CLOUDINARY_CLOUD_NAME:', cfg.cloud_name  || '❌ not set');
      console.error('  CLOUDINARY_API_KEY:   ', cfg.api_key     || '❌ not set');
      console.error('  CLOUDINARY_API_SECRET:', cfg.api_secret ? '✓ set' : '❌ not set');
      throw new Error('Cloudinary credentials missing or invalid at startup.');
    } else {
      console.log(`[cloudinary] ✓ Credentials loaded — cloud: "${cfg.cloud_name}"`);
    }
  }
  return cloudinary;
};

// ─── Multer ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: images, videos, PDF.`), false);
  }
};

// Files land in req.files[n].buffer — Cloudinary upload happens in the controller
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// Avatar upload — images only, 2 MB limit
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for avatars'), false);
  },
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the explicit Cloudinary resource_type from a MIME type.
 * Never pass 'auto' — Cloudinary SDK v2 signs the request before sending it,
 * and 'auto' causes a signature mismatch when the server resolves the actual type.
 */
export const resolveResourceType = (mimetype = '') => {
  if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) return 'video';
  if (mimetype.startsWith('image/'))                                   return 'image';
  return 'raw'; // PDF and other binary assets
};

/**
 * Strip file extension and unsafe chars from a filename for use as public_id.
 * A dot in public_id causes Cloudinary SDK v2 to recompute the signature with
 * the extension as the `format` param, resulting in a 403 mismatch.
 */
export const sanitizePublicId = (originalname = '') =>
  originalname
    .replace(/\.[^.]+$/, '')        // strip extension (e.g. ".jpg")
    .replace(/\s+/g, '_')           // spaces → underscores
    .replace(/[^a-zA-Z0-9_-]/g, '') // remove unsafe chars
    .slice(0, 80)                   // cap length
    || 'upload';                    // fallback if name becomes empty

/**
 * Upload a Buffer to Cloudinary using upload_stream (raw bytes, no base64).
 *
 * WHY upload_stream instead of upload() with base64:
 * - Base64 inflates the payload by ~33% and can produce malformed multipart
 *   requests for some file types, causing Cloudinary's server to return a
 *   non-JSON 403 (rejected at HTTP level, not API level).
 * - upload_stream pipes raw bytes via a proper streaming multipart request —
 *   the officially recommended approach for buffer uploads in Cloudinary SDK v2.
 *
 * Credentials are read lazily via getCloudinary() so that dotenv is guaranteed
 * to have loaded the .env file before we touch process.env.
 */
export const uploadToCloudinary = (buffer, mimetype, options = {}) => {
  const cld = getCloudinary();

  if (!buffer || buffer.length === 0) {
    return Promise.reject(new Error('Validation failed: File buffer is missing or 0 bytes.'));
  }
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    return Promise.reject(new Error(`Validation failed: Unsupported mime type config - ${mimetype}.`));
  }

  const resource_type =
    options.resource_type === 'auto' || !options.resource_type
      ? resolveResourceType(mimetype)
      : options.resource_type;

  // Build safe options and avoid unsafe params
  const safeOptions = {
    ...options,
    resource_type,
  };
  
  delete safeOptions.type;
  delete safeOptions.access_mode;
  delete safeOptions.moderation;

  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      safeOptions,
      (error, result) => {
        if (error) {
          console.error('[cloudinary] Upload error — HTTP', error.http_code, '|', error.message);
          return reject(error);
        }
        resolve(result);
      }
    );

    stream.on('error', (streamError) => {
      console.error('[cloudinary] Stream error:', streamError.message);
      reject(streamError);
    });

    Readable.from(buffer).pipe(stream);
  });
};

export default upload;
