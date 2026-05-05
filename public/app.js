/* WearNowai — AI Virtual Try-On Frontend */

const $ = id => document.getElementById(id);

// ── STATE ──────────────────────────────────────
const state = {
  clothingFile: null,
  personFile: null,
  lastEntry: null
};

// ── DOM ────────────────────────────────────────
const clothingZone    = $('clothingZone');
const clothingInput   = $('clothingInput');
const clothingInner   = $('clothingInner');
const clothingPreview = $('clothingPreview');
const clothingImg     = $('clothingPreviewImg');
const removeClothing  = $('removeClothing');

const personZone      = $('personZone');
const personInput     = $('personInput');
const personInner     = $('personInner');
const personPreview   = $('personPreview');
const personImg       = $('personPreviewImg');
const removePerson    = $('removePerson');

const userNameInput   = $('userName');
const generateBtn     = $('generateBtn');
const generateHint    = $('generateHint');

const resultsModal    = $('resultsModal');
const modalClose      = $('modalClose');
const downloadBtn     = $('downloadBtn');
const tryAgainBtn     = $('tryAgainBtn');
const shareBtn        = $('shareBtn');
const tabResult       = $('tabResult');
const tabCompare      = $('tabCompare');
const resultView      = $('resultView');
const compareView     = $('compareView');
const resultFrame     = $('resultFrame');
const zoomBtn         = $('zoomBtn');
const compareWrap     = $('compareWrap');
const compareHandle   = $('compareHandle');
const compareAfterImg = $('compareAfterImg');
const compareBeforeImg= $('compareBeforeImg');
const compareBeforeClip=$('compareBeforeClip');

const lightbox        = $('lightbox');
const lightboxClose   = $('lightboxClose');
const lightboxImg     = $('lightboxImg');

const progressArea    = $('progressArea');
const progressFill    = $('progressFill');
const progressPct     = $('progressPct');
const progressLabel   = $('progressLabel');
const progressEta     = $('progressEta');

const studioSection   = $('section-studio');
const historySection  = $('section-history');
const historyGrid     = $('historyGrid');
const historyEmpty    = $('historyEmpty');

const toast           = $('toast');
const toastMsg        = $('toastMsg');

// ── NAVIGATION ─────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchSection(btn.dataset.section);
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

$('goToStudioBtn')?.addEventListener('click', () => {
  switchSection('studio');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === 'studio'));
});

function switchSection(name) {
  studioSection.classList.toggle('hidden', name !== 'studio');
  historySection.classList.toggle('hidden', name !== 'history');
  if (name === 'history') loadHistory();
}

// ── PHOTO TIPS TOGGLE ──────────────────────────
document.querySelectorAll('.tips-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const panel = $(btn.dataset.target);
    const open  = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', open);
    btn.classList.toggle('active', !open);
  });
});

// ── PHOTO ANALYSIS / WARNING ───────────────────
function analyzePhoto(file, warningElId) {
  const warningEl = $(warningElId);
  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    const size = Math.min(img.width, 80);
    const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      brightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    brightness /= (size * size);

    const warnings = [];
    if (brightness < 40)  warnings.push('Photo looks very dark — try better lighting');
    if (img.width < 200 || img.height < 200) warnings.push('Photo resolution may be too low for best results');
    if (img.width > img.height * 1.6) warnings.push('Portrait photos work better than landscape');

    if (warnings.length) {
      warningEl.innerHTML = '⚠️ ' + warnings.join(' · ');
      warningEl.classList.remove('hidden');
    } else {
      warningEl.classList.add('hidden');
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ── UPLOAD HELPERS ─────────────────────────────
function setupDropZone({ zone, input, inner, preview, previewImg, removeBtn, key, warningId }) {
  zone.addEventListener('click', () => { if (!state[key]) input.click(); });

  input.addEventListener('change', () => {
    if (input.files[0]) setFile(input.files[0], key, previewImg, inner, preview, zone, warningId);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) setFile(f, key, previewImg, inner, preview, zone, warningId);
    else showToast('Please drop an image file');
  });

  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearFile(key, input, inner, preview, zone, warningId);
  });
}

