# Cyberpunk Neon Market

Aplicación web de e-commerce futurista creada con Node.js, TypeScript y MySQL. Incluye catálogo filtrable, carrito persistente, checkout protegido por sesión, generación y envío de facturas en PDF, panel administrativo con métricas y un frontend con estética cyberpunk.

## Características principales

- **Seguridad reforzada**: sesiones persistentes con `express-session` y almacenamiento en MySQL, contraseñas con hash `bcryptjs`, validación estricta con Zod y middlewares de seguridad (`helmet`, rate limiting, CORS).
- **Autenticación contextual**: el usuario puede navegar sin iniciar sesión y únicamente se solicita login al momento de pagar. Incluye roles `CUSTOMER`, `VENDOR` y `SUPERADMIN`.
- **Gestión de contenido**: súper usuario puede crear productos, promociones, publicaciones de blog y monitorear ventas. Vendedores tienen acceso restringido para gestionar su catálogo.
- **Experiencia de compra completa**: carrito holográfico con persistencia por sesión, filtrado avanzado, buscador con autocompletado, reseñas y comentarios de productos.
- **Checkout profesional**: crea órdenes, genera factura PDF con estilo neon y la envía por correo electrónico al cliente usando Nodemailer.
- **Dashboard visual**: API que expone métricas de ventas y productos más vendidos para graficarlas en el frontend.
- **Frontend Cyberpunk**: interfaz en HTML, CSS y TypeScript compilado, con animaciones neon, paleta rosa/azul metálico y componentes interactivos.

## Requisitos previos

- Node.js >= 18
- MySQL 8 o compatible

## Configuración

1. Clona el repositorio e instala dependencias:

   ```bash
   npm install
   ```

2. Copia el archivo de variables de entorno y ajusta valores:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` debe apuntar a tu instancia de MySQL.
   - Configura las credenciales SMTP para el envío de facturas.

3. Genera el cliente de Prisma y ejecuta las migraciones/seed (crea la base de datos si no existe):

   ```bash
   npx prisma migrate dev
   ```

4. (Opcional) Crea datos de prueba usando Prisma Studio:

   ```bash
   npx prisma studio
   ```

## Scripts disponibles

| Comando             | Descripción                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `npm run dev`       | Ejecuta `prisma generate` automáticamente e inicia el servidor Express en modo desarrollo con recarga automática. |
| `npm run build`     | Compila el backend TypeScript a `dist/` y el frontend a `public/dist`.      |
| `npm start`         | Ejecuta la versión compilada.                                               |
| `npm run prisma`    | Proxy para comandos de Prisma (`npm run prisma migrate deploy`, etc.).      |

## Arquitectura

- **Backend**: Express + Prisma. La carpeta `src/` contiene configuración, rutas, controladores y utilidades.
- **Frontend**: Archivos estáticos en `public/` con TypeScript compilado (`public/scripts/main.ts -> public/dist/main.js`).
- **Base de datos**: Esquema definido en `prisma/schema.prisma` con entidades para usuarios, sesiones, productos, promociones, carrito, órdenes, facturas y blog.
- **Facturas**: Se generan en `storage/invoices` y se sirven de manera segura desde `/invoices`.

## Roles y permisos

- `SUPERADMIN`: acceso completo a gestión de productos, promociones, blog y dashboard.
- `VENDOR`: puede crear y actualizar únicamente sus productos.
- `CUSTOMER`: puede navegar, agregar al carrito, dejar reseñas y pagar.

## Notas de seguridad

- El secreto de sesión **debe** tener al menos 32 caracteres aleatorios.
- Activa HTTPS en producción para que las cookies de sesión se envíen con el flag `secure`.
- Las contraseñas se almacenan con hash `bcrypt` usando 12 rondas de sal.
- El límite de peticiones (`express-rate-limit`) ayuda a mitigar ataques de fuerza bruta.

## Diseño Cyberpunk

El frontend utiliza animaciones neon, tipografías futuristas y gradientes holográficos. Las secciones incluyen catálogo, carrito, reseñas, blog y dashboard con gráficas dibujadas en canvas.

## Próximos pasos sugeridos

- Integrar pasarelas de pago reales (Stripe, OpenPay, etc.).
- Añadir WebSockets para actualizar inventario en tiempo real.
- Crear tests E2E para validar flujos críticos.

¡Bienvenido a la experiencia de compra del año 2088! 🚀
