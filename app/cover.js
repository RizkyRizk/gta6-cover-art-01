/* Leonida Poster Lab — cover renderer + editor.
   Everything runs locally: photos are read on the machine, never uploaded.
   The cover is drawn on one canvas; the same canvas exports the PNG. */
'use strict';

/* ------------------------------------------------------------------ */
/* Catalogues                                                          */
/* ------------------------------------------------------------------ */

const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square' },
  portrait: { w: 1080, h: 1350, label: 'Portrait' },
  wide: { w: 1920, h: 1080, label: 'Wide' },
};

/* Panel rects are fractions of the photo area (the canvas above the
   title band). Each layout lists the rects it shows, in panel order. */
const LAYOUTS = {
  quad: {
    label: 'Quad Grid',
    rects: [
      [0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5],
    ],
  },
  duo: {
    label: 'Duo Split',
    rects: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  },
  triple: {
    label: 'Triple Strip',
    rects: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
  },
  hero: {
    label: 'Hero Solo',
    rects: [[0, 0, 1, 1]],
  },
};

/* A grade is a light wash over every photo plus the title band's paint. */
const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    top: 'rgba(255, 46, 136, 0.55)', bottom: 'rgba(255, 126, 46, 0.55)',
    wash: 0.5, band: '#1c0b33', accent: '#ff2e88', title: '#ffffff',
  },
  neon: {
    label: 'Neon Nights',
    top: 'rgba(255, 46, 136, 0.6)', bottom: 'rgba(0, 229, 255, 0.6)',
    wash: 0.55, band: '#0d0618', accent: '#00e5ff', title: '#ffffff',
  },
  noir: {
    label: 'Palm Noir',
    top: 'rgba(255, 46, 136, 0.28)', bottom: 'rgba(20, 8, 40, 0.35)',
    wash: 0.4, band: '#111111', accent: '#ff2e88', title: '#ffffff',
    grayscale: true,
  },
  golden: {
    label: 'Golden Hour',
    top: 'rgba(255, 209, 102, 0.5)', bottom: 'rgba(255, 126, 46, 0.5)',
    wash: 0.5, band: '#241203', accent: '#ffd166', title: '#fff8e6',
  },
};

const SAMPLES = [
  { file: 'samples/sunset-pier.jpg', name: 'Sunset Pier' },
  { file: 'samples/neon-street.jpg', name: 'Neon Street' },
  { file: 'samples/palm-beach.jpg', name: 'Palm Beach' },
];

const SHUFFLE_TITLES = [
  'SUNSET HEIST', 'VICE NIGHTS', 'NEON GETAWAY', 'PALM SHADOWS',
  'LEONIDA HEAT', 'MIDNIGHT RUN', 'GOLDEN COAST', 'TURBO SUNSET',
];

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  layout: 'quad',
  grade: 'sunset',
  size: 'square',
  title: 'SUNSET HEIST',
  subtitle: 'LEONIDA · SUMMER 2026',
  selected: 0,
  panels: [0, 1, 2, 3].map(() => ({ img: null, zoom: 1, ox: 0, oy: 0 })),
};

const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('statusLine');
const fileInput = document.getElementById('fileInput');

function loadPrefs() {
  try {
    const raw = localStorage.getItem('leonida-poster-lab');
    if (!raw) return;
    const p = JSON.parse(raw);
    if (LAYOUTS[p.layout]) state.layout = p.layout;
    if (GRADES[p.grade]) state.grade = p.grade;
    if (SIZES[p.size]) state.size = p.size;
    if (typeof p.title === 'string' && p.title) state.title = p.title.slice(0, 24);
    if (typeof p.subtitle === 'string') state.subtitle = p.subtitle.slice(0, 40);
  } catch (_) { /* a bad saved value just means fresh defaults */ }
}

