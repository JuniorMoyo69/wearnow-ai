/* WearNowai — Auth page */

const $ = id => document.getElementById(id);

// Redirect to app if already logged in
(async () => {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) window.location.replace('/');
  } catch {}
})();

// ── TAB SWITCHING ──────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    $('loginForm').classList.toggle('hidden', !isLogin);
    $('registerForm').classList.toggle('hidden', isLogin);
    $('loginError').classList.add('hidden');
    $('registerError').classList.add('hidden');
  });
});

// ── PASSWORD VISIBILITY TOGGLE ─────────────────
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.querySelector('.eye-open').classList.toggle('hidden', !isText);
    btn.querySelector('.eye-closed').classList.toggle('hidden', isText);
  });
});

// ── LOGIN ──────────────────────────────────────
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('loginBtn');
  const errEl = $('loginError');
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  if (!email || !password) return showError(errEl, 'Please fill in all fields.');

  setLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    window.location.replace('/');
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── REGISTER ───────────────────────────────────
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('registerBtn');
  const errEl = $('registerError');
  const username = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const password = $('regPassword').value;

  if (!username || !email || !password) return showError(errEl, 'Please fill in all fields.');
  if (password.length < 6) return showError(errEl, 'Password must be at least 6 characters.');

  setLoading(btn, true);
  errEl.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    window.location.replace('/');
  } catch (err) {
    showError(errEl, err.message);
  } finally {
    setLoading(btn, false);
  }
});

// ── HELPERS ────────────────────────────────────
function setLoading(btn, on) {
  btn.disabled = on;
  btn.querySelector('.btn-text').classList.toggle('hidden', on);
  btn.querySelector('.btn-spinner').classList.toggle('hidden', !on);
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}
