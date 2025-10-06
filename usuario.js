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
const logoutButton = document.getElementById("logout-button");
const availableThemes = document.getElementById("available-themes");
const completedCount = document.getElementById("completed-count");
const progressPercentage = document.getElementById("progress-percentage");
const completedBtn = document.getElementById("completed-btn");
const inProgressBtn = document.getElementById("in-progress-btn");
const viewSectionModal = document.getElementById("view-section-modal");
const closeViewSectionModal = document.getElementById(
	"close-view-section-modal"
);
const viewSectionContent = document.getElementById("view-section-content");
const modalTitle = document.getElementById("modal-title");

let currentUser = null;
let USERS = {};

// Almacenar datos de temas y secciones para acceso rápido
let temasData = new Map(); // Map<temaId, temaData>
let sectionsData = new Map(); // Map<sectionId, sectionData>

// Guardar el contenido del modal anterior para poder volver a él
let previousModalContent = null;
let previousModalFilter = null;
let isViewingIndividualSection = false; // Para saber si estamos viendo una sección individual

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

	// Actualizar progreso global
	updateGlobalProgressUI();

	// Actualizar progreso de la sección
	const sectionProgressEl = document.querySelector(
		`[data-section-progress="${sectionId}"]`
	);
	if (sectionProgressEl) {
		const { done, total } = calcSectionProgress(sectionId);
		const color = done === total && total > 0 ? "#10b981" : "#2c5aa0";
		sectionProgressEl.textContent = `${done}/${total} completados`;
		sectionProgressEl.style.color = color;

		// Actualizar progreso del tema al que pertenece esta sección
		const temaId = sectionProgressEl.getAttribute("data-tema-id");
		if (temaId) {
			updateTemaProgress(temaId);
		}
	}
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

function updateTemaProgress(temaId) {
	const temaProgressEl = document.querySelector(
		`[data-tema-progress="${temaId}"]`
	);
	if (!temaProgressEl) return;

	// Obtener todas las secciones de este tema
	const sectionElements = document.querySelectorAll(
		`[data-tema-id="${temaId}"]`
	);
	let totalItems = 0;
	let completedItems = 0;

	sectionElements.forEach((sectionEl) => {
		const sectionId = sectionEl.getAttribute("data-section-progress");
		const { done, total } = calcSectionProgress(sectionId);
		totalItems += total;
		completedItems += done;
	});

	temaProgressEl.textContent = `${completedItems}/${totalItems}`;
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

	// Actualizar estadísticas en la nueva interfaz
	if (completedCount) completedCount.textContent = done;
	if (progressPercentage) progressPercentage.textContent = `${pct}%`;
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
	const sectionProgressEl = document.querySelector(
		`[data-section-progress="${sectionId}"]`
	);
	if (sectionProgressEl) {
		const { done, total } = calcSectionProgress(sectionId);
		const color = done === total && total > 0 ? "#10b981" : "#2c5aa0";
		sectionProgressEl.textContent = `${done}/${total} completados`;
		sectionProgressEl.style.color = color;

		const temaId = sectionProgressEl.getAttribute("data-tema-id");
		if (temaId) {
			updateTemaProgress(temaId);
		}
	}
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
	const sectionProgressEl = document.querySelector(
		`[data-section-progress="${sectionId}"]`
	);
	if (sectionProgressEl) {
		const { done, total } = calcSectionProgress(sectionId);
		const color = done === total && total > 0 ? "#10b981" : "#2c5aa0";
		sectionProgressEl.textContent = `${done}/${total} completados`;
		sectionProgressEl.style.color = color;

		const temaId = sectionProgressEl.getAttribute("data-tema-id");
		if (temaId) {
			updateTemaProgress(temaId);
		}
	}
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
	const sectionsCollection = collection(
		db,
		`/artifacts/${appId}/public/data/sections`
	);

	// Escuchar cambios en temas y secciones
	onSnapshot(temasCollection, (temasSnapshot) => {
		if (currentUser) {
			onSnapshot(sectionsCollection, (sectionsSnapshot) => {
				renderUserInterface(temasSnapshot.docs, sectionsSnapshot.docs);
			});
		}
	});
}

function showMainScreen(user) {
	currentUser = user;
	mainScreen.classList.remove("hidden");
	console.log("Mostrando pantalla principal para:", user.username);
	userGreeting.textContent = `Bienvenido, ${user.username}`;
	console.log("Texto de saludo establecido:", userGreeting.textContent);
	// Cargar progreso del usuario y luego listeners de contenido
	loadUserProgress(user.id).then(() => {
		setupListeners();
	});
}

