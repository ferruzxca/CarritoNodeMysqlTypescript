import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import session from 'express-session';
import connectMySQL from 'express-mysql-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { ensureInvoiceDir } from './utils/pdf';

const MySQLStore = connectMySQL(session);

interface SessionStoreConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: {
    minVersion?: string;
    rejectUnauthorized?: boolean;
  };
}

const parseDatabaseUrl = (): SessionStoreConnectionOptions => {
  const url = new URL(env.DATABASE_URL);

  const options: SessionStoreConnectionOptions = {
    host: url.hostname,
    port: Number(url.port || '3306'),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '')
  };

  // Forzar TLS cuando usamos TiDB Cloud o sslaccept=strict
  const isTiDB = url.hostname.endsWith('tidbcloud.com');
  const sslAccept = url.searchParams.get('sslaccept');

  if (isTiDB || sslAccept === 'strict') {
    options.ssl = {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    };
  }

  return options;
};

const sessionStore = new MySQLStore({
  ...parseDatabaseUrl(),
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
});

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
      res.status(500).json({ message: 'Ocurrió un error inesperado.' });
    }
  );

  return app;
};
