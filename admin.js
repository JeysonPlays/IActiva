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
const createTemaModal = document.getElementById("create-tema-modal");
const closeCreateTemaModal = document.getElementById("close-create-tema-modal");
const createTemaForm = document.getElementById("create-tema-form");
const createTemaNameInput = document.getElementById("create-tema-name");
const temaSectionsModal = document.getElementById("tema-sections-modal");
const closeTemaSectionsModal = document.getElementById(
	"close-tema-sections-modal"
);
const temaSectionsTitle = document.getElementById("tema-sections-title");
const temaSectionsList = document.getElementById("tema-sections-list");

// Nuevo modal de contenido de sección
const sectionContentModal = document.getElementById("section-content-modal");
const closeSectionContentModal = document.getElementById(
	"close-section-content-modal"
);
const sectionContentTitle = document.getElementById("section-content-title");
const sectionDescriptionText = document.getElementById(
	"section-description-text"
);
const addContentFormNew = document.getElementById("add-content-form");
const contentTitleInputNew = document.getElementById("content-title-input");
const contentUrlInputNew = document.getElementById("content-url-input");
const contentList = document.getElementById("content-list");

let currentSectionForContent = null;
const sectionsModalList = document.getElementById("sections-modal-list");

// Modal de confirmación de eliminación
const confirmDeleteModal = document.getElementById("confirm-delete-modal");
const confirmDeleteTitle = document.getElementById("confirm-delete-title");
const confirmDeleteMessage = document.getElementById("confirm-delete-message");
const confirmDeleteCancel = document.getElementById("confirm-delete-cancel");
const confirmDeleteConfirm = document.getElementById("confirm-delete-confirm");

let deleteConfirmCallback = null;

// Función para mostrar modal de confirmación de eliminación
function showDeleteConfirmation(title, message, onConfirm) {
	confirmDeleteTitle.textContent = title;
	confirmDeleteMessage.textContent = message;
	deleteConfirmCallback = onConfirm;
	confirmDeleteModal.classList.remove("hidden");
}

// Event listeners para el modal de confirmación
confirmDeleteCancel.addEventListener("click", () => {
	confirmDeleteModal.classList.add("hidden");
	deleteConfirmCallback = null;
});

confirmDeleteConfirm.addEventListener("click", async () => {
	if (deleteConfirmCallback) {
		await deleteConfirmCallback();
		deleteConfirmCallback = null;
	}
	confirmDeleteModal.classList.add("hidden");
});

// const createSectionFromModalBtn = document.getElementById(
// 	"create-section-from-modal-btn"
// );

let currentUser = null;
let USERS = {};
let pendingUserAction = null;
let isMainScreenShown = false;
let unsubscribeTemas = null;
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
				// Crear nuevo nodo con diseño de tarjeta
				const temaDiv = document.createElement("div");
				temaDiv.id = temaId;
				temaDiv.className = "tema-card";
				temaDiv.innerHTML = `
          <div class="tema-card-header">
            <div class="tema-icon-wrapper">
              <svg class="tema-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h3 class="tema-name">${temaData.name}</h3>
          </div>
          <div class="tema-sections-collapse" style="display: none;">
            <div class="sections-loading">Cargando secciones...</div>
          </div>
        `;
				temasList.appendChild(temaDiv);
				temaNodeCache.set(temaId, {
					rootDiv: temaDiv,
					name: temaData.name,
					expanded: false,
				});
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
	});

	// Ya no necesitamos suscripción a secciones en la vista principal
	// Las secciones se cargan bajo demanda en el modal
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
	createTemaNameInput.value = "";
	renderTemasInModal();
	createTemaModal.classList.remove("hidden");
});

closeCreateTemaModal.addEventListener("click", () => {
	createTemaModal.classList.add("hidden");
});