function setFile(file, key, imgEl, inner, preview, zone, warningId) {
  if (file.size > 15 * 1024 * 1024) { showToast('File must be under 15MB'); return; }
  state[key] = file;
  imgEl.src = URL.createObjectURL(file);
  inner.classList.add('hidden');
  preview.classList.remove('hidden');
  zone.classList.add('has-file');
  if (warningId) analyzePhoto(file, warningId);
  updateBtn();
}

function clearFile(key, input, inner, preview, zone, warningId) {
  state[key] = null;
  input.value = '';
  inner.classList.remove('hidden');
  preview.classList.add('hidden');
  zone.classList.remove('has-file');
  if (warningId) $(warningId)?.classList.add('hidden');
  updateBtn();
}

function updateBtn() {
  const ready = state.clothingFile && state.personFile;
  generateBtn.disabled = !ready;
  if (!state.clothingFile && !state.personFile) generateHint.textContent = 'Upload both photos to continue';
  else if (!state.clothingFile) generateHint.textContent = 'Now upload the clothing photo';
  else if (!state.personFile)   generateHint.textContent = 'Now upload your photo';
  else generateHint.textContent = 'Ready! Click Generate to create your AI look';
}

setupDropZone({ zone: clothingZone, input: clothingInput, inner: clothingInner, preview: clothingPreview, previewImg: clothingImg, removeBtn: removeClothing, key: 'clothingFile', warningId: 'clothingWarning' });
setupDropZone({ zone: personZone,   input: personInput,   inner: personInner,   preview: personPreview,   previewImg: personImg,   removeBtn: removePerson,   key: 'personFile',   warningId: 'personWarning'   });

