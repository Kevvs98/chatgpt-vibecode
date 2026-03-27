const form = document.querySelector('#project-form');
const logEl = document.querySelector('#log');
const actions = document.querySelector('#actions');
const slidesSection = document.querySelector('#slides');
const slidesGrid = document.querySelector('#slides-grid');
const outlineBtn = document.querySelector('#outline-btn');
const renderBtn = document.querySelector('#render-btn');
const exportLink = document.querySelector('#export-link');

let projectId = null;

function log(msg, data) {
  const stamp = new Date().toLocaleTimeString();
  logEl.textContent = `[${stamp}] ${msg}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}`;
}

async function call(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error inesperado');
  return body;
}

function renderSlides(project) {
  slidesGrid.innerHTML = '';
  project.slides.forEach((slide) => {
    const card = document.createElement('article');
    card.className = 'slide';

    const imageHtml = slide.finalPath
      ? `<img src="/data/${slide.finalPath.split('/').pop()}" alt="Slide ${slide.index}" />`
      : '<small>Sin imagen final todavía.</small>';

    card.innerHTML = `
      <strong>${slide.index}. ${slide.title}</strong>
      <small>${slide.body}</small>
      ${imageHtml}
      <button data-slide="${slide.index}">Regenerar slide ${slide.index}</button>
    `;

    card.querySelector('button').addEventListener('click', async () => {
      try {
        log(`Regenerando slide ${slide.index}...`);
        await call(`/api/projects/${projectId}/slides/${slide.index}/regenerate`, { method: 'POST' });
        const updated = await call(`/api/projects/${projectId}`);
        renderSlides(updated);
        log(`Slide ${slide.index} regenerado.`);
      } catch (error) {
        log(error.message);
      }
    });

    slidesGrid.appendChild(card);
  });

  slidesSection.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());

    const project = await call('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    projectId = project.id;
    actions.hidden = false;
    exportLink.href = `/api/projects/${projectId}/export`;
    log('Proyecto creado.', project);
  } catch (error) {
    log(error.message);
  }
});

outlineBtn.addEventListener('click', async () => {
  if (!projectId) return;
  try {
    log('Generando outline...');
    const project = await call(`/api/projects/${projectId}/outline`, { method: 'POST' });
    renderSlides(project);
    log('Outline generado.', project);
  } catch (error) {
    log(error.message);
  }
});

renderBtn.addEventListener('click', async () => {
  if (!projectId) return;
  try {
    log('Renderizando todos los slides...');
    const project = await call(`/api/projects/${projectId}/render`, { method: 'POST' });
    renderSlides(project);
    log('Render finalizado.', project);
  } catch (error) {
    log(error.message);
  }
});
