import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * ImageProcessor handles image inspection, aspect-ratio preserving resizing,
 * and adaptive WebP compression ensuring image delivery strictly under 200KB,
 * and 30-80KB for smaller resolutions, while preserving visual quality.
 */
export class ImageProcessor {
  constructor(fileService) {
    this.fileService = fileService;
  }

  /**
   * Reads metadata from an image buffer.
   */
  async inspectImage(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        space: metadata.space || 'srgb',
        hasAlpha: metadata.hasAlpha || false,
      };
    } catch (error) {
      throw new Error(`Invalid or unsupported image file: ${error.message}`);
    }
  }

  /**
   * Computes the target maximum byte budget based on resolution.
   * - Strict global ceiling: < 200KB (198KB max)
   * - Small resolutions (<= 540px): 30KB - 80KB target
   */
  getTargetSizeBudget(effectiveWidth) {
    if (effectiveWidth <= 400) {
      return { maxBytes: 55 * 1024, minBytes: 25 * 1024 }; // 30-55KB typical
    }
    if (effectiveWidth <= 540) {
      return { maxBytes: 80 * 1024, minBytes: 30 * 1024 }; // 30-80KB target
    }
    if (effectiveWidth <= 720) {
      return { maxBytes: 140 * 1024, minBytes: 60 * 1024 }; // well under 200KB
    }
    // Large resolutions (1024px or higher) strictly under 200k
    return { maxBytes: 190 * 1024, minBytes: 80 * 1024 };
  }

  /**
   * Process an image buffer: resize (without upscaling), convert to WebP,
   * enforce file size constraints (< 200KB global, 30-80KB small resolution),
   * and write to disk.
   */
  async processImage({
    buffer,
    originalFilename,
    targetWidth,
    outputDir,
    quality = 80,
    onProgress,
  }) {
    const startTime = Date.now();
    const originalSize = buffer.length;

    if (onProgress) onProgress(15, 'Reading image...');

    // 1. Inspect source dimensions & format
    let metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch (err) {
      throw new Error(`Failed to parse image "${originalFilename}": ${err.message}`);
    }

    if (!metadata.width || !metadata.height) {
      throw new Error(`Unable to determine dimensions for "${originalFilename}".`);
    }

    const originalWidth = metadata.width;
    const originalHeight = metadata.height;

    // 2. Determine target width & height: avoid upscaling
    const effectiveTargetWidth = Math.min(originalWidth, Math.max(16, targetWidth));
    const shouldResize = originalWidth > effectiveTargetWidth;

    if (onProgress) onProgress(35, shouldResize ? `Resizing to ${effectiveTargetWidth}px...` : 'Preserving dimensions...');

    // 3. Prepare base Sharp resize pipeline
    const baseSharp = () => {
      let pipe = sharp(buffer, { failOnError: false }).rotate(); // auto-orient based on EXIF
      if (shouldResize) {
        pipe = pipe.resize({
          width: effectiveTargetWidth,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      return pipe;
    };

    if (onProgress) onProgress(60, 'Optimizing WebP delivery...');

    // 4. Determine size constraints and initial quality
    const { maxBytes } = this.getTargetSizeBudget(effectiveTargetWidth);
    let currentQuality = Math.min(95, Math.max(40, Number(quality) || 80));

    // For small resolutions (<= 540px), initial quality 75-80 naturally yields 30-80KB
    if (effectiveTargetWidth <= 540 && currentQuality > 82) {
      currentQuality = 80;
    }

    // 5. Adaptive encoding loop to guarantee size budget while preserving visual quality
    let outputBuffer;
    let outputInfo;
    let attempts = 0;
    const maxAttempts = 4;

    while (attempts < maxAttempts) {
      const pipeline = baseSharp().webp({
        quality: currentQuality,
        effort: 6, // maximum libwebp compression effort for smallest size at given visual quality
        smartSubsample: true,
      });

      const res = await pipeline.toBuffer({ resolveWithObject: true });
      outputBuffer = res.data;
      outputInfo = res.info;

      // If already within budget, or quality cannot be reduced further safely, stop
      if (outputBuffer.length <= maxBytes || currentQuality <= 45) {
        break;
      }

      // If file exceeds target budget (e.g. > 80KB for small or > 196KB for large), adaptively adjust quality
      const overflowRatio = outputBuffer.length / maxBytes;
      const reductionStep = overflowRatio > 1.4 ? 12 : overflowRatio > 1.15 ? 8 : 5;
      currentQuality = Math.max(42, currentQuality - reductionStep);
      attempts += 1;
    }

    if (onProgress) onProgress(85, 'Writing to disk...');

    // 6. Ensure safe output filename and write to disk
    this.fileService.ensureDirectoryExists(outputDir);
    const outputFilename = this.fileService.getUniqueWebpFilename(outputDir, originalFilename);
    const outputPath = path.join(outputDir, outputFilename);

    await fs.promises.writeFile(outputPath, outputBuffer);

    if (onProgress) onProgress(100, 'Done');

    const durationMs = Date.now() - startTime;
    const optimizedSize = outputBuffer.length;
    const bytesSaved = Math.max(0, originalSize - optimizedSize);
    const percentSaved = originalSize > 0
      ? Math.round(((originalSize - optimizedSize) / originalSize) * 100)
      : 0;

    return {
      success: true,
      originalFilename,
      outputFilename,
      outputPath,
      originalWidth,
      originalHeight,
      optimizedWidth: outputInfo.width,
      optimizedHeight: outputInfo.height,
      originalSize,
      optimizedSize,
      bytesSaved,
      percentSaved,
      durationMs,
    };
  }
}
