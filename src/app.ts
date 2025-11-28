import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import session from 'express-session';
import connectMySQL from 'express-mysql-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import mysql, { PoolOptions } from 'mysql2/promise';
import routes from './routes';
import { env } from './config/env';
import { ensureInvoiceDir } from './utils/pdf';

const MySQLStore = connectMySQL(session);

const createSessionPool = () => {
  const url = new URL(env.DATABASE_URL);

  const baseConfig: PoolOptions = {
    host: url.hostname,
    port: Number(url.port || '4000'),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '')
  };

  const isTiDB = url.hostname.includes('tidbcloud.com') || url.searchParams.get('sslaccept') === 'strict';

  const poolConfig: PoolOptions = isTiDB
    ? {
        ...baseConfig,
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true
        }
      }
    : baseConfig;

  return mysql.createPool(poolConfig);
};

// Pool de sesiones con TLS para TiDB
const sessionPool = createSessionPool();

// Cast a any para evitar el error de tipos de TS; en runtime funciona bien
const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    createDatabaseTable: true,
    schema: {
      tableName: 'user_sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  },
  sessionPool as any
);

export const createApp = async (): Promise<express.Application> => {
  await ensureInvoiceDir();
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );

  app.use(compression());

  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 150,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(
    session({
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );

  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/invoices', express.static(path.join(process.cwd(), 'storage', 'invoices')));

  app.use('/api', routes);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Error inesperado', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Ocurrió un error inesperado.' });
      }
    }
  );

  return app;
};
