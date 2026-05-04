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
const shareBtn        = $('shareBtn');
const downloadBtn     = $('downloadBtn');
const tryAgainBtn     = $('tryAgainBtn');

const galleryGrid     = $('galleryGrid');
const galleryEmpty    = $('galleryEmpty');
const studioSection   = $('section-studio');
const gallerySection  = $('section-gallery');

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

$('goToStudio')?.addEventListener('click', () => switchSection('studio'));

function switchSection(name) {
  studioSection.classList.toggle('hidden', name !== 'studio');
  gallerySection.classList.toggle('hidden', name !== 'gallery');
  if (name === 'gallery') loadGallery();
}

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

  setLoading(true);

  try {
    const form = new FormData();
    form.append('clothingPhoto', state.clothingFile);
    form.append('userPhoto', state.personFile);
    form.append('userName', userNameInput.value.trim() || 'Anonymous');

    const res = await fetch('/api/generate', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Generation failed');

    state.lastEntry = data.entry;
    showToast(data.message);
    openModal(data.entry);

  } catch (err) {
    showToast('Error: ' + err.message);
    console.error(err);
  } finally {
    setLoading(false);
  }
});

function setLoading(on) {
  generateBtn.disabled = on;
  btnText.classList.toggle('hidden', on);
  btnSpinner.classList.toggle('hidden', !on);
  generateHint.textContent = on
    ? 'Analyzing your photos and generating your look…'
    : (state.clothingFile && state.personFile ? 'Ready! Click Generate to create your AI look' : 'Upload both photos to continue');
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
    <div class="result-col">
      <div class="result-label">Your Photo</div>
      <div class="result-frame"><img src="${entry.userPhoto}" alt="You" /></div>
    </div>
    <div class="result-col">
      <div class="result-label">Clothing</div>
      <div class="result-frame"><img src="${entry.clothingPhoto}" alt="Clothing" /></div>
    </div>
    <div class="result-col">
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

shareBtn.addEventListener('click', () => {
  closeModal();
  switchSection('gallery');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === 'gallery'));
  showToast('Shared to gallery!');
});

downloadBtn.addEventListener('click', () => {
  if (!state.lastEntry?.generatedImage) return;
  downloadImage(state.lastEntry.generatedImage, 'wearnowai-look.png');
});

tryAgainBtn.addEventListener('click', () => {
  closeModal();
  clearFile('clothingFile', clothingInput, clothingInner, clothingPreview, clothingZone);
  clearFile('personFile', personInput, personInner, personPreview, personZone);
});

// ── GALLERY ────────────────────────────────────
async function loadGallery() {
  try {
    const res = await fetch('/api/gallery');
    const entries = await res.json();

    if (!entries.length) {
      galleryGrid.innerHTML = '';
      galleryEmpty.classList.remove('hidden');
      return;
    }

    galleryEmpty.classList.add('hidden');
    galleryGrid.innerHTML = entries.map(e => {
      const hasAI = !!e.generatedImage;
      const time = relativeTime(e.timestamp);
      return `
        <div class="gallery-card">
          <div class="gallery-images">
            <div class="gallery-img-cell">
              <img src="${e.userPhoto}" alt="User" loading="lazy" />
              <div class="cell-label">Photo</div>
            </div>
            <div class="gallery-img-cell">
              ${hasAI
                ? `<img src="${e.generatedImage}" alt="AI Look" loading="lazy" />`
                : `<div class="gallery-img-placeholder">🤖</div>`}
              <div class="cell-label">${hasAI ? 'AI Look' : 'Clothing'}</div>
            </div>
          </div>
          <div class="gallery-card-info">
            <div class="gallery-name">${escHtml(e.userName)}</div>
            <div class="gallery-meta">
              <span class="gallery-time">${time}</span>
              ${hasAI ? '<span class="gallery-ai-badge">AI Generated</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    galleryGrid.innerHTML = `<p style="color:#999;padding:24px">Could not load gallery.</p>`;
  }
}

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
