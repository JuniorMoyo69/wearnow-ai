/* WearNowai — AI Virtual Try-On Frontend */

const $ = id => document.getElementById(id);

// ── AUTH CHECK ─────────────────────────────────
(async () => {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location.replace('/auth.html'); return; }
    const { user } = await res.json();
    const initial = user.username.charAt(0).toUpperCase();
    $('userAvatar').textContent = initial;
    $('userName_header').textContent = user.username;
    $('userName').value = user.username;
  } catch {
    window.location.replace('/auth.html');
  }
})();

// ── LOGOUT ────────────────────────────────────
$('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.replace('/auth.html');
});

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
const btnText         = $('btnText');
const btnSpinner      = $('btnSpinner');
const generateHint    = $('generateHint');

const resultsModal    = $('resultsModal');
const resultsRow      = $('resultsRow');
const modalClose      = $('modalClose');
const downloadBtn     = $('downloadBtn');
const tryAgainBtn     = $('tryAgainBtn');

const progressArea    = $('progressArea');
const progressFill    = $('progressFill');
const progressPct     = $('progressPct');
const progressLabel   = $('progressLabel');
const progressEta     = $('progressEta');

const toast           = $('toast');
const toastMsg        = $('toastMsg');

// ── UPLOAD HELPERS ─────────────────────────────
function setupDropZone({ zone, input, inner, preview, previewImg, removeBtn, key }) {
  zone.addEventListener('click', () => { if (!state[key]) input.click(); });

  input.addEventListener('change', () => {
    if (input.files[0]) setFile(input.files[0], key, previewImg, inner, preview, zone);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) setFile(f, key, previewImg, inner, preview, zone);
    else showToast('Please drop an image file');
  });

  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearFile(key, input, inner, preview, zone);
  });
}

function setFile(file, key, imgEl, inner, preview, zone) {
  if (file.size > 15 * 1024 * 1024) { showToast('File must be under 15MB'); return; }
  state[key] = file;
  imgEl.src = URL.createObjectURL(file);
  inner.classList.add('hidden');
  preview.classList.remove('hidden');
  zone.classList.add('has-file');
  updateBtn();
}

function clearFile(key, input, inner, preview, zone) {
  state[key] = null;
  input.value = '';
  inner.classList.remove('hidden');
  preview.classList.add('hidden');
  zone.classList.remove('has-file');
  updateBtn();
}

function updateBtn() {
  const ready = state.clothingFile && state.personFile;
  generateBtn.disabled = !ready;
  if (!state.clothingFile && !state.personFile) generateHint.textContent = 'Upload both photos to continue';
  else if (!state.clothingFile) generateHint.textContent = 'Now upload the clothing photo';
  else if (!state.personFile) generateHint.textContent = 'Now upload your photo';
  else generateHint.textContent = 'Ready! Click Generate to create your AI look';
}

setupDropZone({ zone: clothingZone, input: clothingInput, inner: clothingInner, preview: clothingPreview, previewImg: clothingImg, removeBtn: removeClothing, key: 'clothingFile' });
setupDropZone({ zone: personZone,   input: personInput,   inner: personInner,   preview: personPreview,   previewImg: personImg,   removeBtn: removePerson,   key: 'personFile' });

// ── GENERATE ───────────────────────────────────
generateBtn.addEventListener('click', async () => {
  if (!state.clothingFile || !state.personFile) return;

  startProgress();

  try {
    const form = new FormData();
    form.append('clothingPhoto', state.clothingFile);
    form.append('userPhoto', state.personFile);
    form.append('userName', userNameInput.value.trim() || 'Anonymous');

    const res = await fetch('/api/generate', { method: 'POST', body: form });
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
});

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

  const elapsed = (Date.now() - _startTime) / 1000;
  const rate    = pct > 0 ? elapsed / pct : 0;
  const remaining = Math.max(0, Math.round(rate * (100 - pct)));
  progressEta.textContent = pct >= 100
    ? 'Done!'
    : remaining > 0
      ? `~${remaining}s remaining`
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
    if (_progressValue >= 95) { _progressValue = 95; }
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
  const genFrame = entry.generatedImage
    ? `<img src="${entry.generatedImage}" alt="AI Look" />`
    : `<div class="result-placeholder">
        <span class="big">${entry.aiEnabled === false ? '🔑' : '⚠️'}</span>
        ${entry.aiEnabled === false
          ? 'Add <code>OPENAI_API_KEY</code> to <code>.env</code> to enable AI generation'
          : 'Generation failed — try again'}
      </div>`;

  resultsRow.innerHTML = `
    <div class="result-col result-col-single">
      <div class="result-label">AI Try-On Result</div>
      <div class="result-frame">${genFrame}</div>
    </div>
  `;

  downloadBtn.disabled = !entry.generatedImage;
  resultsModal.classList.remove('hidden');
}

modalClose.addEventListener('click', closeModal);
resultsModal.addEventListener('click', e => { if (e.target === resultsModal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function closeModal() { resultsModal.classList.add('hidden'); }

downloadBtn.addEventListener('click', () => {
  if (!state.lastEntry?.generatedImage) return;
  downloadImage(state.lastEntry.generatedImage, 'wearnowai-look.png');
});

tryAgainBtn.addEventListener('click', () => {
  closeModal();
  clearFile('clothingFile', clothingInput, clothingInner, clothingPreview, clothingZone);
  clearFile('personFile', personInput, personInner, personPreview, personZone);
});

// ── UTILITIES ──────────────────────────────────
function relativeTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    { sel: '#clothingCard',  delay: 0    },
    { sel: '.plus-divider',  delay: 0.08 },
    { sel: '#personCard',    delay: 0.16 },
    { sel: '.generate-area', delay: 0    },
    { sel: '.feature-item',  delay: 0, stagger: 0.08 },
    { sel: '.site-footer',   delay: 0    },
  ];

  groups.forEach(({ sel, delay, stagger = 0 }) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('scroll-reveal');
      el.style.transitionDelay = (delay + i * stagger) + 's';
    });
  });

  // Track scroll direction
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
        // Set starting position without transition, then animate in
        el.style.transition = 'none';
        el.classList.remove('in-view', 'from-above');
        if (scrollDir === 'up') el.classList.add('from-above');
        void el.offsetHeight; // force reflow so browser registers start state
        el.style.transition = '';
        el.classList.add('in-view');
      } else {
        // Reset instantly (off-screen, user won't see the jump)
        el.style.transition = 'none';
        el.classList.remove('in-view', 'from-above');
        void el.offsetHeight;
        el.style.transition = '';
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
})();
