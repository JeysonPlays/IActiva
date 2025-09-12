import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Centraliza app/auth/db/appId desde firebase-config.js
import { auth, db, appId } from "./firebase-config.js";

// Elementos de la UI
const mainScreen = document.getElementById("main-screen");
const userGreeting = document.getElementById("user-greeting");
const adminSection = document.getElementById("admin-section");
const logoutButton = document.getElementById("logout-button");
const userAdminButton = document.getElementById("user-admin-button");
const userAdminModal = document.getElementById("user-admin-modal");
const closeModalButton = document.getElementById("close-modal-button");
const userList = document.getElementById("user-list");
const createUserForm = document.getElementById("create-user-form");
const newUsernameInput = document.getElementById("new-username");
const newPasswordInput = document.getElementById("new-password");
const createTemaButton = document.getElementById("create-tema-button");
const temasList = document.getElementById("temas-list");

// Modales y sus elementos
const userConfirmModal = document.getElementById("user-confirm-modal");
const userConfirmMessage = document.getElementById("user-confirm-message");
const userConfirmYes = document.getElementById("user-confirm-yes");
const userConfirmNo = document.getElementById("user-confirm-no");
const userPasswordModal = document.getElementById("user-password-modal");
const newPasswordModalInput = document.getElementById(
  "new-password-modal-input"
);
const savePasswordButton = document.getElementById("save-password-button");
const closePasswordModal = document.getElementById("close-password-modal");
const addContentModal = document.getElementById("add-content-modal");
const closeContentModal = document.getElementById("close-content-modal");
const addContentForm = document.getElementById("add-content-form");
const contentTitleInput = document.getElementById("content-title");
const contentUrlInput = document.getElementById("content-url");
const sectionContentList = document.getElementById("section-content-list");
const editContentModal = document.getElementById("edit-content-modal");
const closeEditContentModal = document.getElementById(
  "close-edit-content-modal"
);
const editContentForm = document.getElementById("edit-content-form");
const editContentTitleInput = document.getElementById("edit-content-title");
const editContentUrlInput = document.getElementById("edit-content-url");
const sectionModal = document.getElementById("section-modal");
const sectionModalTitle = document.getElementById("section-modal-title");
const sectionForm = document.getElementById("section-form");
const sectionNameInput = document.getElementById("section-name");
const sectionDescriptionInput = document.getElementById("section-description");
const sectionImageInput = document.getElementById("section-image");
const closeSectionModalBtn = document.getElementById("close-section-modal");
const editTemaModal = document.getElementById("edit-tema-modal");
const closeEditTemaModal = document.getElementById("close-edit-tema-modal");
const editTemaForm = document.getElementById("edit-tema-form");
const editTemaNameInput = document.getElementById("edit-tema-name");

let currentUser = null;
let USERS = {};
let pendingUserAction = null;
let isMainScreenShown = false;
let unsubscribeTemas = null;
let unsubscribeSections = null;
let latestSectionsDocs = [];
// Cache de elementos DOM de temas para diff incremental
const temaNodeCache = new Map(); // key: temaId, value: {rootDiv, name}

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
    if (!isMainScreenShown) {
      if (loggedInUsername && USERS[loggedInUsername]) {
        const currentUserData = USERS[loggedInUsername];
        if (currentUserData.role !== "admin") {
          window.location.href = "usuario.html"; // Redirigir a la página de usuario
        } else {
          showMainScreen(currentUserData);
        }
      } else {
        window.location.href = "IniciarSesion.html";
      }
    }
  });
});