// Función para renderizar los temas en el modal
async function renderTemasInModal() {
	const modalTemasList = document.getElementById("modal-temas-list");
	if (!modalTemasList) return;

	const temasCollection = collection(
		db,
		`/artifacts/${appId}/public/data/temas`
	);
	const temasSnapshot = await getDocs(temasCollection);

	modalTemasList.innerHTML = "";

	if (temasSnapshot.empty) {
		modalTemasList.innerHTML =
			'<p class="text-gray-500 text-sm text-center py-4">No hay temas todavía</p>';
		return;
	}

	temasSnapshot.forEach((doc) => {
		const temaData = doc.data();
		const temaItem = document.createElement("div");
		temaItem.className =
			"flex justify-between items-center bg-gray-50 px-4 py-3 rounded-lg";

		temaItem.innerHTML = `
			<span class="text-gray-800 font-medium uppercase">${temaData.name}</span>
			<div class="flex items-center space-x-2">
				<button class="edit-tema-modal-btn w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center" data-id="${doc.id}" data-name="${temaData.name}" title="Editar">
					<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
				<button class="add-section-modal-btn w-10 h-10 rounded-full bg-green-500 flex items-center justify-center" data-id="${doc.id}" data-name="${temaData.name}" title="Crear Sección">
					<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<line x1="12" y1="5" x2="12" y2="19"/>
						<line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</button>
				<button class="delete-tema-modal-btn w-10 h-10 rounded-full flex items-center justify-center" data-id="${doc.id}" title="Eliminar" style="background-color: #ef4444;">
					<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
				</button>
			</div>
		`;

		modalTemasList.appendChild(temaItem);
	});

	// Event listeners para botones de editar y eliminar
	document.querySelectorAll(".edit-tema-modal-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const temaId = btn.dataset.id;
			const temaName = btn.dataset.name;
			showEditTemaModal(temaId, temaName);
		});
	});

	document.querySelectorAll(".add-section-modal-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const temaId = btn.dataset.id;
			const temaName = btn.dataset.name;
			// Abrir el modal de crear sección con el temaId (sin cerrar el modal de crear tema)
			showSectionModal(null, null, temaId);
		});
	});

	document.querySelectorAll(".delete-tema-modal-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const temaId = btn.dataset.id;
			showDeleteConfirmation(
				"¿Eliminar Tema?",
				"Este tema y todas sus secciones serán eliminados permanentemente.",
				async () => {
					// Primero eliminar todas las secciones del tema
					const sectionsCollection = collection(
						db,
						`/artifacts/${appId}/public/data/sections`
					);
					const sectionsSnapshot = await getDocs(sectionsCollection);

					const deletePromises = [];
					sectionsSnapshot.forEach((sectionDoc) => {
						if (sectionDoc.data().temaId === temaId) {
							deletePromises.push(deleteDoc(sectionDoc.ref));
						}
					});

					await Promise.all(deletePromises);

					// Luego eliminar el tema
					await deleteDoc(
						doc(db, `/artifacts/${appId}/public/data/temas`, temaId)
					);
					renderTemasInModal();
				}
			);
		});
	});
}

createTemaForm.addEventListener("submit", async (e) => {
	e.preventDefault();
	const temaName = createTemaNameInput.value.trim();
	if (temaName) {
		try {
			await addDoc(collection(db, `/artifacts/${appId}/public/data/temas`), {
				name: temaName,
			});
			createTemaNameInput.value = "";
			// Recargar la lista de temas en el modal
			renderTemasInModal();
		} catch (e) {
			console.error("Error creating tema: ", e);
		}
	}
});

// Nota: diff incremental (temaNodeCache) + delegación de eventos minimizan re-renders. Comentarios antiguos de 'perf-lite' eliminados.

let currentEditingTemaId = null;

function showEditTemaModal(temaId, temaName) {
	currentEditingTemaId = temaId;
	editTemaNameInput.value = temaName;
	editTemaModal.classList.remove("hidden");
}

closeEditTemaModal.addEventListener("click", () => {
	editTemaModal.classList.add("hidden");
});

// Botón cancelar del modal editar tema
const cancelEditTemaBtn = document.getElementById("cancel-edit-tema");
if (cancelEditTemaBtn) {
	cancelEditTemaBtn.addEventListener("click", () => {
		editTemaModal.classList.add("hidden");
	});
}

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

// Modal de secciones de tema
let currentTemaForSections = null;

closeTemaSectionsModal.addEventListener("click", () => {
	temaSectionsModal.classList.add("hidden");
	currentTemaForSections = null;
});

// Event listeners para el modal de contenido de sección
closeSectionContentModal.addEventListener("click", () => {
	sectionContentModal.classList.add("hidden");
	currentSectionForContent = null;
});

