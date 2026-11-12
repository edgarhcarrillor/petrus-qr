# Petrus QR

QR dinámicos de Petrus Tech: **el QR impreso no cambia, el contenido sí.**

Cada QR apunta a una URL fija y corta (`https://<dominio>/q/AB12cd3`). Desde el panel se
publica lo que muestra: planos en PDF, una imagen, un link o un texto, y se puede cambiar
cuando quieras sin reimprimir el QR.

## Cómo funciona

| Ruta | Qué hace |
|---|---|
| `/q/<slug>` | **Va dentro del QR.** Registra el escaneo y redirige: a la URL si el contenido es un link, o al visor en cualquier otro caso. Respuesta 302 sin caché. |
| `/v/<slug>` | Visor público (sin login). Planos con zoom, una página a la vez. Es el link que se comparte. |
| `/admin` | Panel (requiere login): crear QR, publicar contenido, historial, estadísticas, descargar QR en PNG/SVG. |
| `/login` | Acceso al panel. |

### Protección de planos (ver sí, descargar no)

1. Al publicar un PDF, **el navegador del admin** convierte cada página en una imagen (~300 dpi, máx. 4096 px) con **marca de agua**.
2. El visor recibe **solo esas imágenes**, mediante URLs firmadas que vencen en 10 minutos. El PDF original queda en un bucket privado y solo el admin lo puede descargar.
3. Sin botón de descarga, sin clic derecho, sin arrastrar y sin menú de toque largo en iOS.

> Un pantallazo siempre es posible. La marca de agua sirve justamente para identificar de dónde salió la copia.

## Stack

- Next.js 16 (App Router, Cache Components) + React 19 + Tailwind v4
- Supabase: Postgres + RLS, Auth y Storage privado
- Vercel (deploy en cada push a `main`)
- `pdfjs-dist` (convierte el PDF en el navegador), `qrcode` y `react-zoom-pan-pinch`

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com), región **São Paulo** (la más cercana a Chile).
2. En **SQL Editor**, pega y ejecuta [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Crea las tablas, las políticas RLS y el bucket privado `qr-files`.
3. En **Authentication → Sign In / Providers**, desactiva **"Allow new users to sign up"**: el panel es solo tuyo.
4. En **Authentication → Users → Add user**, crea tu usuario (correo y contraseña) y marca *Auto Confirm*.
5. En **Project Settings → API**, copia la URL, la `anon key` y la `service_role key`.

### 2. Local

```bash
cp .env.example .env.local   # y completa los valores
npm install
npm run dev                  # http://localhost:3000
```

### 3. Vercel

1. **Add New → Project** → importa el repo de GitHub.
2. Carga las mismas variables de `.env.example` en *Environment Variables*.
3. Deploy. Desde ahí, cada push a `main` se publica solo.

### 4. Dominio definitivo

Cuando el dominio esté **Activo** en NIC Chile:

1. Agrégalo a Cloudflare y cambia sus DNS en NIC Chile a los nameservers que te indique Cloudflare.
2. En Vercel → *Settings → Domains*, agrega `qr.petrustech.cl` (o el que elijas).
3. En Cloudflare → DNS, crea `CNAME qr → cname.vercel-dns.com` con **proxy desactivado (nube gris)**.
4. En Vercel, define `NEXT_PUBLIC_QR_BASE_URL=https://qr.petrustech.cl` y vuelve a desplegar.

⚠️ **No imprimas QR definitivos antes del paso 4.** El panel muestra una advertencia mientras el dominio sea provisorio (`localhost` o `*.vercel.app`).

## Modelo de datos

- `qr_codes`: un QR. El `slug` nunca cambia. `current_version_id` apunta al contenido que se muestra hoy.
- `qr_versions`: historial de contenidos (se puede volver a cualquiera).
- `qr_scans`: escaneos (fecha, país vía Vercel y user-agent).

Todas las tablas tienen `owner_id` y RLS por dueño, así que la base ya está preparada para
convertirse en un producto con varios clientes. El visor público lee con la *service role*
solo desde el servidor.

Archivos en Storage: `qr-files/<owner_id>/<qr_id>/<version_id>/{original.pdf, p001.webp, …}`.

## Scripts

| | |
|---|---|
| `npm run dev` | desarrollo |
| `npm run build` | build de producción |
| `npm run lint` / `npm run typecheck` | calidad |
| `postinstall` | copia el worker de pdf.js a `public/` |
