import type { Request, RequestHandler } from 'express';

interface CorsOptions {
  origin?: string | RegExp | Array<string | RegExp> | boolean;
  credentials?: boolean;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  maxAge?: number;
}

type CorsOptionsDelegate = (req: Request, callback: (err: Error | null, options?: CorsOptions) => void) => void;

declare function cors(options?: CorsOptions | CorsOptionsDelegate): RequestHandler;

declare namespace cors {
  export type CorsOptions = import('./index').CorsOptions;
  export type CorsOptionsDelegate = import('./index').CorsOptionsDelegate;
}

export = cors;