// Función para mostrar el modal de contenido de una sección
async function showSectionContentModal(sectionId, sectionData) {
	currentSectionForContent = sectionId;
	sectionContentTitle.textContent = sectionData.name;
	sectionDescriptionText.textContent =
		sectionData.description || "Sin descripción";

	// Limpiar el formulario
	contentTitleInputNew.value = "";
	contentUrlInputNew.value = "";

	// Cargar los contenidos de esta sección
	await loadSectionContents(sectionId);

	// Mostrar el modal
	sectionContentModal.classList.remove("hidden");
}

// Función para cargar los contenidos de una sección
async function loadSectionContents(sectionId) {
	console.log("Cargando contenidos para sección:", sectionId);
	const sectionRef = doc(
		db,
		`/artifacts/${appId}/public/data/sections`,
		sectionId
	);
	const sectionDoc = await getDoc(sectionRef);
	const contentItems = sectionDoc.data().contentItems || [];

	console.log("Contenidos encontrados:", contentItems);
	renderSectionContents(contentItems, sectionId);
}

// Función para renderizar los contenidos
function renderSectionContents(contentItems, sectionId) {
	console.log("Renderizando contenidos:", contentItems);
	const contentListElement = document.getElementById("content-list");
	console.log("contentList elemento:", contentListElement);

	if (!contentListElement) {
		console.error("No se encontró el elemento content-list");
		return;
	}

	contentListElement.innerHTML = "";

	if (contentItems.length === 0) {
		contentListElement.innerHTML =
			'<p class="text-gray-500 text-sm text-center py-4">No hay contenido todavía</p>';
		return;
	}

	contentItems.forEach((item, index) => {
		const contentItem = document.createElement("div");
		contentItem.className =
			"flex items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg";

		contentItem.innerHTML = `
			<div class="flex-1 min-w-0">
				<h5 class="font-medium text-gray-900 truncate">${item.title}</h5>
				<a href="${item.url}" target="_blank" class="text-sm text-blue-600 hover:underline truncate block">${item.url}</a>
			</div>
			<div class="flex gap-2 flex-shrink-0">
				<button class="edit-content-btn-inline" data-index="${index}" title="Editar">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button class="delete-content-btn-inline" data-index="${index}" title="Eliminar">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
						<polyline points="3 6 5 6 21 6"/>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
						<line x1="10" y1="11" x2="10" y2="17"/>
						<line x1="14" y1="11" x2="14" y2="17"/>
					</svg>
				</button>
			</div>
		`;

		contentListElement.appendChild(contentItem);
	});

	// Agregar event listeners a los botones de editar
	document.querySelectorAll(".edit-content-btn-inline").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			const indexToEdit = parseInt(e.currentTarget.dataset.index);
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
			sectionContentModal.classList.add("hidden");
			editContentModal.classList.remove("hidden");
		});
	});

	// Agregar event listeners a los botones de eliminar
	document.querySelectorAll(".delete-content-btn-inline").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			const indexToDelete = parseInt(e.currentTarget.dataset.index);
			showDeleteConfirmation(
				"¿Eliminar Contenido?",
				"Este contenido será eliminado permanentemente.",
				async () => {
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
					await loadSectionContents(currentSectionForContent);
				}
			);
		});
	});
}

// Formulario para agregar contenido
addContentFormNew.addEventListener("submit", async (e) => {
	e.preventDefault();

	const title = contentTitleInputNew.value.trim();
	const url = contentUrlInputNew.value.trim();

	if (title && url && currentSectionForContent) {
		try {
			const sectionRef = doc(
				db,
				`/artifacts/${appId}/public/data/sections`,
				currentSectionForContent
			);
			const sectionDoc = await getDoc(sectionRef);
			const currentItems = sectionDoc.data().contentItems || [];

			// Agregar el nuevo contenido al array
			currentItems.push({
				title: title,
				url: url,
			});

			// Actualizar el documento de la sección
			await updateDoc(sectionRef, { contentItems: currentItems });

			// Limpiar el formulario
			contentTitleInputNew.value = "";
			contentUrlInputNew.value = "";

			// Recargar la lista de contenidos
			await loadSectionContents(currentSectionForContent);
		} catch (error) {
			console.error("Error al agregar contenido:", error);
			alert("Error al agregar el contenido");
		}
	}
});

// Botón para crear sección desde modal (comentado por ahora)
// createSectionFromModalBtn.addEventListener("click", () => {
// 	if (currentTemaForSections) {
// 		showSectionModal(null, null, currentTemaForSections);
// 	}
// });