// ── GENERATE ───────────────────────────────────
async function runGenerate() {
  if (!state.clothingFile || !state.personFile) return;

  startProgress();

  try {
    const form = new FormData();
    form.append('clothingPhoto', state.clothingFile);
    form.append('userPhoto', state.personFile);
    form.append('userName', userNameInput.value.trim() || 'Anonymous');

    const res  = await fetch('/api/generate', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Generation failed');

    state.lastEntry = data.entry;
    finishProgress(() => {
      generateHint.textContent = 'Ready! Click Generate to create your AI look';
      showToast(data.message);
      openModal(data.entry);
    });

  } catch (err) {
    finishProgress(() => {
      generateHint.textContent = 'Upload both photos to continue';
      showToast('Error: ' + err.message);
    });
    console.error(err);
  }
}

generateBtn.addEventListener('click', runGenerate);

// ── PROGRESS ANIMATION ─────────────────────────
const PROGRESS_STAGES = [
  { threshold: 0,  label: 'Uploading your photos…' },
  { threshold: 25, label: 'Analyzing clothing item…' },
  { threshold: 48, label: 'Fitting outfit to your photo…' },
  { threshold: 68, label: 'Refining AI details…' },
  { threshold: 85, label: 'Final touches…' },
  { threshold: 95, label: 'Almost ready…' },
];

let _progressTimer = null;
let _progressValue = 0;
let _startTime = 0;

function setProgressUI(pct) {
  const rounded = Math.round(pct);
  progressFill.style.width = pct + '%';
  progressPct.textContent  = rounded + '%';

  const stage = [...PROGRESS_STAGES].reverse().find(s => pct >= s.threshold);
  if (stage) progressLabel.textContent = stage.label;

  const elapsed   = (Date.now() - _startTime) / 1000;
  const rate      = pct > 0 ? elapsed / pct : 0;
  const remaining = Math.max(0, Math.round(rate * (100 - pct)));
  progressEta.textContent = pct >= 100 ? 'Done!'
    : remaining > 0 ? `~${remaining}s remaining`
    : 'Estimated ~30 seconds';
}

function startProgress() {
  _progressValue = 0;
  _startTime     = Date.now();
  progressArea.classList.remove('hidden');
  generateBtn.classList.add('hidden');
  generateHint.classList.add('hidden');
  setProgressUI(0);

  _progressTimer = setInterval(() => {
    const gap = 95 - _progressValue;
    _progressValue += Math.max(gap * 0.03, 0.08);
    if (_progressValue >= 95) _progressValue = 95;
    setProgressUI(_progressValue);
  }, 300);
}

function finishProgress(callback) {
  clearInterval(_progressTimer);
  _progressValue = 100;
  setProgressUI(100);
  setTimeout(() => {
    progressArea.classList.add('hidden');
    generateBtn.classList.remove('hidden');
    generateHint.classList.remove('hidden');
    if (callback) callback();
  }, 600);
}

// ── MODAL ──────────────────────────────────────
function openModal(entry) {
  // Result frame
  if (entry.generatedImage) {
    resultFrame.innerHTML = `<img src="${entry.generatedImage}" alt="AI Look" />`;
    zoomBtn.style.display = '';
  } else {
    resultFrame.innerHTML = `<div class="result-placeholder">
      <span class="big">${entry.aiEnabled === false ? '🔑' : '⚠️'}</span>
      ${entry.aiEnabled === false
        ? 'Add <code>REPLICATE_API_KEY</code> to <code>.env</code> to enable AI generation'
        : 'Generation failed — try again'}
    </div>`;
    zoomBtn.style.display = 'none';
  }

  // Before/After images
  compareAfterImg.src  = entry.generatedImage || '';
  compareBeforeImg.src = entry.userPhoto || '';
  compareBeforeClip.style.width = '50%';
  compareHandle.style.left      = '50%';

  // Reset to result tab
  showTab('result');

  downloadBtn.disabled = !entry.generatedImage;
  shareBtn.disabled    = !entry.generatedImage;
  resultsModal.classList.remove('hidden');
}

function showTab(name) {
  const isResult = name === 'result';
  tabResult.classList.toggle('active', isResult);
  tabCompare.classList.toggle('active', !isResult);
  resultView.classList.toggle('hidden', !isResult);
  compareView.classList.toggle('hidden', isResult);
}

tabResult.addEventListener('click',  () => showTab('result'));
tabCompare.addEventListener('click', () => showTab('compare'));

modalClose.addEventListener('click', closeModal);
resultsModal.addEventListener('click', e => { if (e.target === resultsModal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeLightbox(); } });

function closeModal() { resultsModal.classList.add('hidden'); }

// ── BEFORE/AFTER SLIDER ────────────────────────
let _dragging = false;

compareHandle.addEventListener('mousedown',  startDrag);
compareHandle.addEventListener('touchstart', startDrag, { passive: true });

function startDrag(e) {
  _dragging = true;
  e.stopPropagation();
}

document.addEventListener('mousemove',  onDrag);
document.addEventListener('touchmove',  onDrag, { passive: true });
document.addEventListener('mouseup',    () => { _dragging = false; });
document.addEventListener('touchend',   () => { _dragging = false; });

compareWrap.addEventListener('click', onDrag);

function onDrag(e) {
  if (e.type === 'mousemove' && !_dragging) return;
  const rect = compareWrap.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const pct = Math.min(Math.max((clientX - rect.left) / rect.width * 100, 0), 100);
  compareBeforeClip.style.width = pct + '%';
  compareHandle.style.left      = pct + '%';
}

// ── ZOOM LIGHTBOX ──────────────────────────────
zoomBtn.addEventListener('click', () => {
  const img = resultFrame.querySelector('img');
  if (!img) return;
  lightboxImg.src = img.src;
  lightbox.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});

function closeLightbox() {
  lightbox.classList.add('hidden');
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

// ── MODAL ACTIONS ──────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!state.lastEntry?.generatedImage) return;
  downloadImage(state.lastEntry.generatedImage, 'wearnowai-look.png');
});

