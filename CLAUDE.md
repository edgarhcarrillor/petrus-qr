@AGENTS.md

# Petrus QR — notas para Claude

- Ver README.md para arquitectura y puesta en marcha.
- `/q/<slug>` es la URL impresa en los QR: su forma NUNCA debe cambiar.
- El PDF original nunca debe llegar al visor público: solo imágenes de página firmadas (src/lib/public-qr.ts).
- Cache Components está activo: lecturas de cookies/params van dentro de <Suspense>. Validar con `npm run build`.
- SQL en supabase/migrations se ejecuta a mano en el SQL Editor de Supabase.