function savePrefs() {
  try {
    localStorage.setItem('leonida-poster-lab', JSON.stringify({
      layout: state.layout, grade: state.grade, size: state.size,
      title: state.title, subtitle: state.subtitle,
    }));
  } catch (_) { /* private mode: carry on without saving */ }
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/* The title band takes the bottom fifth; the rest is the photo area. */
function coverGeometry() {
  const W = canvas.width;
  const H = canvas.height;
  const bandH = Math.round(H * 0.2);
  const gap = Math.max(6, Math.round(W / 90));
  return { W, H, bandH, photoH: H - bandH, gap };
}

function panelRects() {
  const g = coverGeometry();
  return LAYOUTS[state.layout].rects.map(([fx, fy, fw, fh]) => ({
    x: Math.round(g.gap + fx * (g.W - g.gap * 2) + (fx > 0 ? g.gap / 2 : 0) + (fx === 0 ? 0 : 0)),
    y: Math.round(g.gap + fy * (g.photoH - g.gap * 2)),
    w: Math.round(fw * (g.W - g.gap * 2) - (fw < 1 ? g.gap : 0)),
    h: Math.round(fh * (g.photoH - g.gap * 2) - (fh < 1 ? g.gap : 0)),
  }));
}

/* Keep a panel's pan inside the photo: the image must still cover. */
function clampPan(panel, rect) {
  const img = panel.img;
  if (!img) { panel.ox = 0; panel.oy = 0; return; }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const dw = img.naturalWidth * base * panel.zoom;
  const dh = img.naturalHeight * base * panel.zoom;
  const mx = Math.max(0, (dw - rect.w) / 2 / rect.w);
  const my = Math.max(0, (dh - rect.h) / 2 / rect.h);
  panel.ox = Math.max(-mx, Math.min(mx, panel.ox));
  panel.oy = Math.max(-my, Math.min(my, panel.oy));
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function drawPhotoPanel(rect, panel, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const img = panel.img;
  if (!img) {
    ctx.fillStyle = '#1c1030';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = '#3d2560';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 8, rect.y + 8, rect.w - 16, rect.h - 16);
    ctx.setLineDash([]);
    ctx.fillStyle = '#b9a3d6';
    ctx.font = `${Math.round(rect.h * 0.09)}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DROP A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * panel.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = rect.x + (rect.w - dw) / 2 + panel.ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + panel.oy * rect.h;
  if (grade.grayscale) ctx.filter = 'grayscale(1) contrast(1.15) brightness(1.06)';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  applyGrade(rect, grade);
  ctx.restore();
}

/* A colour wash over the photo: a top-to-bottom gradient in overlay,
   then the same gradient again, softer, in soft-light. */
function applyGrade(rect, grade) {
  const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  grad.addColorStop(0, grade.top);
  grad.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.wash;
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = grade.wash * 0.7;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* The synthwave sun badge drawn at the right end of the title band. */
function drawSunBadge(cx, cy, r, band) {
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(0.6, '#ff2e88');
  grad.addColorStop(1, '#ff7e2e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = band;
  let y = cy + r * 0.08;
  let gapH = Math.max(2, r * 0.07);
  while (y < cy + r) {
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    ctx.fillRect(cx - half, y, half * 2, gapH);
    y += gapH + r * 0.14;
    gapH += r * 0.03;
  }
}

/* Shrink the title until it fits the band, then draw it outlined. */
function drawTitleBand(g, grade) {
  const bandY = g.H - g.bandH;
  ctx.fillStyle = grade.band;
  ctx.fillRect(0, bandY, g.W, g.bandH);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, bandY, g.W, Math.max(3, g.bandH * 0.03));

  const pad = Math.round(g.W * 0.045);
  const sunR = g.bandH * 0.34;
  const sunX = g.W - pad - sunR;
  const sunY = bandY + g.bandH * 0.46;
  drawSunBadge(sunX, sunY, sunR, grade.band);

  const maxW = sunX - sunR - pad * 2;
  let size = Math.round(g.bandH * 0.52);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const title = (state.title || 'UNTITLED').toUpperCase();
  do {
    ctx.font = `${size}px Anton, sans-serif`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = `${Math.round(size * 0.02)}px`;
    if (ctx.measureText(title).width <= maxW || size <= 20) break;
    size -= 4;
  } while (true);
  const titleY = bandY + g.bandH * 0.56;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, size / 16);
  ctx.strokeStyle = 'rgba(10, 4, 20, 0.9)';
  ctx.strokeText(title, pad, titleY);
  ctx.fillStyle = grade.title;
  ctx.fillText(title, pad, titleY);

  const sub = (state.subtitle || '').toUpperCase();
  if (sub) {
    const subSize = Math.round(g.bandH * 0.2);
    ctx.font = `${subSize}px "Bebas Neue", sans-serif`;
    if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = `${Math.round(subSize * 0.18)}px`;
    ctx.fillStyle = grade.accent;
    ctx.fillText(sub, pad, bandY + g.bandH * 0.86);
  }
  if (typeof ctx.letterSpacing !== 'undefined') ctx.letterSpacing = '0px';
}

function drawCover() {
  const g = coverGeometry();
  const grade = GRADES[state.grade];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, g.W, g.H);
  const rects = panelRects();
  rects.forEach((rect, i) => drawPhotoPanel(rect, state.panels[i], grade));
  drawTitleBand(g, grade);
}

/* ------------------------------------------------------------------ */
/* Rendering + thumbnails                                              */
/* ------------------------------------------------------------------ */

const thumbCanvases = [];

function drawThumbs() {
  const rects = panelRects();
  const used = LAYOUTS[state.layout].rects.length;
  thumbCanvases.forEach((thumb, i) => {
    if (!thumb) return;
    const t = thumb.getContext('2d');
    const panel = state.panels[i];
    t.clearRect(0, 0, thumb.width, thumb.height);
    if (!panel.img) {
      t.fillStyle = '#1c1030';
      t.fillRect(0, 0, thumb.width, thumb.height);
      t.fillStyle = '#b9a3d6';
      t.font = '12px "Bebas Neue", sans-serif';
      t.textAlign = 'center';
      t.textBaseline = 'middle';
      t.fillText(i >= used ? 'NOT USED' : 'EMPTY', thumb.width / 2, thumb.height / 2);
      return;
    }
    const base = Math.max(thumb.width / panel.img.naturalWidth, thumb.height / panel.img.naturalHeight);
    const dw = panel.img.naturalWidth * base * panel.zoom;
    const dh = panel.img.naturalHeight * base * panel.zoom;
    t.drawImage(
      panel.img,
      (thumb.width - dw) / 2 + panel.ox * thumb.width,
      (thumb.height - dh) / 2 + panel.oy * thumb.height,
      dw, dh,
    );
    if (i >= used) {
      t.fillStyle = 'rgba(14, 6, 24, 0.55)';
      t.fillRect(0, 0, thumb.width, thumb.height);
    }
  });
}

function render() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCover();
  drawThumbs();
  const used = LAYOUTS[state.layout].rects.length;
  const panel = state.panels[state.selected];
  const sampleName = panel.img ? panel.img.dataset.sample || 'your photo' : 'empty';
  statusLine.textContent =
    `Panel ${state.selected + 1} of ${used} in this layout · ${sampleName} · ` +
    `${state.title || 'Untitled'} — ${SIZES[state.size].label} ${size.w}×${size.h}`;
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

function setPanelImage(index, img, sampleName) {
  const panel = state.panels[index];
  panel.img = img;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  if (sampleName) img.dataset.sample = sampleName;
  render();
}

function loadFileIntoPanel(index, file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    setPanelImage(index, img, '');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    statusLine.textContent = `Could not read ${file.name} — try a JPG or PNG.`;
  };
  img.src = url;
}

function loadSampleIntoPanel(index, sampleIndex) {
  const sample = SAMPLES[sampleIndex % SAMPLES.length];
  const img = new Image();
  img.onload = () => setPanelImage(index, img, sample.name);
  img.onerror = () => { statusLine.textContent = `Could not load sample ${sample.file}.`; };
  img.src = sample.file;
}

function preloadSamples(done) {
  let remaining = SAMPLES.length;
  const loaded = [];
  SAMPLES.forEach((sample, i) => {
    const img = new Image();
    img.onload = () => {
      img.dataset.sample = sample.name;
      loaded[i] = img;
      if (--remaining === 0) done(loaded);
    };
    img.onerror = () => { if (--remaining === 0) done(loaded); };
    img.src = sample.file;
  });
}

function applyPreset(name) {
  const presets = {
    sunset: { layout: 'quad', grade: 'sunset', title: 'SUNSET HEIST', subtitle: 'LEONIDA · SUMMER 2026', samples: [0, 1, 2, 0] },
    neon: { layout: 'duo', grade: 'neon', title: 'VICE NIGHTS', subtitle: 'NEON CITY · AFTER DARK', samples: [1, 0, 1, 2] },
    beach: { layout: 'triple', grade: 'golden', title: 'GOLDEN COAST', subtitle: 'PALM BEACH · 6 PM', samples: [2, 0, 1, 2] },
  };
  const p = presets[name];
  if (!p) return;
  state.layout = p.layout;
  state.grade = p.grade;
  state.title = p.title;
  state.subtitle = p.subtitle;
  document.getElementById('titleInput').value = p.title;
  document.getElementById('subtitleInput').value = p.subtitle;
  syncButtonGroups();
  preloadSamples((loaded) => {
    p.samples.forEach((s, i) => {
      if (loaded[s]) {
        state.panels[i].img = loaded[s];
        state.panels[i].zoom = 1;
        state.panels[i].ox = 0;
        state.panels[i].oy = 0;
      }
    });
    render();
  });
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function exportCoverPNG() {
  render();
  const size = SIZES[state.size];
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        statusLine.textContent = 'Export failed — the canvas could not make a PNG.';
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leonida-cover-${state.size}-${size.w}x${size.h}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      statusLine.textContent =
        `Exported ${a.download} (${(blob.size / 1024).toFixed(0)} KiB) — ready to post.`;
      resolve(blob);
    }, 'image/png');
  });
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function syncButtonGroups() {
  const sync = (id, key, value) => {
    document.querySelectorAll(`#${id} button`).forEach((b) => {
      b.classList.toggle('active', b.dataset[key] === value);
    });
  };
  sync('layoutBtns', 'layout', state.layout);
  sync('gradeBtns', 'grade', state.grade);
  sync('sizeBtns', 'size', state.size);
}