function setupListeners() {
  if (unsubscribeTemas) unsubscribeTemas();
  if (unsubscribeSections) unsubscribeSections();

  const temasCollection = collection(
    db,
    `/artifacts/${appId}/public/data/temas`
  );
  unsubscribeTemas = onSnapshot(temasCollection, (snapshot) => {
    if (!currentUser) return;
    const newIds = new Set();

    snapshot.docs.forEach((temaDoc) => {
      const temaData = temaDoc.data();
      const temaId = temaDoc.id;
      newIds.add(temaId);

      const cached = temaNodeCache.get(temaId);
      if (!cached) {
        // Crear nuevo nodo
        const temaDiv = document.createElement("div");
        temaDiv.id = temaId;
        temaDiv.className = "card p-6 fade-in";
        temaDiv.innerHTML = `
          <div class="flex justify-between items-center">
              <h3 class="text-xl font-bold">${temaData.name}</h3>
              <div>
                <button data-id="${temaId}" class="edit-tema-btn bg-yellow-500 text-white px-3 py-1 rounded-full text-sm hover:bg-yellow-600 transition-colors mr-2">Editar</button>
                <button data-id="${temaId}" class="delete-tema-btn bg-red-500 text-white px-3 py-1 rounded-full text-sm hover:bg-red-600 transition-colors">Eliminar Tema</button>
              </div>
          </div>
          <div class="mt-4">
            <button data-tema-id="${temaId}" class="create-section-button bg-red-600 text-white py-2 px-6 rounded-full hover:bg-red-700 transition-colors">
              Crear Nueva Sección
            </button>
          </div>
          <div id="sections-list-${temaId}" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4"></div>
        `;
        temasList.appendChild(temaDiv);
        temaNodeCache.set(temaId, { rootDiv: temaDiv, name: temaData.name });
      } else if (cached.name !== temaData.name) {
        // Actualizar solo el nombre
        const h3 = cached.rootDiv.querySelector("h3");
        if (h3) h3.textContent = temaData.name;
        cached.name = temaData.name;
      }
    });

    // Eliminar temas que ya no existen
    [...temaNodeCache.keys()].forEach((existingId) => {
      if (!newIds.has(existingId)) {
        const cached = temaNodeCache.get(existingId);
        if (cached && cached.rootDiv.parentNode) {
          cached.rootDiv.parentNode.removeChild(cached.rootDiv);
        }
        temaNodeCache.delete(existingId);
      }
    });

    // Re-render secciones si ya estaban cargadas
    if (latestSectionsDocs.length) renderAdminSections(latestSectionsDocs);
  });

  const sectionsCollection = collection(
    db,
    `/artifacts/${appId}/public/data/sections`
  );
  unsubscribeSections = onSnapshot(sectionsCollection, (sectionsSnapshot) => {
    latestSectionsDocs = sectionsSnapshot.docs;
    renderAdminSections(sectionsSnapshot.docs);
  });
}

function showMainScreen(user) {
  currentUser = user;
  mainScreen.classList.remove("hidden");
  userGreeting.textContent = `Bienvenido, ${user.username}`;
  adminSection.classList.remove("hidden");
  userAdminButton.classList.remove("hidden");
  // (El modo rendimiento se ha eliminado; ya no se restaura preferencia)
  if (!isMainScreenShown) {
    setupListeners();
    isMainScreenShown = true;
  }
}

// (Listener de modo rendimiento eliminado)

createTemaButton.addEventListener("click", () => {
  const temaId = `tema-creation-${Date.now()}`;
  const temaDiv = document.createElement("div");
  temaDiv.id = temaId;
  temaDiv.className = "card p-6";
  temaDiv.innerHTML = `
    <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">Nuevo Tema</h3>
        <div>
            <button class="cancel-tema-creation bg-gray-500 text-white px-3 py-1 rounded-full text-sm hover:bg-gray-600 transition-colors">Cancelar</button>
        </div>
    </div>
    <div class="mt-4">
        <label for="tema-name-${temaId}" class="block text-gray-700 text-sm">Nombre del Tema:</label>
        <input type="text" id="tema-name-${temaId}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm px-3 py-2">
        <button class="create-tema-confirm mt-2 bg-green-600 text-white py-2 px-4 rounded-full hover:bg-green-700 transition-colors">Crear Tema</button>
    </div>
  `;
  temasList.prepend(temaDiv);

  temaDiv
    .querySelector(".cancel-tema-creation")
    .addEventListener("click", () => {
      temaDiv.remove();
    });

  temaDiv
    .querySelector(".create-tema-confirm")
    .addEventListener("click", async () => {
      const temaNameInput = document.getElementById(`tema-name-${temaId}`);
      const temaName = temaNameInput.value;
      if (temaName) {
        try {
          await addDoc(
            collection(db, `/artifacts/${appId}/public/data/temas`),
            {
              name: temaName,
            }
          );
          temaDiv.remove(); // Remove the creation form
        } catch (e) {
          console.error("Error creating tema: ", e);
        }
      }
    });
});