// Función para expandir/contraer secciones de un tema (acordeón)
async function toggleTemaSections(temaId) {
	const cached = temaNodeCache.get(temaId);
	if (!cached) return;

	const temaCard = cached.rootDiv;
	const sectionsCollapse = temaCard.querySelector(".tema-sections-collapse");
	if (!sectionsCollapse) return;

	// Si ya está expandido, contraer
	if (cached.expanded) {
		sectionsCollapse.style.display = "none";
		cached.expanded = false;
		temaCard.classList.remove("expanded");
	} else {
		// Expandir y cargar secciones
		sectionsCollapse.style.display = "block";
		cached.expanded = true;
		temaCard.classList.add("expanded");

		// Cargar secciones
		const sectionsCollection = collection(
			db,
			`/artifacts/${appId}/public/data/sections`
		);
		const sectionsSnapshot = await getDocs(sectionsCollection);
		const sections = [];

		sectionsSnapshot.forEach((doc) => {
			const data = doc.data();
			if (data.temaId === temaId) {
				sections.push({ id: doc.id, data });
			}
		});

		// Renderizar secciones en el acordeón
		renderTemaSectionsInline(sectionsCollapse, sections, temaId);
	}
}

// Función para recargar las secciones de un tema específico
async function reloadTemaSections(temaId) {
	const cached = temaNodeCache.get(temaId);
	if (!cached || !cached.expanded) return;

	const temaCard = cached.rootDiv;
	const sectionsCollapse = temaCard.querySelector(".tema-sections-collapse");
	if (!sectionsCollapse) return;

	// Cargar secciones actualizadas
	const sectionsCollection = collection(
		db,
		`/artifacts/${appId}/public/data/sections`
	);
	const sectionsSnapshot = await getDocs(sectionsCollection);
	const sections = [];

	sectionsSnapshot.forEach((doc) => {
		const data = doc.data();
		if (data.temaId === temaId) {
			sections.push({ id: doc.id, data });
		}
	});

	// Renderizar secciones actualizadas
	renderTemaSectionsInline(sectionsCollapse, sections, temaId);
}

// Renderizar secciones dentro del acordeón del tema
function renderTemaSectionsInline(container, sections, temaId) {
	container.innerHTML = "";

	if (sections.length === 0) {
		container.innerHTML =
			'<div class="no-sections-message">No hay secciones todavía</div>';
		return;
	}

	sections.forEach((section) => {
		const sectionItem = document.createElement("div");
		sectionItem.className = "section-item-inline";

		const colorMap = {
			matematicas: { bg: "#E3F2FD", icon: "#1976D2" },
			ciencias: { bg: "#E8F5E9", icon: "#388E3C" },
			lenguaje: { bg: "#FFF3E0", icon: "#F57C00" },
			sociales: { bg: "#FCE4EC", icon: "#C2185B" },
			ingles: { bg: "#F3E5F5", icon: "#7B1FA2" },
		};

		const color = colorMap[section.data.type] || {
			bg: "#F5F5F5",
			icon: "#757575",
		};

		sectionItem.innerHTML = `
			<div class="section-icon-wrapper">
				<img 
					src="${section.data.imageUrl || "https://via.placeholder.com/56"}" 
					alt="${section.data.name}"
					class="section-icon-img"
					onerror="this.src='https://via.placeholder.com/56?text=Sin+Imagen'"
				/>
			</div>
			<div class="section-info-inline" data-section-id="${section.id}">
				<h4 class="section-name-inline">${section.data.name}</h4>
			</div>
			<div class="section-actions-inline">
				<button class="edit-section-btn-inline" data-id="${
					section.id
				}" data-tema-id="${temaId}" title="Editar">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button class="delete-section-btn-inline" data-id="${
					section.id
				}" title="Eliminar">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="3 6 5 6 21 6"/>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
						<line x1="10" y1="11" x2="10" y2="17"/>
						<line x1="14" y1="11" x2="14" y2="17"/>
					</svg>
				</button>
			</div>
		`;

		// Agregar event listener para click en el nombre de la sección
		const sectionInfo = sectionItem.querySelector(".section-info-inline");
		sectionInfo.style.cursor = "pointer";
		sectionInfo.addEventListener("click", () => {
			showSectionContentModal(section.id, section.data);
		});

		container.appendChild(sectionItem);
	});
}

