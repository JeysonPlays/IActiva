import { auth, db, appId } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
// Progreso global
const progressSummaryBar = document.getElementById("progress-summary-bar");
const progressSummaryLabel = document.getElementById("progress-summary-label");
const progressHeaderChip = document.getElementById("progress-header-chip");

let currentUser = null;
let USERS = {};

// Estado de progreso (local)
// seen: Set con claves `${sectionId}:${index}`
// perSectionTotals: Map<sectionId, totalItems>
const userProgress = {
  seen: new Set(),
  perSectionTotals: new Map(),
};

// Ref de progreso en Firestore por usuario
const userProgressDocRef = (userId) =>
  doc(db, `/artifacts/${appId}/public/data/userProgress`, userId);

async function loadUserProgress(userId) {
  const ref = userProgressDocRef(userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    userProgress.seen = new Set(Array.isArray(data.seen) ? data.seen : []);
  } else {
    await setDoc(ref, { seen: [] }, { merge: true });
    userProgress.seen = new Set();
  }
}

async function toggleSeen(userId, sectionId, index, checked) {
  const key = `${sectionId}:${index}`;
  const ref = userProgressDocRef(userId);
  const snap = await getDoc(ref);
  const seenArr =
    snap.exists() && Array.isArray(snap.data().seen) ? snap.data().seen : [];
  let newSeen = seenArr;
  if (checked) {
    if (!newSeen.includes(key)) newSeen = [...newSeen, key];
    userProgress.seen.add(key);
  } else {
    newSeen = newSeen.filter((k) => k !== key);
    userProgress.seen.delete(key);
  }
  await updateDoc(ref, { seen: newSeen });
  updateGlobalProgressUI();
  const badge = document.querySelector(
    `[data-section-progress-label="${sectionId}"]`
  );
  const bar = document.querySelector(
    `[data-section-progress-bar="${sectionId}"]`
  );
  updateSectionProgressUI(sectionId, badge, bar);
}

function calcSectionProgress(sectionId) {
  const total = userProgress.perSectionTotals.get(sectionId) || 0;
  if (total === 0) return { done: 0, total: 0, pct: 0 };
  let done = 0;
  for (let i = 0; i < total; i++) {
    if (userProgress.seen.has(`${sectionId}:${i}`)) done++;
  }
  const pct = Math.round((done / total) * 100);
  return { done, total, pct };
}

function updateSectionProgressUI(sectionId, labelEl, barEl) {
  const { done, total, pct } = calcSectionProgress(sectionId);
  if (labelEl) labelEl.textContent = `${done} / ${total} (${pct}%)`;
  if (barEl) barEl.style.width = `${pct}%`;
}

function updateGlobalProgressUI() {
  // Contar solo claves vistas que correspondan a secciones actuales registradas en perSectionTotals
  let total = 0;
  let done = 0;
  userProgress.perSectionTotals.forEach((sectionTotal, sectionId) => {
    total += sectionTotal;
    for (let i = 0; i < sectionTotal; i++) {
      if (userProgress.seen.has(`${sectionId}:${i}`)) done++;
    }
  });
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  if (progressSummaryBar) progressSummaryBar.style.width = `${pct}%`;
  if (progressSummaryLabel)
    progressSummaryLabel.textContent = `${done} de ${total} (${pct}%)`;
  if (progressHeaderChip)
    progressHeaderChip.textContent = `${pct}% (${done}/${total})`;
}

async function markAllInSection(userId, sectionId) {
  const total = userProgress.perSectionTotals.get(sectionId) || 0;
  if (total <= 0) return;
  const ref = userProgressDocRef(userId);
  const snap = await getDoc(ref);
  const seenArr =
    snap.exists() && Array.isArray(snap.data().seen) ? snap.data().seen : [];
  const keysToAdd = [];
  for (let i = 0; i < total; i++) {
    const key = `${sectionId}:${i}`;
    if (!seenArr.includes(key)) {
      keysToAdd.push(key);
      userProgress.seen.add(key);
    }
  }
  if (keysToAdd.length > 0) {
    const newSeen = [...seenArr, ...keysToAdd];
    await updateDoc(ref, { seen: newSeen });
  }
  // refrescar UI
  const badge = document.querySelector(
    `[data-section-progress-label="${sectionId}"]`
  );
  const bar = document.querySelector(
    `[data-section-progress-bar="${sectionId}"]`
  );
  updateSectionProgressUI(sectionId, badge, bar);
  updateGlobalProgressUI();
}

