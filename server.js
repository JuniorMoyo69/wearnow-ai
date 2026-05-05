require('dotenv').config();
const express   = require('express');
const multer    = require('multer');
const https     = require('https');
const http      = require('http');
const cors      = require('cors');
const session   = require('express-session');
const { v2: cloudinary } = require('cloudinary');
const Replicate = require('replicate');
const db        = require('./db');

// ── Cloudinary config ─────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Init DB tables then start server ──────────
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n✨ WearNow.ai running at http://localhost:${PORT}`);
      console.log(`🤖 AI generation: ${process.env.REPLICATE_API_KEY ? 'ENABLED' : 'DISABLED — add REPLICATE_API_KEY to .env'}\n`);
    });
  })
  .catch(err => {
    console.error('Database init failed:', err.message);
    process.exit(1);
  });

// ── Middleware ────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret:            process.env.SESSION_SECRET || 'wearnowai-dev-secret-change-in-production',
  resave:            false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    maxAge:   30 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production'
  }
}));
app.use(express.static('public'));

// ── Multer (memory — files go straight to Cloudinary) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ── Replicate client ──────────────────────────
const replicate = process.env.REPLICATE_API_KEY
  ? new Replicate({ auth: process.env.REPLICATE_API_KEY })
  : null;

// ── Cloudinary upload helper ──────────────────
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'wearnow', ...options },
      (err, result) => err ? reject(err) : resolve(result)
    ).end(buffer);
  });
}

// ── Map DB row → frontend shape ───────────────
function toEntry(row) {
  return {
    id:             row.id,
    userName:       row.user_name,
    userPhoto:      row.user_photo,
    clothingPhoto:  row.clothing_photo,
    generatedImage: row.generated_image,
    timestamp:      row.timestamp,
    aiEnabled:      row.ai_enabled
  };
}

// ── HISTORY (per session) ─────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const rows = await db.getUserHistory(req.session.id);
    res.json(rows.map(toEntry));
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// ── GENERATE ─────────────────────────────────
app.post('/api/generate', upload.fields([
  { name: 'clothingPhoto', maxCount: 1 },
  { name: 'userPhoto',     maxCount: 1 }
]), async (req, res) => {
  try {
    const clothingFile = req.files?.clothingPhoto?.[0];
    const userFile     = req.files?.userPhoto?.[0];
    const userName     = (req.body.userName || 'Anonymous').trim();

    if (!clothingFile) return res.status(400).json({ error: 'Clothing photo is required' });
    if (!userFile)     return res.status(400).json({ error: 'Your photo is required' });

    const [userUpload, clothingUpload] = await Promise.all([
      uploadToCloudinary(userFile.buffer, {
        format: 'jpg',
        transformation: [{ width: 1024, height: 1024, crop: 'limit' }]
      }),
      uploadToCloudinary(clothingFile.buffer, {
        format: 'jpg',
        transformation: [{ width: 1024, height: 1024, crop: 'pad', background: 'white' }]
      })
    ]);

    if (!replicate) {
      const row = await db.createGalleryEntry({
        sessionId:      req.session.id,
        userName,
        userPhoto:      userUpload.secure_url,
        clothingPhoto:  clothingUpload.secure_url,
        generatedImage: null,
        aiEnabled:      false
      });
      return res.json({ success: true, entry: toEntry(row), message: 'Add REPLICATE_API_KEY to .env to enable AI generation.' });
    }

    const output = await replicate.run(
      'cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
      {
        input: {
          human_img:       userUpload.secure_url,
          garm_img:        clothingUpload.secure_url,
          garment_des:     'clothing item',
          is_checked:      true,
          is_checked_crop: false,
          denoise_steps:   35,
          seed:            42
        }
      }
    );

    const firstOutput = Array.isArray(output) ? output[0] : output;
    let genBuffer;

    if (firstOutput && typeof firstOutput.blob === 'function') {
      const blob = await firstOutput.blob();
      genBuffer  = Buffer.from(await blob.arrayBuffer());
    } else {
      const url = typeof firstOutput === 'string' ? firstOutput
        : (typeof firstOutput?.url === 'function' ? String(await firstOutput.url()) : String(firstOutput));
      genBuffer = await downloadToBuffer(url);
    }

    const genUpload = await uploadToCloudinary(genBuffer);

    const row = await db.createGalleryEntry({
      sessionId:      req.session.id,
      userName,
      userPhoto:      userUpload.secure_url,
      clothingPhoto:  clothingUpload.secure_url,
      generatedImage: genUpload.secure_url,
      aiEnabled:      true
    });

    res.json({ success: true, entry: toEntry(row), message: 'Virtual try-on generated!' });

  } catch (err) {
    console.error('Generate error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Generation failed' });
  }
});

// ── Helper ────────────────────────────────────
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const chunks   = [];
    protocol.get(url, res => {
      res.on('data', chunk => chunks.push(chunk));
      res.on('end',  ()    => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
