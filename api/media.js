// api/media.js
const express = require('express');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Set FFmpeg path
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || '/usr/bin/ffmpeg');

// Rate limiting for media API
const mediaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many media processing requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

router.use(mediaLimiter);

// Helper functions
const createOutputPath = (filename) => {
  const outputDir = path.join(__dirname, '../output');
  return path.join(outputDir, filename);
};

const cleanupFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.log(`⚠️  Could not cleanup file: ${filePath}`);
  }
};

const getMediaInfo = async (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata);
      }
    });
  });
};

// Image processing with Sharp
class ImageProcessor {
  static async processImage(inputPath, options = {}) {
    const {
      width,
      height,
      quality = 80,
      format = 'jpeg',
      watermark,
      blur,
      brightness,
      contrast,
      saturation,
      rotate
    } = options;

    let pipeline = sharp(inputPath);

    // Resize
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Rotate
    if (rotate) {
      pipeline = pipeline.rotate(rotate);
    }

    // Image adjustments
    if (brightness !== undefined || contrast !== undefined || saturation !== undefined) {
      pipeline = pipeline.modulate({
        brightness: brightness,
        contrast: contrast,
        saturation: saturation
      });
    }

    // Blur
    if (blur) {
      pipeline = pipeline.blur(blur);
    }

    // Format and quality
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    }

    const outputPath = createOutputPath(`processed_${uuidv4()}.${format}`);
    await pipeline.toFile(outputPath);

    // Add watermark if specified
    if (watermark) {
      await ImageProcessor.addWatermark(outputPath, watermark);
    }

    return outputPath;
  }

  static async addWatermark(imagePath, watermarkOptions) {
    const {
      text,
      position = 'bottom-right',
      opacity = 0.7,
      fontSize = 32,
      color = 'white'
    } = watermarkOptions;

    const image = sharp(imagePath);
    const { width, height } = await image.metadata();

    // Create text watermark
    const watermarkBuffer = Buffer.from(
      `<svg width="${width}" height="${height}">
        <text x="${this.getWatermarkPosition(position, width, height).x}" 
              y="${this.getWatermarkPosition(position, width, height).y}" 
              font-family="Arial" 
              font-size="${fontSize}" 
              fill="${color}" 
              opacity="${opacity}">${text}</text>
      </svg>`
    );

    await image
      .composite([{ input: watermarkBuffer, top: 0, left: 0 }])
      .toFile(imagePath);
  }

  static getWatermarkPosition(position, width, height) {
    const positions = {
      'top-left': { x: 20, y: 40 },
      'top-right': { x: width - 200, y: 40 },
      'bottom-left': { x: 20, y: height - 20 },
      'bottom-right': { x: width - 200, y: height - 20 },
      'center': { x: width / 2, y: height / 2 }
    };
    return positions[position] || positions['bottom-right'];
  }

  static async optimize(inputPath, options = {}) {
    const { quality = 80, format = 'jpeg' } = options;
    const outputPath = createOutputPath(`optimized_${uuidv4()}.${format}`);

    let pipeline = sharp(inputPath);

    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality, effort: 6 });
    }

    await pipeline.toFile(outputPath);
    return outputPath;
  }
}