async function clearAllInSection(userId, sectionId) {
  const total = userProgress.perSectionTotals.get(sectionId) || 0;
  const ref = userProgressDocRef(userId);
  const snap = await getDoc(ref);
  const seenArr =
    snap.exists() && Array.isArray(snap.data().seen) ? snap.data().seen : [];
  const keysToRemove = new Set();
  for (let i = 0; i < total; i++) {
    keysToRemove.add(`${sectionId}:${i}`);
  }
  const newSeen = seenArr.filter((k) => !keysToRemove.has(k));
  await updateDoc(ref, { seen: newSeen });
  // actualizar set local
  keysToRemove.forEach((k) => userProgress.seen.delete(k));
  const badge = document.querySelector(
    `[data-section-progress-label="${sectionId}"]`
  );
  const bar = document.querySelector(
    `[data-section-progress-bar="${sectionId}"]`
  );
  updateSectionProgressUI(sectionId, badge, bar);
  updateGlobalProgressUI();
}

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
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      USERS[data.username] = { ...data, id: docSnap.id };
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
  // Cargar progreso del usuario y luego listeners de contenido
  loadUserProgress(user.id).then(() => {
    setupListeners();
  });
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
              <h3 class=\"text-2xl font-bold mb-4\">${temaData.name}</h3>
              <div id=\"user-sections-list-${temaId}\" class=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4\"></div>
          `;
      userSectionsList.appendChild(temaDiv);
    }
  });
}

function renderUserSections(docs) {
  // Limpiar totales anteriores para reflejar snapshot actual
  userProgress.perSectionTotals.clear();
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
      const sectionId = sectionDoc.id;
      const div = document.createElement("div");
      div.className =
        "card glass-section rounded-2xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow";
      div.innerHTML = `
        <div class=\"user-section-card-img-wrap\">
        <img src=\"${data.imageUrl}\" alt=\"Imagen de la sección ${data.name}\" class=\"user-section-card-img\" onerror=\"this.src='https://placehold.co/400x250/E5E7EB/4B5563?text=Sin+Imagen'; this.onerror=null;\">
        </div>
        <div class=\"p-4\">
          <div class=\"flex items-start justify-between gap-3\">
            <div>
              <h3 class=\"text-xl font-bold text-gray-800\">${data.name}</h3>
              <p class=\"text-gray-600 mt-1\">${data.description}</p>
            </div>
            <div class=\"min-w-[140px] text-right\">
              <span class=\"progress-badge\" data-section-progress-label=\"${sectionId}\">0 / 0 (0%)</span>
              <div class=\"progress mt-2\">
                <div class=\"progress-bar\" data-section-progress-bar=\"${sectionId}\" style=\"width:0%\"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      div.addEventListener("click", () => {
        renderViewSectionContent(sectionId, data.name, data.contentItems);
        viewSectionModal.classList.remove("hidden");
      });
      sectionsList.appendChild(div);

      // Registrar totales para cálculo de progreso
      const totalItems = Array.isArray(data.contentItems)
        ? data.contentItems.length
        : 0;
      userProgress.perSectionTotals.set(sectionId, totalItems);
      const labelEl = div.querySelector(
        `[data-section-progress-label=\"${sectionId}\"]`
      );
      const barEl = div.querySelector(
        `[data-section-progress-bar=\"${sectionId}\"]`
      );
      updateSectionProgressUI(sectionId, labelEl, barEl);
      updateGlobalProgressUI();
    }
  });
}

function renderViewSectionContent(sectionId, sectionName, contentItems) {
  viewSectionContent.innerHTML = "";
  const title = document.createElement("h3");
  title.className = "text-2xl font-bold text-center text-red-700 mb-4";
  title.textContent = sectionName;
  viewSectionContent.appendChild(title);

  // Acciones rápidas de progreso
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  actions.innerHTML = `
    <button id="mark-all-btn" class="btn-light" title="Marcar todos los items como vistos">Marcar todo visto</button>
    <button id="clear-all-btn" class="btn-light" title="Quitar visto de todos los items">Limpiar vistos</button>
  `;
  viewSectionContent.appendChild(actions);

  if (contentItems && contentItems.length > 0) {
    contentItems.forEach((item, index) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "user-content-item";
      const key = `${sectionId}:${index}`;
      const checked = userProgress.seen.has(key) ? "checked" : "";
      itemDiv.innerHTML = `
        <div class=\"flex items-start justify-between gap-3\">
          <div>
            <h4>${item.title}</h4>
            <a href=\"${item.url}\" target=\"_blank\" rel=\"noopener noreferrer\">${item.url}</a>
          </div>
          <label class=\"inline-flex items-center gap-2 select-none\">
            <input type=\"checkbox\" class=\"seen-toggle\" data-section-id=\"${sectionId}\" data-index=\"${index}\" ${checked} />
            <span class=\"seen-label\">Visto</span>
          </label>
        </div>
      `;
      viewSectionContent.appendChild(itemDiv);
    });

    // Listeners acciones rápidas
    const markAllBtn = document.getElementById("mark-all-btn");
    const clearAllBtn = document.getElementById("clear-all-btn");
    if (markAllBtn) {
      markAllBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (currentUser) {
          await markAllInSection(currentUser.id, sectionId);
          // actualizar checkboxes del modal
          viewSectionContent
            .querySelectorAll("input.seen-toggle")
            .forEach((cb) => (cb.checked = true));
        }
      });
    }
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (currentUser) {
          await clearAllInSection(currentUser.id, sectionId);
          viewSectionContent
            .querySelectorAll("input.seen-toggle")
            .forEach((cb) => (cb.checked = false));
        }
      });
    }

    // Listeners de toggles
    viewSectionContent
      .querySelectorAll("input.seen-toggle")
      .forEach((checkbox) => {
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
        });
        checkbox.addEventListener("change", async (e) => {
          const sid = e.target.getAttribute("data-section-id");
          const idx = parseInt(e.target.getAttribute("data-index"));
          const isChecked = e.target.checked;
          if (currentUser) {
            await toggleSeen(currentUser.id, sid, idx, isChecked);
          }
        });
      });
  } else {
    viewSectionContent.innerHTML += `<p class=\"text-center text-gray-500 mt-4\">No hay contenido en esta sección todavía.</p>`;
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
