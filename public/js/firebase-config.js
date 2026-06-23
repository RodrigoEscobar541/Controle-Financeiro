// ================================================================
// CONFIGURE AQUI: Cole as credenciais do seu projeto Firebase
// Console Firebase → Configurações do Projeto → Seus Apps → Web
// ================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJECT_ID.firebaseapp.com",
  projectId:         "SEU_PROJECT_ID",
  storageBucket:     "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId:             "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
