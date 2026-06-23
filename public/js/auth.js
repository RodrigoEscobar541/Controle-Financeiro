import { auth } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const isLoginPage = !!document.getElementById('login-form');
const isAppPage   = !!document.getElementById('logout-btn');

// ──────────────────────────────────────────────
// PÁGINA DE LOGIN
// ──────────────────────────────────────────────
if (isLoginPage) {
  // Redireciona se já estiver autenticado
  onAuthStateChanged(auth, user => {
    if (user) window.location.href = 'app.html';
  });

  const form    = document.getElementById('login-form');
  const errEl   = document.getElementById('error-message');
  const loginBtn= document.getElementById('login-btn');
  const loginTxt= document.getElementById('login-text');
  const spinner = document.getElementById('login-spinner');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    errEl.classList.add('hidden');
    loginBtn.disabled = true;
    loginTxt.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = 'app.html';
    } catch {
      errEl.textContent = 'E-mail ou senha incorretos. Verifique e tente novamente.';
      errEl.classList.remove('hidden');
      loginBtn.disabled = false;
      loginTxt.classList.remove('hidden');
      spinner.classList.add('hidden');
    }
  });
}

// ──────────────────────────────────────────────
// PÁGINA DO APP
// ──────────────────────────────────────────────
if (isAppPage) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    const emailEl = document.getElementById('user-email-sidebar');
    if (emailEl) emailEl.textContent = user.email;
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

export { auth, onAuthStateChanged };