// Performance Notes:
// - Se usa diff incremental para temas y secciones evitando reconstruir grandes fragmentos del DOM.
// - Delegación de eventos sobre 'temasList' reduce el número de listeners individuales.
// - Modo 'perf-lite' desactiva animaciones y efectos de blur costosos en dispositivos lentos.
// - Se cachea la estructura de temas en 'temaNodeCache' para actualizaciones puntuales.

let currentEditingTemaId = null;

function showEditTemaModal(temaId, temaName) {
  currentEditingTemaId = temaId;
  editTemaNameInput.value = temaName;
  editTemaModal.classList.remove("hidden");
}

closeEditTemaModal.addEventListener("click", () => {
  editTemaModal.classList.add("hidden");
});

editTemaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newTemaName = editTemaNameInput.value;
  if (currentEditingTemaId && newTemaName) {
    try {
      const temaRef = doc(
        db,
        `/artifacts/${appId}/public/data/temas`,
        currentEditingTemaId
      );
      await updateDoc(temaRef, { name: newTemaName });
      editTemaModal.classList.add("hidden");

      // Update the theme name directly in the DOM
      const temaDiv = document.getElementById(currentEditingTemaId);
      if (temaDiv) {
        const h3Element = temaDiv.querySelector("h3");
        if (h3Element) {
          h3Element.textContent = newTemaName;
        }
      }
    } catch (error) {
      console.error("Error updating tema name: ", error);
    }
  }
});

function renderAdminSections(docs) {
  // Agrupar secciones por tema
  const byTema = new Map();
  docs.forEach((d) => {
    const data = d.data();
    if (!byTema.has(data.temaId)) byTema.set(data.temaId, []);
    byTema.get(data.temaId).push({ id: d.id, data });
  });

  byTema.forEach((sections, temaId) => {
    const container = document.getElementById(`sections-list-${temaId}`);
    if (!container) return;

    // Diff: crear mapa actual
    const existing = new Map();
    Array.from(container.children).forEach((child) => {
      const sid = child.dataset.sectionId;
      if (sid) existing.set(sid, child);
    });

    const newIds = new Set();
    sections.forEach(({ id, data }) => {
      newIds.add(id);
      if (existing.has(id)) {
        // Actualizar solo si cambia nombre o descripción o imagen
        const node = existing.get(id);
        const titleEl = node.querySelector("h3");
        if (titleEl && titleEl.textContent !== data.name)
          titleEl.textContent = data.name;
        const pEl = node.querySelector("p");
        if (pEl && pEl.textContent !== data.description)
          pEl.textContent = data.description;
        const imgEl = node.querySelector("img");
        if (imgEl && imgEl.getAttribute("src") !== data.imageUrl)
          imgEl.setAttribute("src", data.imageUrl);
      } else {
        // Crear nuevo
        const div = document.createElement("div");
        div.dataset.sectionId = id;
        div.className =
          "card glass-section rounded-2xl shadow-lg overflow-hidden transition-shadow hover:shadow-2xl fade-in";
        div.innerHTML = `
          <div class="section-card-img-wrap">
            <img src="${data.imageUrl}" alt="Imagen de la sección ${data.name}" class="section-card-img" onerror="this.src='https://placehold.co/400x250/E5E7EB/4B5563?text=Sin+Imagen'; this.onerror=null;">
          </div>
          <div class="p-4">
            <h3 class="text-xl font-bold text-gray-800 mb-1">${data.name}</h3>
            <p class="text-gray-600 text-sm leading-relaxed">${data.description}</p>
            <div class="mt-4 btn-group pt-2 border-t border-gray-200">
              <button data-id="${id}" class="add-content-btn btn-base btn-red btn-sm btn-pill">Agregar Contenido</button>
              <button data-id="${id}" class="edit-section-btn btn-base btn-yellow btn-sm btn-pill">Editar</button>
              <button data-id="${id}" class="delete-section-btn btn-base btn-gray btn-sm btn-pill">Eliminar</button>
            </div>
          </div>`;
        container.appendChild(div);
      }
    });

    // Eliminar secciones que ya no existen
    existing.forEach((node, id) => {
      if (!newIds.has(id)) node.remove();
    });
  });
}