async function showTemaSectionsModal(temaId, temaName) {
	currentTemaForSections = temaId;
	temaSectionsTitle.textContent = temaName;

	// Obtener las secciones de este tema
	const sectionsCollection = collection(
		db,
		`/artifacts/${appId}/public/data/sections`
	);
	const sectionsSnapshot = await getDocs(sectionsCollection);
	const sections = [];

	sectionsSnapshot.forEach((doc) => {
		const data = doc.data();
		if (data.temaId === temaId) {
			sections.push({ id: doc.id, data });
		}
	});

	renderTemaSections(sections);
	temaSectionsModal.classList.remove("hidden");
}

function renderTemaSections(sections) {
	sectionsModalList.innerHTML = "";

	if (sections.length === 0) {
		sectionsModalList.innerHTML =
			'<p class="empty-sections-message">No hay secciones creadas para este tema.</p>';
		return;
	}

	sections.forEach(({ id, data }) => {
		const div = document.createElement("div");
		div.dataset.sectionId = id;
		div.className = "section-item-vertical";

		// Generar un color aleatorio para el icono basado en el ID
		const colors = [
			{
				bg: "linear-gradient(135deg, #e879f9 0%, #c084fc 100%)",
				icon: "#9333ea",
			},
			{
				bg: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
				icon: "#1d4ed8",
			},
			{
				bg: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
				icon: "#065f46",
			},
			{
				bg: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
				icon: "#92400e",
			},
			{
				bg: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
				icon: "#991b1b",
			},
			{
				bg: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
				icon: "#5b21b6",
			},
		];
		const colorIndex = id.charCodeAt(0) % colors.length;
		const color = colors[colorIndex];

		div.innerHTML = `
			<div class="section-icon-wrapper">
				<img src="${data.imageUrl}" alt="${data.name}" class="section-icon-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
				<svg class="section-icon-fallback" style="display: none; stroke: ${color.icon};" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
			</div>
			<div class="section-info">
				<h4 class="section-name">${data.name}</h4>
			</div>
			<div class="section-actions-vertical">
				<button data-id="${id}" class="section-action-icon edit-section-btn" title="Editar">
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</button>
				<button data-id="${id}" class="section-action-icon delete-section-btn" title="Eliminar">
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
				</button>
			</div>
		`;
		sectionsModalList.appendChild(div);
	});
}

// Delegación de eventos para acciones dentro del modal de secciones
sectionsModalList.addEventListener("click", async (e) => {
	const target = e.target.closest("button");
	if (!target) return;

	// Agregar Contenido
	if (target.classList.contains("add-content-btn")) {
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

		// Obtener temaId antes de eliminar
		const sectionDoc = await getDoc(sectionRef);
		const temaId = sectionDoc.data()?.temaId;

		await deleteDoc(sectionRef);

		// Recargar las secciones del modal
		if (currentTemaForSections) {
			const temaDataSnap = await getDoc(
				doc(db, `/artifacts/${appId}/public/data/temas`, currentTemaForSections)
			);
			if (temaDataSnap.exists()) {
				showTemaSectionsModal(currentTemaForSections, temaDataSnap.data().name);
			}
		}

		// También recargar en el acordeón si está expandido
		if (temaId) {
			await reloadTemaSections(temaId);
		}
	}
});