function buildPanelCards() {
  const list = document.getElementById('panelList');
  list.innerHTML = '';
  thumbCanvases.length = 0;
  state.panels.forEach((panel, i) => {
    const card = document.createElement('div');
    card.className = 'panel-card';
    card.dataset.panel = String(i);
    card.innerHTML =
      `<canvas width="128" height="96"></canvas>` +
      `<div><div class="panel-name">Panel ${i + 1}</div>` +
      `<div class="panel-tools">` +
      `<button type="button" data-act="upload">Upload</button>` +
      `<button type="button" data-act="sample">Next sample</button>` +
      `</div>` +
      `<input type="range" min="1" max="3" step="0.05" value="1" aria-label="Zoom panel ${i + 1}">` +
      `</div>`;
    const thumb = card.querySelector('canvas');
    thumbCanvases[i] = thumb;
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      selectPanel(i);
    });
    card.querySelector('[data-act="upload"]').addEventListener('click', () => {
      state.selected = i;
      fileInput.click();
    });
    card.querySelector('[data-act="sample"]').addEventListener('click', () => {
      state.selected = i;
      const next = (SAMPLES.findIndex((s) => state.panels[i].img &&
        state.panels[i].img.dataset.sample === s.name) + 1) % SAMPLES.length;
      loadSampleIntoPanel(i, next);
      highlightSelectedCard();
    });
    card.querySelector('input[type="range"]').addEventListener('input', (e) => {
      state.selected = i;
      panel.zoom = Number(e.target.value);
      clampPan(panel, panelRects()[i] || { w: 100, h: 100 });
      render();
      highlightSelectedCard();
    });
    list.appendChild(card);
  });
}