// Delegación de eventos para acciones dentro de temas/secciones
temasList.addEventListener("click", async (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  // Editar Tema
  if (target.classList.contains("edit-tema-btn")) {
    const temaId = target.dataset.id;
    if (temaId) {
      const temaDataSnap = await getDoc(
        doc(db, `/artifacts/${appId}/public/data/temas`, temaId)
      );
      if (temaDataSnap.exists()) {
        showEditTemaModal(temaId, temaDataSnap.data().name);
      }
    }
  }

  // Eliminar Tema
  else if (target.classList.contains("delete-tema-btn")) {
    const temaId = target.dataset.id;
    if (temaId) {
      await deleteDoc(doc(db, `/artifacts/${appId}/public/data/temas`, temaId));
    }
  }

  // Crear Sección (abrir modal)
  else if (target.classList.contains("create-section-button")) {
    const temaId = target.dataset.temaId;
    showSectionModal(null, null, temaId);
  }

  // Agregar Contenido
  else if (target.classList.contains("add-content-btn")) {
    const sectionId = target.dataset.id;
    addContentModal.dataset.sectionId = sectionId;
    renderSectionContentList(sectionId);
    addContentModal.classList.remove("hidden");
  }

  // Editar Sección
  else if (target.classList.contains("edit-section-btn")) {
    const sectionId = target.dataset.id;
    const sectionRef = doc(
      db,
      `/artifacts/${appId}/public/data/sections`,
      sectionId
    );
    const sectionDoc = await getDoc(sectionRef);
    if (sectionDoc.exists()) {
      showSectionModal(sectionDoc.data(), sectionId, sectionDoc.data().temaId);
    }
  }

  // Eliminar Sección
  else if (target.classList.contains("delete-section-btn")) {
    const sectionId = target.dataset.id;
    const sectionRef = doc(
      db,
      `/artifacts/${appId}/public/data/sections`,
      sectionId
    );
    await deleteDoc(sectionRef);
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    // Limpia suscripciones antes de salir
    if (unsubscribeTemas) {
      unsubscribeTemas();
      unsubscribeTemas = null;
    }
    if (unsubscribeSections) {
      unsubscribeSections();
      unsubscribeSections = null;
    }
    await signOut(auth); // Cierra la sesión de Firebase
    sessionStorage.removeItem("username");
    window.location.href = "IniciarSesion.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
});

// Sección Formulario y Modal
closeSectionModalBtn.addEventListener("click", () =>
  sectionModal.classList.add("hidden")
);

function showSectionModal(sectionData = null, docId = null, temaId = null) {
  sectionForm.reset();
  sectionForm.dataset.docId = "";
  sectionForm.dataset.temaId = "";

  if (sectionData && docId) {
    sectionModalTitle.textContent = "Editar Sección";
    sectionNameInput.value = sectionData.name;
    sectionDescriptionInput.value = sectionData.description;
    sectionImageInput.value = sectionData.imageUrl;
    sectionForm.dataset.docId = docId;
  } else {
    sectionModalTitle.textContent = "Crear Nueva Sección";
  }

  if (temaId) {
    sectionForm.dataset.temaId = temaId;
  }
  sectionModal.classList.remove("hidden");
}

sectionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const docId = sectionForm.dataset.docId;
  const temaId = sectionForm.dataset.temaId;
  const name = sectionNameInput.value;
  const description = sectionDescriptionInput.value;
  const imageUrl = sectionImageInput.value;

  try {
    if (docId) {
      const sectionRef = doc(
        db,
        `/artifacts/${appId}/public/data/sections`,
        docId
      );
      await updateDoc(sectionRef, { name, description, imageUrl });
    } else {
      await addDoc(collection(db, `/artifacts/${appId}/public/data/sections`), {
        name: name,
        description: description,
        imageUrl: imageUrl,
        contentItems: [],
        temaId: temaId,
      });
    }
    sectionModal.classList.add("hidden");
    sectionForm.reset();
  } catch (e) {
    console.error("Error creating/updating section: ", e);
  }
});

addContentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const sectionId = addContentModal.dataset.sectionId;
  const title = contentTitleInput.value;
  const url = contentUrlInput.value;

  if (sectionId && title && url) {
    try {
      const sectionRef = doc(
        db,
        `/artifacts/${appId}/public/data/sections`,
        sectionId
      );
      const sectionDoc = await getDoc(sectionRef);
      const currentItems = sectionDoc.data().contentItems || [];

      const newItems = [...currentItems, { title, url }];
      await updateDoc(sectionRef, { contentItems: newItems });

      contentTitleInput.value = "";
      contentUrlInput.value = "";
      renderSectionContentList(sectionId);
    } catch (e) {
      console.error("Error adding content: ", e);
    }
  }
});

async function renderSectionContentList(sectionId) {
  sectionContentList.innerHTML = "";
  const sectionRef = doc(
    db,
    `/artifacts/${appId}/public/data/sections`,
    sectionId
  );
  const sectionDoc = await getDoc(sectionRef);
  const contentItems = sectionDoc.data().contentItems || [];

  if (contentItems.length > 0) {
    contentItems.forEach((item, index) => {
      const li = document.createElement("li");
      li.className =
        "flex justify-between items-center bg-gray-100 p-2 rounded-md shadow-sm";
      li.innerHTML = `
                  <span>${item.title}</span>
                  <div class="flex space-x-2">
                      <button class="edit-content-btn bg-yellow-500 text-white px-2 py-1 rounded-md text-sm hover:bg-yellow-600 transition-colors" data-index="${index}">Editar</button>
                      <button class="delete-content-btn bg-red-500 text-white px-2 py-1 rounded-md text-sm hover:bg-red-600 transition-colors" data-index="${index}">Eliminar</button>
                  </div>
              `;
      sectionContentList.appendChild(li);
    });

    document.querySelectorAll(".edit-content-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const indexToEdit = parseInt(e.target.dataset.index);
        const sectionId = addContentModal.dataset.sectionId;
        const sectionRef = doc(
          db,
          `/artifacts/${appId}/public/data/sections`,
          sectionId
        );
        const sectionDoc = await getDoc(sectionRef);
        const currentItems = sectionDoc.data().contentItems || [];
        const itemToEdit = currentItems[indexToEdit];

        editContentTitleInput.value = itemToEdit.title;
        editContentUrlInput.value = itemToEdit.url;

        editContentModal.dataset.sectionId = sectionId;
        editContentModal.dataset.itemIndex = indexToEdit;
        addContentModal.classList.add("hidden"); // Ocultar el modal de agregar para evitar superposiciones
        editContentModal.classList.remove("hidden");
      });
    });

    document.querySelectorAll(".delete-content-btn").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const indexToDelete = parseInt(e.target.dataset.index);
        const sectionId = addContentModal.dataset.sectionId;
        const sectionRef = doc(
          db,
          `/artifacts/${appId}/public/data/sections`,
          sectionId
        );
        const sectionDoc = await getDoc(sectionRef);
        const currentItems = sectionDoc.data().contentItems || [];
        const newItems = currentItems.filter(
          (_, index) => index !== indexToDelete
        );
        await updateDoc(sectionRef, { contentItems: newItems });
        renderSectionContentList(sectionId);
      });
    });
  } else {
    sectionContentList.innerHTML =
      '<li class="text-gray-500">No hay contenido añadido a esta sección.</li>';
  }
}

editContentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const sectionId = editContentModal.dataset.sectionId;
  const itemIndex = parseInt(editContentModal.dataset.itemIndex);
  const newTitle = editContentTitleInput.value;
  const newUrl = editContentUrlInput.value;

  const sectionRef = doc(
    db,
    `/artifacts/${appId}/public/data/sections`,
    sectionId
  );
  const sectionDoc = await getDoc(sectionRef);
  const currentItems = sectionDoc.data().contentItems || [];

  currentItems[itemIndex] = {
    title: newTitle,
    url: newUrl,
  };

  await updateDoc(sectionRef, { contentItems: currentItems });
  renderSectionContentList(sectionId);
  editContentModal.classList.add("hidden");
  addContentModal.classList.remove("hidden"); // Mostrar de nuevo el modal de agregar
});

closeContentModal.addEventListener("click", () => {
  addContentModal.classList.add("hidden");
});

closeEditContentModal.addEventListener("click", () => {
  editContentModal.classList.add("hidden");
  addContentModal.classList.remove("hidden");
});

userAdminButton.addEventListener("click", () => {
  userAdminModal.classList.remove("hidden");
  renderUserList();
});

closeModalButton.addEventListener("click", () => {
  userAdminModal.classList.add("hidden");
});

const closeUserOptionsModal = document.getElementById(
  "close-user-options-modal"
);
closeUserOptionsModal.addEventListener("click", () => {
  document.getElementById("user-options-modal").classList.add("hidden");
});

userConfirmYes.addEventListener("click", async () => {
  if (pendingUserAction) {
    const userRef = doc(
      db,
      `/artifacts/${appId}/public/data/users`,
      pendingUserAction
    );
    await deleteDoc(userRef);
    userConfirmModal.classList.add("hidden");
    pendingUserAction = null;
  }
});

userConfirmNo.addEventListener("click", () => {
  userConfirmModal.classList.add("hidden");
  pendingUserAction = null;
});

savePasswordButton.addEventListener("click", async () => {
  if (pendingUserAction) {
    const newPassword = newPasswordModalInput.value;
    if (newPassword) {
      const userRef = doc(
        db,
        `/artifacts/${appId}/public/data/users`,
        pendingUserAction
      );
      await setDoc(userRef, { password: newPassword }, { merge: true });
      userPasswordModal.classList.add("hidden");
      pendingUserAction = null;
    }
  }
});

closePasswordModal.addEventListener("click", () => {
  userPasswordModal.classList.add("hidden");
  pendingUserAction = null;
});

function renderUserList() {
  userList.innerHTML = "";
  for (const username in USERS) {
    const user = USERS[username];
    const li = document.createElement("li");
    li.className =
      "flex justify-between items-center bg-gray-100 p-2 rounded-md shadow-sm";

    const userText = document.createElement("span");
    userText.textContent = `${user.username} (${user.role})`;
    li.appendChild(userText);

    const actionsDiv = document.createElement("div");

    const optionsButton = document.createElement("button");
    optionsButton.textContent = "Opciones";
    optionsButton.className =
      "bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors mr-2";
    optionsButton.addEventListener("click", () => {
      renderUserOptionsModal(user);
    });
    actionsDiv.appendChild(optionsButton);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Eliminar";
    deleteButton.className =
      "bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors mr-2";
    deleteButton.addEventListener("click", () => {
      userConfirmMessage.textContent = `¿Estás seguro de que quieres eliminar a \"${user.username}\"?`;
      pendingUserAction = user.id;
      userConfirmModal.classList.remove("hidden");
    });
    actionsDiv.appendChild(deleteButton);

    const editButton = document.createElement("button");
    editButton.textContent = "Cambiar Clave";
    editButton.className =
      "bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600 transition-colors";
    editButton.addEventListener("click", () => {
      newPasswordModalInput.value = "";
      pendingUserAction = user.id;
      userPasswordModal.classList.remove("hidden");
    });
    actionsDiv.appendChild(editButton);

    li.appendChild(actionsDiv);
    userList.appendChild(li);
  }
}