// Delegación de eventos para acciones dentro de temas/secciones
temasList.addEventListener("click", async (e) => {
	const target = e.target.closest("button");
	const temaCardHeader = e.target.closest(".tema-card-header");
	const temaCard = e.target.closest(".tema-card");

	// Si se hizo clic en un botón, ejecutar la acción del botón
	if (target) {
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
			return; // Detener aquí para no expandir el acordeón
		}

		// Eliminar Tema
		else if (target.classList.contains("delete-tema-btn")) {
			const temaId = target.dataset.id;
			if (temaId) {
				showDeleteConfirmation(
					"¿Eliminar Tema?",
					"Este tema y todas sus secciones serán eliminados permanentemente.",
					async () => {
						// Primero eliminar todas las secciones del tema
						const sectionsCollection = collection(
							db,
							`/artifacts/${appId}/public/data/sections`
						);
						const sectionsSnapshot = await getDocs(sectionsCollection);

						const deletePromises = [];
						sectionsSnapshot.forEach((sectionDoc) => {
							if (sectionDoc.data().temaId === temaId) {
								deletePromises.push(deleteDoc(sectionDoc.ref));
							}
						});

						await Promise.all(deletePromises);

						// Luego eliminar el tema
						await deleteDoc(
							doc(db, `/artifacts/${appId}/public/data/temas`, temaId)
						);
					}
				);
			}
			return; // Detener aquí
		}

		// Crear Sección (abrir modal de creación)
		else if (target.classList.contains("create-section-button")) {
			const temaId = target.dataset.temaId;
			showSectionModal(null, null, temaId);
			return; // Detener aquí
		}

		// Crear Sección desde el botón con icono +
		else if (target.classList.contains("add-section-btn")) {
			const temaId = target.dataset.id;
			const temaName = target.dataset.temaName;
			if (temaId) {
				showSectionModal(null, null, temaId);
			}
			return; // Detener aquí
		}

		// Editar sección desde el acordeón
		else if (target.classList.contains("edit-section-btn-inline")) {
			const sectionId = target.dataset.id;
			const temaId = target.dataset.temaId;
			if (sectionId) {
				const sectionDataSnap = await getDoc(
					doc(db, `/artifacts/${appId}/public/data/sections`, sectionId)
				);
				if (sectionDataSnap.exists()) {
					showSectionModal(sectionDataSnap.data(), sectionId, temaId);
				}
			}
			return;
		}

		// Eliminar sección desde el acordeón
		else if (target.classList.contains("delete-section-btn-inline")) {
			const sectionId = target.dataset.id;
			if (sectionId) {
				showDeleteConfirmation(
					"¿Eliminar Sección?",
					"Esta sección y todo su contenido serán eliminados permanentemente.",
					async () => {
						// Obtener temaId antes de eliminar
						const sectionRef = doc(
							db,
							`/artifacts/${appId}/public/data/sections`,
							sectionId
						);
						const sectionDoc = await getDoc(sectionRef);
						const temaId = sectionDoc.data()?.temaId;

						await deleteDoc(sectionRef);

						// Recargar las secciones del tema
						if (temaId) {
							await reloadTemaSections(temaId);
						}
					}
				);
			}
			return;
		}
	}

	// Si se hizo clic en el header de la tarjeta (pero no en un botón), expandir/contraer
	if (temaCardHeader && temaCard) {
		const temaId = temaCard.id;
		toggleTemaSections(temaId);
	}
});

logoutButton.addEventListener("click", async () => {
	try {
		// Limpia suscripciones antes de salir
		if (unsubscribeTemas) {
			unsubscribeTemas();
			unsubscribeTemas = null;
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

// Botón cancelar del modal de sección
const cancelSectionModalBtn = document.getElementById("cancel-section-modal");
if (cancelSectionModalBtn) {
	cancelSectionModalBtn.addEventListener("click", () => {
		sectionModal.classList.add("hidden");
	});
}

function showSectionModal(sectionData = null, docId = null, temaId = null) {
	sectionForm.reset();
	sectionForm.dataset.docId = "";
	sectionForm.dataset.temaId = "";

	const sectionModalIcon = document.getElementById("section-modal-icon");
	const sectionModalSubmit = document.getElementById("section-modal-submit");

	if (sectionData && docId) {
		// EDITAR SECCIÓN - Color Morado
		sectionModalTitle.textContent = "Editar Sección";
		sectionNameInput.value = sectionData.name;
		sectionDescriptionInput.value = sectionData.description;
		sectionImageInput.value = sectionData.imageUrl;
		sectionForm.dataset.docId = docId;

		// Cambiar icono y botón a morado
		sectionModalIcon.className =
			"w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center transform rotate-45";
		sectionModalSubmit.className =
			"flex-1 bg-purple-600 text-white py-3 rounded-full font-semibold hover:bg-purple-700 transition-colors uppercase";
	} else {
		// CREAR SECCIÓN - Color Verde
		sectionModalTitle.textContent = "Crear Nueva Sección";

		// Cambiar icono y botón a verde
		sectionModalIcon.className =
			"w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center transform rotate-45";
		sectionModalSubmit.className =
			"flex-1 bg-green-500 text-white py-3 rounded-full font-semibold hover:bg-green-600 transition-colors uppercase";
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

			// Obtener el temaId de la sección editada
			const sectionDoc = await getDoc(sectionRef);
			const updatedTemaId = sectionDoc.data().temaId;

			// Recargar las secciones del tema si está expandido
			if (updatedTemaId) {
				await reloadTemaSections(updatedTemaId);
			}
		} else {
			await addDoc(collection(db, `/artifacts/${appId}/public/data/sections`), {
				name: name,
				description: description,
				imageUrl: imageUrl,
				contentItems: [],
				temaId: temaId,
			});

			// Recargar las secciones del tema si está expandido
			if (temaId) {
				await reloadTemaSections(temaId);
			}
		}
		sectionModal.classList.add("hidden");
		sectionForm.reset();
	} catch (e) {
		console.error("Error creating/updating section: ", e);
	}
});

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
	await loadSectionContents(currentSectionForContent);
	editContentModal.classList.add("hidden");
	sectionContentModal.classList.remove("hidden");
});