function highlightSelectedCard() {
  document.querySelectorAll('.panel-card').forEach((card) => {
    card.classList.toggle(
      'selected', Number(card.dataset.panel) === state.selected,
    );
  });
}

function selectPanel(i) {
  state.selected = i;
  highlightSelectedCard();
  render();
}

function bindControls() {
  document.getElementById('layoutBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-layout]');
    if (!b) return;
    state.layout = b.dataset.layout;
    if (state.selected >= LAYOUTS[state.layout].rects.length) state.selected = 0;
    syncButtonGroups();
    savePrefs();
    render();
    highlightSelectedCard();
  });
  document.getElementById('gradeBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-grade]');
    if (!b) return;
    state.grade = b.dataset.grade;
    syncButtonGroups();
    savePrefs();
    render();
  });
  document.getElementById('sizeBtns').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-size]');
    if (!b) return;
    state.size = b.dataset.size;
    syncButtonGroups();
    savePrefs();
    render();
  });
  document.getElementById('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    savePrefs();
    render();
  });
  document.getElementById('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    savePrefs();
    render();
  });
  document.getElementById('exportBtn').addEventListener('click', exportCoverPNG);
  document.getElementById('fillAllBtn').addEventListener('click', () => {
    const src = state.panels[state.selected];
    if (!src.img) {
      statusLine.textContent = 'The selected panel is empty — upload or pick a sample first.';
      return;
    }
    state.panels.forEach((p) => {
      p.img = src.img;
      p.zoom = src.zoom;
      p.ox = src.ox;
      p.oy = src.oy;
    });
    render();
    statusLine.textContent = 'Every panel now shows the selected photo.';
  });
  document.getElementById('shuffleBtn').addEventListener('click', () => {
    const layouts = Object.keys(LAYOUTS);
    const grades = Object.keys(GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.title = SHUFFLE_TITLES[Math.floor(Math.random() * SHUFFLE_TITLES.length)];
    document.getElementById('titleInput').value = state.title;
    syncButtonGroups();
    savePrefs();
    preloadSamples((loaded) => {
      state.panels.forEach((p, i) => {
        const img = loaded[Math.floor(Math.random() * loaded.length)];
        if (img) {
          p.img = img;
          p.zoom = 1;
          p.ox = 0;
          p.oy = 0;
        }
      });
      render();
    });
  });
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    files.slice(0, 4).forEach((file, k) => {
      loadFileIntoPanel((state.selected + k) % 4, file);
    });
    fileInput.value = '';
  });
  bindCanvasPointer();
  bindCanvasDrop();
}