async function renderUserOptionsModal(user) {
  const userOptionsModal = document.getElementById("user-options-modal");
  const userOptionsContent = document.getElementById("user-options-content");
  userOptionsContent.innerHTML = ""; // Clear previous content

  // Admin toggle
  const adminToggleLabel = document.createElement("label");
  adminToggleLabel.className = "flex items-center mb-4";
  const isAdmin = user.role === "admin";
  adminToggleLabel.innerHTML = `
      <label class="switch">
        <input type="checkbox" id="admin-toggle" ${isAdmin ? "checked" : ""}>
        <span class="slider"></span>
      </label>
      <span class="ml-3">Administrador</span>
  `;
  const adminToggle = adminToggleLabel.querySelector("input");
  adminToggle.addEventListener("change", async (e) => {
    const newRole = e.target.checked ? "admin" : "user";
    const userRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
    await updateDoc(userRef, { role: newRole });
    user.role = newRole;
  });
  userOptionsContent.appendChild(adminToggleLabel);

  const temaListTitle = document.createElement("h5");
  temaListTitle.className = "text-md font-semibold mb-2";
  temaListTitle.textContent = "Acceso a Temas:";
  userOptionsContent.appendChild(temaListTitle);

  const temasCollection = collection(
    db,
    `/artifacts/${appId}/public/data/temas`
  );
  const temasSnapshot = await getDocs(temasCollection);
  const allTemas = temasSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const temaList = document.createElement("ul");
  allTemas.forEach((tema) => {
    const temaItem = document.createElement("li");
    temaItem.className = "mb-4";
    const isChecked =
      user.accessibleTemas && user.accessibleTemas.includes(tema.id);
    temaItem.innerHTML = `
          <label class="flex items-center">
              <label class="switch">
                <input type="checkbox" data-tema-id="${tema.id}" ${
      isChecked ? "checked" : ""
    }>
                <span class="slider"></span>
              </label>
              <span class="ml-3">${tema.name}</span>
          </label>
      `;
    const checkbox = temaItem.querySelector("input");
    checkbox.addEventListener("change", async (e) => {
      const temaId = e.target.dataset.temaId;
      const userRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
      const accessibleTemas = user.accessibleTemas || [];

      if (e.target.checked) {
        if (!accessibleTemas.includes(temaId)) {
          accessibleTemas.push(temaId);
        }
      } else {
        const index = accessibleTemas.indexOf(temaId);
        if (index > -1) {
          accessibleTemas.splice(index, 1);
        }
      }
      await updateDoc(userRef, { accessibleTemas });
      user.accessibleTemas = accessibleTemas;
    });
    temaList.appendChild(temaItem);
  });
  userOptionsContent.appendChild(temaList);

  userOptionsModal.classList.remove("hidden");
}

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newUsername = newUsernameInput.value.toLowerCase();
  const newPassword = newPasswordInput.value;
  const newRole = "user";

  if (newUsername in USERS) {
    console.error("Error: User already exists.");
    return;
  }

  try {
    await addDoc(collection(db, `/artifacts/${appId}/public/data/users`), {
      username: newUsername,
      password: newPassword,
      role: newRole,
      accessibleTemas: [],
    });
    newUsernameInput.value = "";
    newPasswordInput.value = "";
  } catch (e) {
    console.error("Error creating user: ", e);
  }
});