// Video processing with FFmpeg
class VideoProcessor {
  static async processVideo(inputPath, options = {}) {
    const {
      width,
      height,
      bitrate = '1000k',
      codec = 'libx264',
      format = 'mp4',
      startTime,
      duration,
      fps,
      watermark
    } = options;

    const outputPath = createOutputPath(`processed_${uuidv4()}.${format}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Video codec and bitrate
      command = command.videoCodec(codec).videoBitrate(bitrate);

      // Resize
      if (width && height) {
        command = command.size(`${width}x${height}`);
      }

      // FPS
      if (fps) {
        command = command.fps(fps);
      }

      // Trim video
      if (startTime) {
        command = command.seekInput(startTime);
      }
      if (duration) {
        command = command.duration(duration);
      }

      // Add watermark
      if (watermark && watermark.text) {
        const watermarkFilter = `drawtext=text='${watermark.text}':fontcolor=${watermark.color || 'white'}:fontsize=${watermark.fontSize || 24}:x=${watermark.x || 10}:y=${watermark.y || 10}`;
        command = command.videoFilters(watermarkFilter);
      }

      command
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Video processing completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Video processing error:', err);
          reject(err);
        })
        .on('progress', (progress) => {
          console.log(`🎬 Processing: ${progress.percent}% done`);
        })
        .run();
    });
  }

  static async convertFormat(inputPath, outputFormat) {
    const outputPath = createOutputPath(`converted_${uuidv4()}.${outputFormat}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Video conversion completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Video conversion error:', err);
          reject(err);
        })
        .run();
    });
  }

  static async extractAudio(inputPath, outputFormat = 'mp3') {
    const outputPath = createOutputPath(`audio_${uuidv4()}.${outputFormat}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('mp3')
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Audio extraction completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Audio extraction error:', err);
          reject(err);
        })
        .run();
    });
  }

  static async createThumbnail(inputPath, timemarks = ['00:00:01']) {
    const outputPath = createOutputPath(`thumbnail_${uuidv4()}.jpg`);
    const outputDir = path.dirname(outputPath);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: timemarks,
          filename: path.basename(outputPath),
          folder: outputDir,
          size: '320x240'
        })
        .on('end', () => {
          console.log('✅ Thumbnail creation completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Thumbnail creation error:', err);
          reject(err);
        });
    });
  }

  static async compressVideo(inputPath, options = {}) {
    const {
      crf = 28, // Constant Rate Factor (lower = better quality)
      preset = 'medium',
      format = 'mp4'
    } = options;

    const outputPath = createOutputPath(`compressed_${uuidv4()}.${format}`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .addOption('-crf', crf)
        .addOption('-preset', preset)
        .output(outputPath)
        .on('end', () => {
          console.log('✅ Video compression completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ Video compression error:', err);
          reject(err);
        })
        .run();
    });
  }
}

// Routes

// Get media file information
router.get('/info', async (req, res) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'File parameter is required' });
    }

    const filePath = path.join(__dirname, '../uploads', file);
    
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    const info = await getMediaInfo(filePath);
    
    res.json({
      success: true,
      file: file,
      info: info
    });

  } catch (error) {
    console.error('❌ Error getting media info:', error);
    res.status(500).json({ error: 'Failed to get media information' });
  }
});

// Process images
router.post('/process', async (req, res) => {
  try {
    const files = req.files;
    const options = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of files) {
      try {
        let outputPath;
        
        if (file.mimetype.startsWith('image/')) {
          outputPath = await ImageProcessor.processImage(file.path, {
            width: options.width ? parseInt(options.width) : undefined,
            height: options.height ? parseInt(options.height) : undefined,
            quality: options.quality ? parseInt(options.quality) : 80,
            format: options.format || 'jpeg',
            watermark: options.watermark ? JSON.parse(options.watermark) : undefined,
            blur: options.blur ? parseFloat(options.blur) : undefined,
            brightness: options.brightness ? parseFloat(options.brightness) : undefined,
            contrast: options.contrast ? parseFloat(options.contrast) : undefined,
            saturation: options.saturation ? parseFloat(options.saturation) : undefined,
            rotate: options.rotate ? parseInt(options.rotate) : undefined
          });
        } else if (file.mimetype.startsWith('video/')) {
          outputPath = await VideoProcessor.processVideo(file.path, {
            width: options.width ? parseInt(options.width) : undefined,
            height: options.height ? parseInt(options.height) : undefined,
            bitrate: options.bitrate || '1000k',
            codec: options.codec || 'libx264',
            format: options.format || 'mp4',
            startTime: options.startTime,
            duration: options.duration,
            fps: options.fps ? parseInt(options.fps) : undefined,
            watermark: options.watermark ? JSON.parse(options.watermark) : undefined
          });
        } else {
          throw new Error('Unsupported file type');
        }

        results.push({
          success: true,
          originalFile: file.originalname,
          outputFile: path.basename(outputPath),
          outputPath: `/output/${path.basename(outputPath)}`,
          size: (await fs.stat(outputPath)).size
        });

        // Cleanup original file
        await cleanupFile(file.path);

      } catch (error) {
        results.push({
          success: false,
          originalFile: file.originalname,
          error: error.message
        });
        await cleanupFile(file.path);
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error processing media:', error);
    res.status(500).json({ error: 'Failed to process media files' });
  }
});

// Add watermark to media
router.post('/watermark', async (req, res) => {
  try {
    const files = req.files;
    const { text, position, opacity, fontSize, color } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Watermark text is required' });
    }

    const results = [];

    for (const file of files) {
      try {
        let outputPath;
        
        if (file.mimetype.startsWith('image/')) {
          outputPath = await ImageProcessor.processImage(file.path, {
            watermark: {
              text,
              position: position || 'bottom-right',
              opacity: opacity ? parseFloat(opacity) : 0.7,
              fontSize: fontSize ? parseInt(fontSize) : 32,
              color: color || 'white'
            }
          });
        } else if (file.mimetype.startsWith('video/')) {
          outputPath = await VideoProcessor.processVideo(file.path, {
            watermark: {
              text,
              color: color || 'white',
              fontSize: fontSize ? parseInt(fontSize) : 24,
              x: position === 'top-left' ? 10 : position === 'top-right' ? 'main_w-text_w-10' : 10,
              y: position === 'top-left' ? 10 : position === 'bottom-left' ? 'main_h-text_h-10' : 10
            }
          });
        } else {
          throw new Error('Unsupported file type');
        }

        results.push({
          success: true,
          originalFile: file.originalname,
          outputFile: path.basename(outputPath),
          outputPath: `/output/${path.basename(outputPath)}`,
          size: (await fs.stat(outputPath)).size
        });

        await cleanupFile(file.path);

      } catch (error) {
        results.push({
          success: false,
          originalFile: file.originalname,
          error: error.message
        });
        await cleanupFile(file.path);
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error adding watermark:', error);
    res.status(500).json({ error: 'Failed to add watermark' });
  }
});

// Convert media format
router.post('/convert', async (req, res) => {
  try {
    const files = req.files;
    const { format } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!format) {
      return res.status(400).json({ error: 'Output format is required' });
    }

    const results = [];

    for (const file of files) {
      try {
        let outputPath;
        
        if (file.mimetype.startsWith('image/')) {
          outputPath = await ImageProcessor.processImage(file.path, { format });
        } else if (file.mimetype.startsWith('video/')) {
          outputPath = await VideoProcessor.convertFormat(file.path, format);
        } else {
          throw new Error('Unsupported file type');
        }

        results.push({
          success: true,
          originalFile: file.originalname,
          outputFile: path.basename(outputPath),
          outputPath: `/output/${path.basename(outputPath)}`,
          size: (await fs.stat(outputPath)).size
        });

        await cleanupFile(file.path);

      } catch (error) {
        results.push({
          success: false,
          originalFile: file.originalname,
          error: error.message
        });
        await cleanupFile(file.path);
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error converting media:', error);
    res.status(500).json({ error: 'Failed to convert media files' });
  }
});

// Optimize media files
router.post('/optimize', async (req, res) => {
  try {
    const files = req.files;
    const { quality, format } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of files) {
      try {
        let outputPath;
        
        if (file.mimetype.startsWith('image/')) {
          outputPath = await ImageProcessor.optimize(file.path, {
            quality: quality ? parseInt(quality) : 80,
            format: format || 'jpeg'
          });
        } else if (file.mimetype.startsWith('video/')) {
          outputPath = await VideoProcessor.compressVideo(file.path, {
            crf: quality ? Math.round((100 - parseInt(quality)) / 100 * 51) : 28,
            format: format || 'mp4'
          });
        } else {
          throw new Error('Unsupported file type');
        }

        const originalSize = (await fs.stat(file.path)).size;
        const optimizedSize = (await fs.stat(outputPath)).size;
        const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

        results.push({
          success: true,
          originalFile: file.originalname,
          outputFile: path.basename(outputPath),
          outputPath: `/output/${path.basename(outputPath)}`,
          originalSize: originalSize,
          optimizedSize: optimizedSize,
          compressionRatio: `${compressionRatio}%`
        });

        await cleanupFile(file.path);

      } catch (error) {
        results.push({
          success: false,
          originalFile: file.originalname,
          error: error.message
        });
        await cleanupFile(file.path);
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error optimizing media:', error);
    res.status(500).json({ error: 'Failed to optimize media files' });
  }
});

// Extract audio from video
router.post('/extract-audio', async (req, res) => {
  try {
    const files = req.files;
    const { format } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of files) {
      try {
        if (!file.mimetype.startsWith('video/')) {
          throw new Error('Only video files are supported for audio extraction');
        }

        const outputPath = await VideoProcessor.extractAudio(file.path, format || 'mp3');

        results.push({
          success: true,
          originalFile: file.originalname,
          outputFile: path.basename(outputPath),
          outputPath: `/output/${path.basename(outputPath)}`,
          size: (await fs.stat(outputPath)).size
        });

        await cleanupFile(file.path);

      } catch (error) {
        results.push({
          success: false,
          originalFile: file.originalname,
          error: error.message
        });
        await cleanupFile(file.path);
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error extracting audio:', error);
    res.status(500).json({ error: 'Failed to extract audio' });
  }
});

// Create thumbnail from video
router.post('/thumbnail', async (req, res) => {
  try {
    const files = req.files;
    const { timestamp } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of files) {
      try {
        if (!file.mimetype.startsWith('video/')) {
          throw new Error('Only video files are supported for thumbnail creation');
        }

        const outputPath = await VideoProcessor.createThumbnail(
          file.path, 
          timestamp ? [timestamp] : ['00:00:01']
        );

        results.push({
          success: true,
          originalFile: file.originalname,
          outputFile: path.basename(outputPath),
          outputPath: `/output/${path.basename(outputPath)}`,
          size: (await fs.stat(outputPath)).size
        });

        await cleanupFile(file.path);

      } catch (error) {
        results.push({
          success: false,
          originalFile: file.originalname,
          error: error.message
        });
        await cleanupFile(file.path);
      }
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Error creating thumbnail:', error);
    res.status(500).json({ error: 'Failed to create thumbnail' });
  }
});

module.exports = router;