function bindCanvasPointer() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  };
  const hitPanel = (x, y) => {
    const rects = panelRects();
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  };

  canvas.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const hit = hitPanel(p.x, p.y);
    if (hit < 0) return;
    selectPanel(hit);
    dragging = true;
    lastX = p.x;
    lastY = p.y;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toCanvas(e);
    const panel = state.panels[state.selected];
    const rect = panelRects()[state.selected];
    if (!panel.img || !rect) return;
    panel.ox += (p.x - lastX) / rect.w;
    panel.oy += (p.y - lastY) / rect.h;
    clampPan(panel, rect);
    lastX = p.x;
    lastY = p.y;
    render();
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const panel = state.panels[state.selected];
    if (!panel.img) return;
    panel.zoom = Math.max(1, Math.min(4, panel.zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
    const rect = panelRects()[state.selected];
    if (rect) clampPan(panel, rect);
    const slider = document.querySelector(`.panel-card[data-panel="${state.selected}"] input[type="range"]`);
    if (slider) slider.value = String(panel.zoom);
    render();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input')) return;
    const panel = state.panels[state.selected];
    const rect = panelRects()[state.selected];
    if (!panel.img || !rect) return;
    const step = 0.03;
    if (e.key === 'ArrowLeft') { panel.ox -= step; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { panel.ox += step; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { panel.oy -= step; e.preventDefault(); }
    else if (e.key === 'ArrowDown') { panel.oy += step; e.preventDefault(); }
    else return;
    clampPan(panel, rect);
    render();
  });
}

function bindCanvasDrop() {
  const wrap = document.querySelector('.canvas-wrap');
  const hint = document.getElementById('dropHint');
  ['dragenter', 'dragover'].forEach((name) => {
    wrap.addEventListener(name, (e) => {
      e.preventDefault();
      hint.hidden = false;
    });
  });
  ['dragleave', 'drop'].forEach((name) => {
    wrap.addEventListener(name, (e) => {
      e.preventDefault();
      hint.hidden = true;
    });
  });
  wrap.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files || [])
      .filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const rects = panelRects();
    let target = state.selected;
    rects.forEach((rect, i) => {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) target = i;
    });
    files.slice(0, 4).forEach((file, k) => {
      loadFileIntoPanel((target + k) % 4, file);
    });
    selectPanel(target);
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

loadPrefs();
buildPanelCards();
bindControls();
syncButtonGroups();
document.getElementById('titleInput').value = state.title;
document.getElementById('subtitleInput').value = state.subtitle;
highlightSelectedCard();

const preset = new URLSearchParams(location.search).get('preset');
if (preset) {
  applyPreset(preset);
} else {
  preloadSamples((loaded) => {
    [0, 1, 2, 0].forEach((s, i) => {
      if (loaded[s]) state.panels[i].img = loaded[s];
    });
    render();
  });
}
render();

/* Fonts arrive after the first paint; redraw once they are ready so the
   Anton title and Bebas subtitle never render in a fallback face. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => render());
}

/* Test hook for the screenshot probe: drive the app without a mouse. */
window.LeonidaLab = {
  state, SIZES, GRADES, LAYOUTS, SAMPLES,
  render, selectPanel, loadSampleIntoPanel, exportCoverPNG,
  setTitle(t) { state.title = t; document.getElementById('titleInput').value = t; render(); },
  setSubtitle(t) { state.subtitle = t; document.getElementById('subtitleInput').value = t; render(); },
  setLayout(l) { state.layout = l; syncButtonGroups(); render(); },
  setGrade(g) { state.grade = g; syncButtonGroups(); render(); },
  setSize(s) { state.size = s; syncButtonGroups(); render(); },
};
