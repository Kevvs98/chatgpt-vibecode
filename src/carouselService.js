import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const WIDTH = 1080;
const HEIGHT = 1350;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function createProject(projectId, payload) {
  const project = {
    id: projectId,
    ...payload,
    status: 'draft',
    createdAt: new Date().toISOString(),
    slides: []
  };

  await writeProject(projectId, project);
  return project;
}

export async function getProject(projectId) {
  const filePath = getProjectPath(projectId);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

export async function generateOutline(projectId) {
  const project = await getProject(projectId);

  const prompt = `
Eres un estratega de contenido para Instagram en español.
Devuelve SOLO JSON válido con esta forma exacta:
{
  "slides": [
    {"title": "", "body": "", "visual_intent": ""}
  ]
}

Reglas:
- ${project.slideCount} slides exactos.
- Slide 1: gancho potente.
- Último slide: CTA claro.
- Tono: ${project.tone}.
- Audiencia: ${project.audience}.
- Tema: ${project.topic}.
- Cada body: máximo 2 frases cortas.
- visual_intent: instrucción visual detallada sin texto en la imagen.
  `.trim();

  const response = await openai.responses.create({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
    input: prompt,
    text: {
      format: {
        type: 'json_object'
      }
    }
  });

  const raw = response.output_text;
  const parsed = JSON.parse(raw);

  project.slides = parsed.slides.map((slide, idx) => ({
    index: idx + 1,
    title: slide.title,
    body: slide.body,
    visualIntent: slide.visual_intent,
    imagePath: null,
    finalPath: null
  }));
  project.status = 'outline_ready';

  await writeProject(projectId, project);
  return project;
}

export async function renderSlides(projectId) {
  const project = await getProject(projectId);
  ensureSlides(project);

  for (const slide of project.slides) {
    await renderSingleSlide(project, slide.index);
  }

  const refreshed = await getProject(projectId);
  refreshed.status = 'rendered';
  await writeProject(projectId, refreshed);
  return refreshed;
}

export async function renderSingleSlide(project, slideIndex) {
  const slide = project.slides.find((s) => s.index === slideIndex);
  if (!slide) {
    throw new Error(`Slide ${slideIndex} no existe.`);
  }

  const prompt = [
    `Ilustración editorial para carrusel de Instagram en español.`,
    `Estilo consistente entre slides, minimalista, paleta moderna y limpia.`,
    `Formato vertical ${WIDTH}x${HEIGHT}.`,
    `Sin texto incrustado en la imagen.`,
    `Intención visual: ${slide.visualIntent}`
  ].join(' ');

  const imageResponse = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt,
    size: '1024x1024'
  });

  const b64 = imageResponse.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('No se pudo generar la imagen base del slide.');
  }

  const imageBuffer = Buffer.from(b64, 'base64');
  const imageOutput = path.join(DATA_DIR, `${project.id}-slide-${slide.index}-base.png`);
  const finalOutput = path.join(DATA_DIR, `${project.id}-slide-${slide.index}-final.png`);

  await fs.writeFile(imageOutput, imageBuffer);

  const canvas = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: '#F6F7FB'
    }
  });

  const resized = await sharp(imageBuffer)
    .resize({ width: WIDTH - 120, height: 760, fit: 'cover' })
    .png()
    .toBuffer();

  const textSvg = createTextOverlay(slide.title, slide.body, slide.index, project.slideCount);

  await canvas
    .composite([
      { input: resized, top: 80, left: 60 },
      { input: Buffer.from(textSvg), top: 900, left: 60 }
    ])
    .png()
    .toFile(finalOutput);

  slide.imagePath = imageOutput;
  slide.finalPath = finalOutput;

  await writeProject(project.id, project);
  return slide;
}

function createTextOverlay(title, body, index, total) {
  const safeTitle = sanitizeXml(title);
  const safeBody = sanitizeXml(body);

  return `
  <svg width="960" height="380" viewBox="0 0 960 380" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="960" height="380" rx="36" fill="#FFFFFF"/>
    <text x="48" y="88" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="700" fill="#101828">${safeTitle}</text>
    <foreignObject x="48" y="120" width="864" height="180">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, Arial, sans-serif; font-size: 36px; color: #344054; line-height: 1.3;">
        ${safeBody}
      </div>
    </foreignObject>
    <text x="48" y="340" font-family="Inter, Arial, sans-serif" font-size="28" fill="#667085">Slide ${index}/${total}</text>
  </svg>
  `;
}

function sanitizeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function ensureSlides(project) {
  if (!Array.isArray(project.slides) || project.slides.length === 0) {
    throw new Error('Primero genera el outline del proyecto.');
  }
}

function getProjectPath(projectId) {
  return path.join(DATA_DIR, `${projectId}.json`);
}

async function writeProject(projectId, project) {
  const filePath = getProjectPath(projectId);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8');
}
