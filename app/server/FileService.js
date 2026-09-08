import fs from 'fs';
import path from 'path';

/**
 * FileService manages safe filesystem operations, directory creation,
 * filename sanitization, and collision avoidance for optimized images.
 */
export class FileService {
  constructor(baseDir = process.cwd()) {
    this.baseDir = path.resolve(baseDir);
    this.defaultOutputDir = path.resolve(this.baseDir, 'images');
    this.ensureDirectoryExists(this.defaultOutputDir);
  }

  /**
   * Resolves and validates an output directory path to ensure safety.
   * Disallows path traversal outside of safe boundaries.
   */
  resolveSafeOutputDir(requestedDir = './images') {
    if (!requestedDir || typeof requestedDir !== 'string') {
      return this.defaultOutputDir;
    }

    // Normalize and resolve path relative to base directory
    const resolved = path.isAbsolute(requestedDir)
      ? path.resolve(requestedDir)
      : path.resolve(this.baseDir, requestedDir);

    // Prevent escaping to sensitive system root
    const rootRelative = path.relative(this.baseDir, resolved);
    if (rootRelative.startsWith('..') && !resolved.startsWith(this.baseDir)) {
      // If user attempted to navigate outside project root, clamp to default or project subfolder
      return this.defaultOutputDir;
    }

    return resolved;
  }

  /**
   * Ensures the target directory exists, creating recursively if missing.
   */
  ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to create or access directory "${dirPath}": ${error.message}`);
    }
  }

  /**
   * Sanitizes a file base name by removing dangerous characters and path traversal.
   */
  sanitizeBaseName(filename) {
    if (!filename) return 'image';
    const parsed = path.parse(filename);
    // Replace characters that are invalid across OS or dangerous
    const safe = parsed.name
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    return safe || 'image';
  }

  /**
   * Generates a collision-safe .webp filename.
   * If photo.webp exists, it generates photo-1.webp, photo-2.webp, etc.
   */
  getUniqueWebpFilename(outputDir, originalFilename) {
    const baseName = this.sanitizeBaseName(originalFilename);
    const targetExtension = '.webp';
    let candidateName = `${baseName}${targetExtension}`;
    let counter = 1;

    while (fs.existsSync(path.join(outputDir, candidateName))) {
      candidateName = `${baseName}-${counter}${targetExtension}`;
      counter += 1;
    }

    return candidateName;
  }

  /**
   * Lists all generated .webp files in the specified output directory.
   */
  listOutputFiles(outputDir = this.defaultOutputDir) {
    this.ensureDirectoryExists(outputDir);
    const files = fs.readdirSync(outputDir);
    const webpFiles = [];

    for (const file of files) {
      if (file.toLowerCase().endsWith('.webp')) {
        const filePath = path.join(outputDir, file);
        try {
          const stats = fs.statSync(filePath);
          webpFiles.push({
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime || stats.ctime,
            modifiedAt: stats.mtime,
          });
        } catch {
          // ignore transient stat errors
        }
      }
    }

    // Sort newest first
    return webpFiles.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  /**
   * Resolves a safe file path for downloading/viewing from the output directory.
   */
  getSafeFilePath(outputDir, filename) {
    const sanitized = path.basename(filename);
    const fullPath = path.join(outputDir, sanitized);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fullPath;
  }
}
