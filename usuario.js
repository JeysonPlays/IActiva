import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ** CONFIGURACIÓN DE FIREBASE **
const firebaseConfig = {
  apiKey: "AIzaSyC7Oy5KlVEvFCcpnsCraXvrItWS6rfFiCc",
  authDomain: "iactiva1.firebaseapp.com",
  projectId: "iactiva1",
  storageBucket: "iactiva1.firebasestorage.app",
  messagingSenderId: "533961740268",
  appId: "1:533961740268:web:9df1be242c7f547d087ac9",
  measurementId: "G-9ZQLEL5ESC",
};

const appId = "iactiva1";

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos de la UI
const mainScreen = document.getElementById("main-screen");
const userGreeting = document.getElementById("user-greeting");
const userSection = document.getElementById("user-section");
const logoutButton = document.getElementById("logout-button");
const userSectionsList = document.getElementById("user-sections-list");
const viewSectionModal = document.getElementById("view-section-modal");
const closeViewSectionModal = document.getElementById(
  "close-view-section-modal"
);
const viewSectionContent = document.getElementById("view-section-content");
// Crear toggles de modo oscuro y rendimiento si no existen (inyectar dinámicamente)
const ensureUIEnhancements = () => {
  if (!document.getElementById("user-mode-toggle")) {
    const container = document.createElement("div");
    container.id = "user-mode-toggle";
    container.style.position = "fixed";
    container.style.right = "1rem";
    container.style.bottom = "1rem";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = ".5rem";
    container.style.zIndex = "70";

    container.innerHTML = `
      <button id="toggle-dark" style="background:linear-gradient(120deg,#2563eb,#3b82f6);color:#fff;padding:.6rem 1rem;border:none;border-radius:14px;font-weight:600;cursor:pointer;box-shadow:0 6px 18px -6px rgba(37,99,235,.55);display:flex;align-items:center;gap:.45rem;font-size:.75rem;" aria-pressed="false">🌙 Activar Modo Oscuro</button>
      <button id="toggle-perf" style="background:linear-gradient(120deg,#ff2d55,#ff8a05);color:#fff;padding:.55rem 1rem;border:none;border-radius:14px;font-weight:600;cursor:pointer;box-shadow:0 6px 18px -6px rgba(255,45,85,.55);display:flex;align-items:center;gap:.45rem;font-size:.75rem;" aria-pressed="false">⚡ Activar Modo Rendimiento</button>
    `;
    document.body.appendChild(container);

    const darkBtn = container.querySelector("#toggle-dark");
    const perfBtn = container.querySelector("#toggle-perf");

    // Restaurar preferencias
    try {
      const darkPref = localStorage.getItem("user-dark-mode");
      if (darkPref === "true") {
        document.body.classList.add("dark-mode");
        darkBtn.textContent = "☀️ Desactivar Modo Oscuro";
        darkBtn.setAttribute("aria-pressed", "true");
      }
      const perfPref = localStorage.getItem("user-perf-lite");
      if (perfPref === "true") {
        document.body.classList.add("perf-lite");
        perfBtn.textContent = "🎨 Desactivar Modo Rendimiento";
        perfBtn.setAttribute("aria-pressed", "true");
      }
    } catch {}

    darkBtn.addEventListener("click", () => {
      const enabled = document.body.classList.toggle("dark-mode");
      darkBtn.textContent = enabled
        ? "☀️ Desactivar Modo Oscuro"
        : "🌙 Activar Modo Oscuro";
      darkBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
      try {
        localStorage.setItem("user-dark-mode", enabled ? "true" : "false");
      } catch {}
    });

    perfBtn.addEventListener("click", () => {
      const enabled = document.body.classList.toggle("perf-lite");
      perfBtn.textContent = enabled
        ? "🎨 Desactivar Modo Rendimiento"
        : "⚡ Activar Modo Rendimiento";
      perfBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
      try {
        localStorage.setItem("user-perf-lite", enabled ? "true" : "false");
      } catch {}
    });
  }
};

let currentUser = null;
let USERS = {};

