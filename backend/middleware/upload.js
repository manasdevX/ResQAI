import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf',
];

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'resqai_incidents',
    resource_type: 'auto',
    // Use the original filename (sanitized) as public_id
    public_id: `${Date.now()}_${file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '')}`,
  }),
});

/** Reject files with wrong mime type */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Unsupported file type: ${file.mimetype}. Allowed: images, videos, PDF.`),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 5,                   // max 5 files per request
  },
});

// Single-image avatar upload (2 MB, images only, stored in resqai_avatars/)
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req) => ({
    folder:        'resqai_avatars',
    resource_type: 'image',
    public_id:     `avatar_${req.user._id}_${Date.now()}`,
    transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face', quality: 'auto' }],
  }),
});

export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for avatars'), false);
  },
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

export default upload;