shareBtn.addEventListener('click', async () => {
  const url = state.lastEntry?.generatedImage;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Image link copied to clipboard!');
  } catch {
    window.open(url, '_blank');
  }
});

tryAgainBtn.addEventListener('click', () => {
  closeModal();
  clearFile('clothingFile', clothingInput, clothingInner, clothingPreview, clothingZone, 'clothingWarning');
  clearFile('personFile',   personInput,   personInner,   personPreview,   personZone,   'personWarning');
});

// ── MY LOOKS HISTORY ───────────────────────────
async function loadHistory() {
  historyGrid.innerHTML = '<p class="history-loading">Loading your looks…</p>';
  historyEmpty.classList.add('hidden');

  try {
    const res = await fetch('/api/history');
    if (res.status === 401) { window.location.replace('/auth.html'); return; }
    const entries = await res.json();

    if (!entries.length) {
      historyGrid.innerHTML = '';
      historyEmpty.classList.remove('hidden');
      return;
    }

    historyEmpty.classList.add('hidden');
    historyGrid.innerHTML = entries.map(e => `
      <div class="history-card" data-entry='${JSON.stringify(e)}'>
        <div class="history-img-wrap">
          ${e.generatedImage
            ? `<img src="${e.generatedImage}" alt="AI Look" loading="lazy" />`
            : `<div class="history-placeholder">⏳</div>`}
          ${e.generatedImage ? '<div class="history-ai-badge">AI Look</div>' : ''}
        </div>
        <div class="history-info">
          <span class="history-time">${relativeTime(e.timestamp)}</span>
          ${e.generatedImage
            ? `<button class="history-dl-btn" data-url="${e.generatedImage}" title="Download">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
               </button>`
            : ''}
        </div>
      </div>
    `).join('');

    // Click card → open in modal
    historyGrid.querySelectorAll('.history-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.history-dl-btn')) return;
        const entry = JSON.parse(card.dataset.entry);
        state.lastEntry = entry;
        openModal(entry);
      });
    });

    // Download buttons
    historyGrid.querySelectorAll('.history-dl-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        downloadImage(btn.dataset.url, 'wearnowai-look.png');
      });
    });

  } catch {
    historyGrid.innerHTML = '<p class="history-loading">Could not load history.</p>';
  }
}

// ── UTILITIES ──────────────────────────────────
function relativeTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

let toastTimer;
function showToast(msg, ms = 3500) {
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
}

async function downloadImage(url, filename) {
  try {
    const blob = await (await fetch(url)).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { window.open(url, '_blank'); }
}

// ── START ──────────────────────────────────────
updateBtn();

// ── SCROLL ANIMATIONS ──────────────────────────
(function () {
  const groups = [
    { sel: '#clothingCard',  delay: 0 },
    { sel: '.plus-divider',  delay: 0.08 },
    { sel: '#personCard',    delay: 0.16 },
    { sel: '.generate-area', delay: 0 },
    { sel: '.feature-item',  delay: 0, stagger: 0.08 },
    { sel: '.site-footer',   delay: 0 },
  ];

  groups.forEach(({ sel, delay, stagger = 0 }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('scroll-reveal');
      el.style.transitionDelay = (delay + i * stagger) + 's';
    });
  });

  let scrollDir = 'down';
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    scrollDir = window.scrollY > lastY ? 'down' : 'up';
    lastY = window.scrollY;
  }, { passive: true });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const el = entry.target;
      if (entry.isIntersecting) {
        el.style.transition = 'none';
        el.classList.remove('in-view', 'from-above');
        if (scrollDir === 'up') el.classList.add('from-above');
        void el.offsetHeight;
        el.style.transition = '';
        el.classList.add('in-view');
      } else {
        el.style.transition = 'none';
        el.classList.remove('in-view', 'from-above');
        void el.offsetHeight;
        el.style.transition = '';
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
})();