function renderUserInterface(temasDocs, sectionsDocs) {
	// Limpiar totales anteriores para reflejar snapshot actual
	userProgress.perSectionTotals.clear();
	temasData.clear();
	sectionsData.clear();
	availableThemes.innerHTML = "";

	const accessibleTemas = currentUser.accessibleTemas || [];

	// Guardar datos de temas y secciones
	temasDocs.forEach((doc) => {
		temasData.set(doc.id, { id: doc.id, ...doc.data() });
	});
	sectionsDocs.forEach((doc) => {
		sectionsData.set(doc.id, { id: doc.id, ...doc.data() });
	});

	// Filtrar solo los temas accesibles
	const userTemas = temasDocs.filter((doc) => accessibleTemas.includes(doc.id));

	// Renderizar cada tema con sus secciones
	userTemas.forEach((temaDoc) => {
		const temaData = temaDoc.data();
		const temaId = temaDoc.id;

		// Filtrar secciones de este tema
		const temaSections = sectionsDocs.filter(
			(sec) => sec.data().temaId === temaId
		);

		// Calcular progreso del tema
		let temaTotalItems = 0;
		let temaCompletedItems = 0;

		temaSections.forEach((sectionDoc) => {
			const sectionId = sectionDoc.id;
			const contentItems = sectionDoc.data().contentItems || [];
			const totalItems = contentItems.length;
			temaTotalItems += totalItems;

			// Registrar totales para cálculo de progreso
			userProgress.perSectionTotals.set(sectionId, totalItems);

			// Contar completados
			for (let i = 0; i < totalItems; i++) {
				if (userProgress.seen.has(`${sectionId}:${i}`)) {
					temaCompletedItems++;
				}
			}
		});

		const isCompleted =
			temaTotalItems > 0 && temaCompletedItems === temaTotalItems;

		// Crear contenedor del tema con diseño EXACTO de admin
		const temaContainer = document.createElement("div");
		temaContainer.className = "tema-card";

		// Header del tema
		const temaHeaderHTML = `
			<div class="tema-card-header">
				<div class="tema-icon-wrapper">
					<svg class="tema-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						${
							isCompleted
								? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`
								: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>`
						}
					</svg>
				</div>
				<h3 class="tema-name">${temaData.name}</h3>
				<div style="flex: 1;"></div>
				<div data-tema-progress="${temaId}" style="font-size: 0.875rem; color: #6b7280; margin-right: 0.5rem;">${temaCompletedItems}/${temaTotalItems}</div>
			</div>
			<div class="tema-sections-collapse" style="display: none;">
				<div class="sections-loading">Cargando secciones...</div>
			</div>
		`;

		temaContainer.innerHTML = temaHeaderHTML;

		temaContainer.innerHTML = temaHeaderHTML;

		// Renderizar secciones en el contenedor collapse
		const sectionsContainer = temaContainer.querySelector(
			".tema-sections-collapse"
		);

		if (temaSections.length === 0) {
			sectionsContainer.innerHTML = `<div class="no-sections-message">No hay secciones en este tema todavía.</div>`;
		} else {
			sectionsContainer.innerHTML = ""; // Limpiar el mensaje de carga

			temaSections.forEach((sectionDoc) => {
				const sectionData = sectionDoc.data();
				const sectionId = sectionDoc.id;
				const contentItems = sectionData.contentItems || [];
				const { done, total, pct } = calcSectionProgress(sectionId);

				const sectionCard = document.createElement("div");
				sectionCard.className = "section-item-inline";

				sectionCard.innerHTML = `
					<div class="section-icon-wrapper">
						<img 
							src="${sectionData.imageUrl || "https://via.placeholder.com/56"}" 
							alt="${sectionData.name}"
							class="section-icon-img"
							onerror="this.src='https://via.placeholder.com/56?text=Sin+Imagen'"
						/>
					</div>
					<div class="section-info-inline">
						<h4 class="section-name-inline">${sectionData.name}</h4>
						<div data-section-progress="${sectionId}" data-tema-id="${temaId}" style="font-size: 0.875rem; color: ${
					done === total && total > 0 ? "#10b981" : "#2c5aa0"
				}; margin-top: 0.25rem; font-weight: 500;">${done}/${total} completados</div>
					</div>
					<svg style="width: 20px; height: 20px; color: #9ca3af; flex-shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				`;

				sectionCard.addEventListener("click", () => {
					renderSectionContentModal(sectionId, sectionData, contentItems);
				});

				sectionsContainer.appendChild(sectionCard);
			});
		}

		// Toggle de acordeón al hacer click en el header
		const temaHeader = temaContainer.querySelector(".tema-card-header");
		temaHeader.addEventListener("click", () => {
			const isExpanded = sectionsContainer.style.display !== "none";

			if (isExpanded) {
				sectionsContainer.style.display = "none";
				temaContainer.classList.remove("expanded");
			} else {
				sectionsContainer.style.display = "block";
				temaContainer.classList.add("expanded");
			}
		});

		availableThemes.appendChild(temaContainer);
	});

	updateGlobalProgressUI();
}

