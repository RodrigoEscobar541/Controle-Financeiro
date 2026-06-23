import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyB_miYeu3wxE0nI-fYXsUYhHTRvSK86kfA",
  authDomain:        "controle-financeiro-edad2.firebaseapp.com",
  projectId:         "controle-financeiro-edad2",
  storageBucket:     "controle-financeiro-edad2.firebasestorage.app",
  messagingSenderId: "776803882216",
  appId:             "1:776803882216:web:0d3099fdc0bcf02b60655d",
  measurementId:     "G-VZG98G85FM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
