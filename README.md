# Generador de Carruseles de Instagram con OpenAI (MVP)

Aplicación web simple para crear carruseles en español:

1. Crea un proyecto (tema, audiencia, tono, número de slides).
2. Genera el outline de slides automáticamente.
3. Renderiza imágenes por slide con OpenAI.
4. Compone cada slide en formato Instagram `1080x1350`.
5. Exporta el carrusel final como ZIP.

## Requisitos

- Node.js 20+
- Variable `OPENAI_API_KEY`

## Instalación

```bash
cp .env.example .env
npm install
npm run dev
```

## Uso

Abre `http://localhost:3000` y ejecuta:

1. **Crear proyecto**
2. **Generar outline**
3. **Renderizar todo**
4. **Descargar ZIP**

## Endpoints principales

- `POST /api/projects`
- `POST /api/projects/:id/outline`
- `POST /api/projects/:id/render`
- `POST /api/projects/:id/slides/:n/regenerate`
- `GET /api/projects/:id/export`

## Nota

Este MVP guarda todo en local dentro de la carpeta `data/`.