function renderSectionContentModal(sectionId, sectionData, contentItems) {
	// Marcar que estamos viendo una sección individual
	isViewingIndividualSection = true;

	viewSectionContent.innerHTML = "";

	// Actualizar título en el header del modal
	modalTitle.textContent = sectionData.name;
	modalTitle.style.color = "#1e3a8a"; // Azul oscuro (text-blue-900 de Tailwind)Descripción de la sección
	if (sectionData.description) {
		const description = document.createElement("p");
		description.style.cssText =
			"color: #6b7280; font-size: 0.9375rem; line-height: 1.6; margin-bottom: 1.5rem;";
		description.textContent = sectionData.description;
		viewSectionContent.appendChild(description);
	}

	// Calcular progreso
	const { done, total, pct } = calcSectionProgress(sectionId);

	// Barra de progreso y texto
	const progressContainer = document.createElement("div");
	progressContainer.style.cssText = "margin-bottom: 1.5rem;";
	progressContainer.innerHTML = `
		<div style="display: flex; justify-content: flex-end; margin-bottom: 0.5rem;">
			<span style="font-size: 0.875rem; color: #6b7280;">${done} / ${total} (${pct}%)</span>
		</div>
		<div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
			<div style="height: 100%; background: #10b981; border-radius: 9999px; transition: width 0.3s ease; width: ${pct}%;"></div>
		</div>
	`;
	viewSectionContent.appendChild(progressContainer);

	// Lista de contenidos
	if (contentItems && contentItems.length > 0) {
		contentItems.forEach((item, index) => {
			const key = `${sectionId}:${index}`;
			const checked = userProgress.seen.has(key);

			const itemDiv = document.createElement("div");
			itemDiv.style.cssText =
				"background: #f9fafb; border-radius: 0.75rem; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid #e5e7eb;";

			itemDiv.innerHTML = `
				<div style="display: flex; align-items: flex-start; gap: 0.75rem;">
					<label style="display: flex; align-items: center; cursor: pointer; flex-shrink: 0; margin-top: 0.125rem;">
						<input 
							type="checkbox" 
							class="seen-toggle" 
							data-section-id="${sectionId}" 
							data-index="${index}" 
							${checked ? "checked" : ""}
							style="width: 20px; height: 20px; cursor: pointer; accent-color: #14b8a6; border-radius: 4px;"
						/>
					</label>
					<div style="flex: 1; min-width: 0;">
						<h4 style="font-size: 1rem; font-weight: 600; color: #1f2937; margin: 0 0 0.5rem 0;">${
							item.title
						}</h4>
						<a 
							href="${item.url}" 
							target="_blank" 
							rel="noopener noreferrer" 
							style="color: #3b82f6; font-size: 0.875rem; text-decoration: none; word-break: break-all; display: block;"
							onmouseover="this.style.textDecoration='underline'" 
							onmouseout="this.style.textDecoration='none'"
						>${item.url}</a>
					</div>
				</div>
			`;

			viewSectionContent.appendChild(itemDiv);
		});

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
						// Actualizar la barra de progreso
						const { done, total, pct } = calcSectionProgress(sid);
						const progressBar = viewSectionContent.querySelector(
							'[style*="background: #10b981"]'
						);
						const progressText = viewSectionContent.querySelector(
							'[style*="color: #6b7280"]'
						);
						if (progressBar) progressBar.style.width = `${pct}%`;
						if (progressText)
							progressText.textContent = `${done} / ${total} (${pct}%)`;
					}
				});
			});
	} else {
		viewSectionContent.innerHTML += `<p style="text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem;">No hay contenido en esta sección todavía.</p>`;
	}

	// Mostrar el modal
	viewSectionModal.classList.remove("hidden");
}

closeViewSectionModal.addEventListener("click", () => {
	// Si estamos viendo una sección individual y hay un filtro previo, volver al listado
	if (isViewingIndividualSection && previousModalFilter) {
		showFilteredSections(previousModalFilter);
		isViewingIndividualSection = false;
	} else {
		// Si estamos en el listado o no hay filtro previo, cerrar el modal completamente
		viewSectionModal.classList.add("hidden");
		previousModalFilter = null;
		isViewingIndividualSection = false;
	}
});

// Botones de Acceso Rápido
completedBtn.addEventListener("click", () => {
	showFilteredSections("completed");
});

inProgressBtn.addEventListener("click", () => {
	showFilteredSections("in-progress");
});

