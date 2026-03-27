import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import archiver from 'archiver';
import { nanoid } from 'nanoid';
import { createProject, generateOutline, getProject, renderSingleSlide, renderSlides } from './src/carouselService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

app.post('/api/projects', async (req, res) => {
  try {
    const { topic, audience, tone, slideCount = 8 } = req.body;

    if (!topic || !audience || !tone) {
      return res.status(400).json({ error: 'topic, audience y tone son obligatorios.' });
    }

    const projectId = nanoid(10);
    const project = await createProject(projectId, {
      topic,
      audience,
      tone,
      slideCount: Number(slideCount)
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/outline', async (req, res) => {
  try {
    const project = await generateOutline(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/render', async (req, res) => {
  try {
    const project = await renderSlides(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/slides/:n/regenerate', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    const index = Number(req.params.n);
    const slide = await renderSingleSlide(project, index);
    res.json(slide);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(404).json({ error: 'Proyecto no encontrado.' });
  }
});

app.get('/api/projects/:id/export', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    const files = project.slides
      .map((s) => s.finalPath)
      .filter(Boolean);

    if (files.length === 0) {
      return res.status(400).json({ error: 'No hay slides renderizados para exportar.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.id}-instagram-carousel.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => res.status(500).json({ error: err.message }));
    archive.pipe(res);

    files.forEach((filePath, idx) => {
      archive.file(filePath, { name: `slide-${idx + 1}.png` });
    });

    await archive.finalize();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Servidor listo en http://localhost:${port}`);
});
