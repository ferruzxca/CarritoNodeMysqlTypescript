import { createApp } from './app';
import { env } from './config/env';

const port = Number(process.env.PORT ?? 3000);

createApp()
  .then((app) => {
    app.listen(port, () => {
      console.log(`Servidor neon escuchando en http://localhost:${port} en modo ${env.NODE_ENV}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo iniciar la aplicación', error);
    process.exit(1);
  });
