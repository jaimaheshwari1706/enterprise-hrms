const multer = require('multer');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

// Files are held in memory (never written to disk) and streamed straight
// to Cloudinary. Basic type/size validation happens at the multer layer so
// bad uploads are rejected before we ever touch Cloudinary.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, 'Only JPG, PNG, or WEBP images are allowed'));
    }
    cb(null, true);
  },
});

// Uploads a single in-memory file buffer to Cloudinary under the given
// folder, returning the secure URL. If Cloudinary isn't configured (no
// keys in .env), we throw a clear error rather than failing silently —
// callers can catch this and skip the image field if they want.
function uploadBufferToCloudinary(buffer, folder) {
  if (!isConfigured) {
    throw new ApiError(503, 'Image upload is not configured on this server (Cloudinary keys missing)');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

module.exports = { upload, uploadBufferToCloudinary };
