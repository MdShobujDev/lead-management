import { Logger } from '@nestjs/common';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createInterface } from 'readline';

const logger = new Logger('FileStorage');

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;

  if (typeof err === 'object' && err !== null) {
    if ('message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (message !== undefined) {
        try {
          return JSON.stringify(message);
        } catch {
          return typeof message === 'string'
            ? message
            : Object.prototype.toString.call(message);
        }
      }
    }

    try {
      return JSON.stringify(err);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }

  return typeof err === 'string' ? err : String(err);
}

/**
 * Count lines in a file without loading it into memory.
 */
export async function countFileLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lines = 0;
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', () => {
      lines++;
    });
    rl.on('close', () => {
      resolve(lines);
    });
    rl.on('error', reject);
  });
}

/**
 * Safely delete a file. Never throws.
 */
export async function safeUnlink(
  filePath: string | null | undefined,
): Promise<void> {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
    logger.debug(`Deleted file: ${filePath}`);
  } catch (err: unknown) {
    const code = getErrorCode(err);
    if (code !== 'ENOENT') {
      logger.warn(`Failed to delete file ${filePath}: ${getErrorMessage(err)}`);
    }
  }
}

/**
 * Ensure a directory exists.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Clean old files from a directory based on retention hours.
 */
export async function cleanupOldFiles(
  dir: string,
  retentionHours: number,
): Promise<number> {
  let deleted = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(fullPath);
          deleted++;
        }
      } catch {
        // ignore individual file errors
      }
    }
  } catch (err: unknown) {
    if (getErrorCode(err) !== 'ENOENT') {
      logger.warn(`Cleanup failed for ${dir}: ${getErrorMessage(err)}`);
    }
  }
  return deleted;
}
