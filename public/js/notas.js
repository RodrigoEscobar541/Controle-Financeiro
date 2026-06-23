import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function initNotas(sectionId) {
  const textarea = document.getElementById(`notas-${sectionId}`);
  const statusEl = document.getElementById(`notas-status-${sectionId}`);
  if (!textarea) return;

  try {
    const snap = await getDoc(doc(db, 'notas', sectionId));
    if (snap.exists()) textarea.value = snap.data().texto || '';
  } catch { /* sem notas ainda */ }

  let timer = null;

  textarea.addEventListener('input', () => {
    clearTimeout(timer);
    statusEl.textContent = '';
    statusEl.className = 'notas-status';
    timer = setTimeout(async () => {
      statusEl.textContent = 'Salvando…';
      try {
        await setDoc(doc(db, 'notas', sectionId), { texto: textarea.value });
        statusEl.textContent = 'Salvo ✓';
        statusEl.className = 'notas-status saved';
        setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'notas-status'; }, 2000);
      } catch {
        statusEl.textContent = 'Erro ao salvar';
        statusEl.className = 'notas-status error';
      }
    }, 1500);
  });
}