closeEditContentModal.addEventListener("click", () => {
	editContentModal.classList.add("hidden");
	sectionContentModal.classList.remove("hidden");
});

// Botón cancelar del modal editar contenido
const cancelEditContentBtn = document.getElementById("cancel-edit-content");
if (cancelEditContentBtn) {
	cancelEditContentBtn.addEventListener("click", () => {
		editContentModal.classList.add("hidden");
		sectionContentModal.classList.remove("hidden");
	});
}

userAdminButton.addEventListener("click", () => {
	userAdminModal.classList.remove("hidden");
	renderUserList();
});

closeModalButton.addEventListener("click", () => {
	userAdminModal.classList.add("hidden");
});

// Toggle password visibility
const togglePasswordBtn = document.getElementById("toggle-password-visibility");
const newPasswordField = document.getElementById("new-password");
togglePasswordBtn.addEventListener("click", () => {
	const type =
		newPasswordField.getAttribute("type") === "password" ? "text" : "password";
	newPasswordField.setAttribute("type", type);

	// Toggle eye icon
	if (type === "text") {
		togglePasswordBtn.innerHTML = `
			<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
			</svg>
		`;
	} else {
		togglePasswordBtn.innerHTML = `
			<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
			</svg>
		`;
	}
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

// Toggle para mostrar/ocultar contraseña
const togglePasswordVisibility = document.getElementById(
	"toggle-password-visibility"
);
if (togglePasswordVisibility) {
	togglePasswordVisibility.addEventListener("click", () => {
		const passwordInput = document.getElementById("new-password-modal-input");
		const eyeIcon = document.getElementById("eye-icon");

		if (passwordInput.type === "password") {
			passwordInput.type = "text";
			// Cambiar a icono de ojo tachado
			eyeIcon.innerHTML = `
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
			`;
		} else {
			passwordInput.type = "password";
			// Cambiar a icono de ojo normal
			eyeIcon.innerHTML = `
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
			`;
		}
	});
}

// Event listeners para todos los botones "Cancelar" del modal de contraseña
const passwordModalCancelButtons = document.querySelectorAll(
	'#user-password-modal button[type="button"]'
);
passwordModalCancelButtons.forEach((btn) => {
	if (btn.textContent.trim().toUpperCase() === "CANCELAR") {
		btn.addEventListener("click", () => {
			userPasswordModal.classList.add("hidden");
			pendingUserAction = null;
		});
	}
});

function renderUserList() {
	userList.innerHTML = "";
	for (const username in USERS) {
		const user = USERS[username];
		const userItem = document.createElement("div");
		userItem.className =
			"flex justify-between items-center bg-gray-50 px-4 py-3 rounded-lg";

		const userText = document.createElement("span");
		userText.textContent = `${user.username} (${user.role})`;
		userText.className = "text-gray-800 font-medium";
		userItem.appendChild(userText);

		const actionsDiv = document.createElement("div");
		actionsDiv.className = "flex items-center space-x-2";

		// Botón de configuración (settings) - gris
		const optionsButton = document.createElement("button");
		optionsButton.className =
			"w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center";
		optionsButton.innerHTML = `
			<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		`;
		optionsButton.addEventListener("click", () => {
			renderUserOptionsModal(user);
		});
		actionsDiv.appendChild(optionsButton);

		// Botón eliminar - rojo
		const deleteButton = document.createElement("button");
		deleteButton.className =
			"w-10 h-10 rounded-full flex items-center justify-center";
		deleteButton.style.backgroundColor = "#ef4444";
		deleteButton.innerHTML = `
			<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
			</svg>
		`;
		deleteButton.addEventListener("click", () => {
			showDeleteConfirmation(
				"Eliminar Usuario",
				`¿Estás seguro de que quieres eliminar a "${user.username}"?`,
				() => {
					deleteUser(user.id);
				}
			);
		});
		actionsDiv.appendChild(deleteButton);

		// Botón cambiar contraseña (key icon) - naranja
		const editButton = document.createElement("button");
		editButton.className =
			"w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center";
		editButton.innerHTML = `
			<svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
			</svg>
		`;
		editButton.addEventListener("click", () => {
			newPasswordModalInput.value = "";
			pendingUserAction = user.id;
			userPasswordModal.classList.remove("hidden");
		});
		actionsDiv.appendChild(editButton);

		userItem.appendChild(actionsDiv);
		userList.appendChild(userItem);
	}
}

async function deleteUser(userId) {
	try {
		const userRef = doc(db, `/artifacts/${appId}/public/data/users`, userId);
		await deleteDoc(userRef);
	} catch (error) {
		console.error("Error eliminando usuario:", error);
		alert("Error al eliminar el usuario");
	}
}

async function renderUserOptionsModal(user) {
	const userOptionsModal = document.getElementById("user-options-modal");
	const userOptionsContent = document.getElementById("user-options-content");
	userOptionsContent.innerHTML = ""; // Clear previous content

	// Toggle de Rol de Administrador con borde morado
	const isAdmin = user.role === "admin";
	const adminToggleContainer = document.createElement("div");
	adminToggleContainer.className =
		"border-2 border-purple-500 rounded-xl p-4 mb-6";
	adminToggleContainer.innerHTML = `
		<div class="flex items-center justify-between">
			<span class="text-gray-900 font-medium text-lg">Rol de Administrador</span>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" id="admin-toggle" class="sr-only peer" ${
					isAdmin ? "checked" : ""
				}>
				<div class="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
			</label>
		</div>
	`;

	const adminToggle = adminToggleContainer.querySelector("input");
	adminToggle.addEventListener("change", async (e) => {
		const newRole = e.target.checked ? "admin" : "user";
		const userRef = doc(db, `/artifacts/${appId}/public/data/users`, user.id);
		await updateDoc(userRef, { role: newRole });
		user.role = newRole;
	});
	userOptionsContent.appendChild(adminToggleContainer);

	// Sección de Temas Accesibles
	const temasSectionTitle = document.createElement("h4");
	temasSectionTitle.className = "text-xl font-bold text-gray-900 mb-4";
	temasSectionTitle.textContent = "Temas Accesibles:";
	userOptionsContent.appendChild(temasSectionTitle);

	// Obtener todos los temas
	const temasCollection = collection(
		db,
		`/artifacts/${appId}/public/data/temas`
	);
	const temasSnapshot = await getDocs(temasCollection);
	const allTemas = temasSnapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	}));

	// Lista de temas con checkboxes turquesa
	const temaList = document.createElement("div");
	temaList.className = "space-y-3";

	allTemas.forEach((tema) => {
		const isChecked =
			user.accessibleTemas && user.accessibleTemas.includes(tema.id);
		const temaItem = document.createElement("div");
		temaItem.className = "flex items-center justify-between";
		temaItem.innerHTML = `
			<span class="text-gray-700 text-lg">${tema.name}</span>
			<label class="relative inline-flex items-center cursor-pointer">
				<input type="checkbox" data-tema-id="${tema.id}" class="sr-only peer" ${
			isChecked ? "checked" : ""
		}>
				<div class="w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center peer-checked:bg-teal-400 peer-checked:border-teal-400 transition-all">
					<svg class="w-4 h-4 text-white hidden peer-checked:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
					</svg>
				</div>
			</label>
		`;

		const checkbox = temaItem.querySelector("input");
		const checkboxVisual = temaItem.querySelector("div");
		const checkIcon = temaItem.querySelector("svg");

		// Actualizar visualmente el checkbox
		const updateCheckbox = () => {
			if (checkbox.checked) {
				checkboxVisual.style.backgroundColor = "#14b8a6"; // teal-500
				checkboxVisual.style.borderColor = "#14b8a6";
				checkIcon.style.display = "block";
			} else {
				checkboxVisual.style.backgroundColor = "transparent";
				checkboxVisual.style.borderColor = "#d1d5db"; // gray-300
				checkIcon.style.display = "none";
			}
		};

		updateCheckbox();

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
			updateCheckbox();
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