function showFilteredSections(filter) {
	// Marcar que estamos en un modal de filtro
	previousModalFilter = filter;
	previousModalContent = null;
	isViewingIndividualSection = false; // Estamos en el listado, no en una sección individual

	viewSectionContent.innerHTML = "";

	// Actualizar título en el header del modal
	modalTitle.textContent = filter === "completed" ? "Completado" : "Proceso";
	// Mantener el color personalizado para completado (morado) y proceso (azul)
	if (filter === "completed") {
		modalTitle.style.color = "#7c3aed"; // Morado para completado
	} else {
		modalTitle.style.color = "#2563eb"; // Azul para proceso
	}

	// Ícono - trofeo para completado, reloj para proceso
	const iconContainer = document.createElement("div");
	iconContainer.style.cssText = "text-align: center; margin-bottom: 1.5rem;";

	if (filter === "completed") {
		// Ícono de trofeo (copa) corregido
		iconContainer.innerHTML = `
			<svg style="width: 64px; height: 64px; color: #10b981; margin: 0 auto;" fill="currentColor" viewBox="0 0 24 24">
				<path d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343v.256Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z"/>
			</svg>
		`;
	} else {
		// Ícono de reloj para proceso
		iconContainer.innerHTML = `
			<svg style="width: 64px; height: 64px; color: #3b82f6; margin: 0 auto;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
			</svg>
		`;
	}
	viewSectionContent.appendChild(iconContainer);

	const accessibleTemas = currentUser.accessibleTemas || [];
	let foundSections = false;

	// Recorrer todas las SECCIONES individuales
	userProgress.perSectionTotals.forEach((total, sectionId) => {
		const sectionInfo = sectionsData.get(sectionId);
		if (!sectionInfo) return;

		const temaId = sectionInfo.temaId;
		if (!accessibleTemas.includes(temaId)) return;

		const { done, pct } = calcSectionProgress(sectionId);
		const isCompleted = total > 0 && done === total;
		const isInProgress = total > 0 && done < total; // Cambiado: ahora incluye las que están en 0%

		console.log(
			`Sección: ${sectionInfo.name}, done: ${done}, total: ${total}, isCompleted: ${isCompleted}, isInProgress: ${isInProgress}`
		);

		// Filtrar según el estado
		if (
			(filter === "completed" && isCompleted) ||
			(filter === "in-progress" && isInProgress)
		) {
			foundSections = true;
			const contentItems = sectionInfo.contentItems || [];

			// Tarjeta de la sección estilo mobile
			const sectionCard = document.createElement("div");
			sectionCard.style.cssText =
				"background: #ffffff; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); cursor: pointer; transition: transform 0.2s ease;";

			// Agregar efecto hover
			sectionCard.onmouseenter = () => {
				sectionCard.style.transform = "translateY(-2px)";
				sectionCard.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.12)";
			};
			sectionCard.onmouseleave = () => {
				sectionCard.style.transform = "translateY(0)";
				sectionCard.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.08)";
			};

			// Evento de clic para abrir el contenido de la sección
			sectionCard.addEventListener("click", () => {
				renderSectionContentModal(sectionId, sectionInfo, contentItems);
			});

			sectionCard.innerHTML = `
				<div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
					<div style="width: 64px; height: 64px; border-radius: 0.75rem; overflow: hidden; flex-shrink: 0;">
						<img 
							src="${sectionInfo.imageUrl || "https://via.placeholder.com/64"}" 
							alt="${sectionInfo.name}"
							style="width: 100%; height: 100%; object-fit: cover;"
							onerror="this.src='https://via.placeholder.com/64?text=${encodeURIComponent(
								sectionInfo.name.charAt(0)
							)}'"
						/>
					</div>
					<div style="flex: 1; min-width: 0;">
						<h4 style="font-size: 1.125rem; font-weight: 600; color: #1f2937; margin: 0 0 0.25rem 0;">${
							sectionInfo.name
						}</h4>
						<div style="font-size: 0.875rem; color: #6b7280;">${done} / ${total} (${pct}%)</div>
					</div>
				</div>
				<div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
					<div style="height: 100%; background: ${
						filter === "completed" ? "#10b981" : "#3b82f6"
					}; border-radius: 9999px; transition: width 0.3s ease; width: ${pct}%;"></div>
				</div>
			`;

			viewSectionContent.appendChild(sectionCard);
		}
	});

	if (!foundSections) {
		const emptyMessage = document.createElement("p");
		emptyMessage.style.cssText =
			"text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.875rem;";
		emptyMessage.textContent = `No hay secciones ${
			filter === "completed" ? "completadas" : "en proceso"
		} todavía.`;
		viewSectionContent.appendChild(emptyMessage);
	}

	viewSectionModal.classList.remove("hidden");
}

logoutButton.addEventListener("click", async () => {
	try {
		await signOut(auth);
		sessionStorage.removeItem("username");
		window.location.href = "IniciarSesion.html";
	} catch (error) {
		console.error("Error al cerrar sesión:", error);
	}
});
