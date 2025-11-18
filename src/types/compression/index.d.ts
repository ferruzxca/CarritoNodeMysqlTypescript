import type { RequestHandler } from 'express';

interface CompressionOptions {
  level?: number;
  threshold?: number | string;
}

declare function compression(options?: CompressionOptions): RequestHandler;

export = compression;