// Maneja el estado de la autenticación
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "IniciarSesion.html";
    return;
  }

  const usersCollection = collection(
    db,
    `/artifacts/${appId}/public/data/users`
  );
  onSnapshot(usersCollection, (snapshot) => {
    USERS = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      USERS[data.username] = { ...data, id: doc.id };
    });

    const loggedInUsername = sessionStorage.getItem("username");
    if (loggedInUsername && USERS[loggedInUsername]) {
      const currentUserData = USERS[loggedInUsername];
      if (currentUserData.role === "admin") {
        window.location.href = "admin.html"; // Redirigir al admin a su página
      } else {
        showMainScreen(currentUserData);
      }
    } else {
      window.location.href = "IniciarSesion.html";
    }
  });
});

function setupListeners() {
  const temasCollection = collection(
    db,
    `/artifacts/${appId}/public/data/temas`
  );
  onSnapshot(temasCollection, (snapshot) => {
    if (currentUser) {
      renderUserTemas(snapshot.docs);
      const sectionsCollection = collection(
        db,
        `/artifacts/${appId}/public/data/sections`
      );
      onSnapshot(sectionsCollection, (sectionsSnapshot) => {
        renderUserSections(sectionsSnapshot.docs);
      });
    }
  });
}

function showMainScreen(user) {
  currentUser = user;
  mainScreen.classList.remove("hidden");
  userGreeting.textContent = `Bienvenido, ${user.username}`;
  userSection.classList.remove("hidden");
  ensureUIEnhancements();
  setupListeners();
}

function renderUserTemas(docs) {
  userSectionsList.innerHTML = "";
  const accessibleTemas = currentUser.accessibleTemas || [];
  docs.forEach((temaDoc) => {
    if (accessibleTemas.includes(temaDoc.id)) {
      const temaData = temaDoc.data();
      const temaId = temaDoc.id;
      const temaDiv = document.createElement("div");
      temaDiv.id = `user-tema-${temaId}`;
      temaDiv.className = "card p-6";
      temaDiv.innerHTML = `
              <h3 class="text-2xl font-bold mb-4">${temaData.name}</h3>
              <div id="user-sections-list-${temaId}" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                  <!-- Secciones para este tema -->
              </div>
          `;
      userSectionsList.appendChild(temaDiv);
    }
  });
}

function renderUserSections(docs) {
  document.querySelectorAll('[id^="user-sections-list-"]').forEach((list) => {
    list.innerHTML = "";
  });

  docs.forEach((sectionDoc) => {
    const data = sectionDoc.data();
    const temaId = data.temaId;
    const sectionsList = document.getElementById(
      `user-sections-list-${temaId}`
    );

    if (temaId && sectionsList) {
      const div = document.createElement("div");
      div.className =
        "card glass-section rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow";
      div.innerHTML = `
        <div class="user-section-card-img-wrap">
        <img src="${data.imageUrl}" alt="Imagen de la sección ${data.name}" class="user-section-card-img" onerror="this.src='https://placehold.co/400x250/E5E7EB/4B5563?text=Sin+Imagen'; this.onerror=null;">
        </div>
        <div class="p-4">
          <h3 class="text-xl font-bold text-gray-800">${data.name}</h3>
          <p class="text-gray-600 mt-1">${data.description}</p>
        </div>
      `;
      div.addEventListener("click", () => {
        renderViewSectionContent(data.name, data.contentItems);
        viewSectionModal.classList.remove("hidden");
      });
      sectionsList.appendChild(div);
    }
  });
}

function renderViewSectionContent(sectionName, contentItems) {
  viewSectionContent.innerHTML = "";
  const title = document.createElement("h3");
  title.className = "text-2xl font-bold text-center text-red-700 mb-4";
  title.textContent = sectionName;
  viewSectionContent.appendChild(title);

  if (contentItems && contentItems.length > 0) {
    contentItems.forEach((item) => {
      const itemDiv = document.createElement("div");
      // Nuevo estilo inspirado en formulario admin (glass claro/dark adaptable)
      itemDiv.className = "user-content-item";
      itemDiv.innerHTML = `
        <h4>${item.title}</h4>
        <a href=\"${item.url}\" target=\"_blank\" rel=\"noopener noreferrer\">${item.url}</a>
      `;
      viewSectionContent.appendChild(itemDiv);
    });
  } else {
    viewSectionContent.innerHTML += `<p class="text-center text-gray-500 mt-4">No hay contenido en esta sección todavía.</p>`;
  }
}

closeViewSectionModal.addEventListener("click", () => {
  viewSectionModal.classList.add("hidden");
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    sessionStorage.removeItem("username");
    window.location.href = "IniciarSesion.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
});
