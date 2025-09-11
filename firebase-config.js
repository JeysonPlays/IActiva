// Importa las funciones que necesitas de los SDKs que necesitas
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC7Oy5KlVEvFCcpnsCraXvrItWS6rfFiCc",
  authDomain: "iactiva1.firebaseapp.com",
  projectId: "iactiva1",
  storageBucket: "iactiva1.firebasestorage.app",
  messagingSenderId: "533961740268",
  appId: "1:533961740268:web:9df1be242c7f547d087ac9",
  measurementId: "G-9ZQLEL5ESC",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "iactiva1";

export { app, auth, db, appId };
