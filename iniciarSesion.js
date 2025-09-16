import React, {
  useEffect,
  useState,
  useCallback,
} from "https://esm.sh/react@18.3.1";
import ReactDOM from "https://esm.sh/react-dom@18.3.1/client";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function Login() {
  const [users, setUsers] = useState({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingText, setLoadingText] = useState("Inicializando...");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const ensureAnonymous = useCallback(async () => {
    try {
      setLoadingText("Autenticando...");
      await signInAnonymously(auth);
    } catch (e) {
      console.error(e);
      setLoadingText("Error de conexión.");
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (usr) => {
      if (usr) {
        setLoadingText("Conectando a la base de datos...");
        const usersCollection = collection(
          db,
          `/artifacts/${appId}/public/data/users`
        );
        const unsubSnap = onSnapshot(usersCollection, (snapshot) => {
          setLoadingText("Cargando usuarios...");
          const map = {};
          snapshot.forEach((d) => {
            const data = d.data();
            map[data.username?.toLowerCase()] = { ...data, id: d.id };
          });
          setUsers(map);
          setReady(true);
          setLoadingText("");
        });
        return () => unsubSnap();
      } else {
        setReady(false);
        ensureAnonymous();
      }
    });
    return () => unsubAuth();
  }, [ensureAnonymous]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!ready || submitting) return;
    setError("");
    setSubmitting(true);
    const uname = username.trim().toLowerCase();
    const user = users[uname];
    if (user && user.password === password) {
      try {
        const userRef = doc(
          db,
          `/artifacts/${appId}/public/data/users`,
          user.id
        );
        await updateDoc(userRef, { auth_uid: auth.currentUser.uid });
        sessionStorage.setItem("username", uname);
        window.location.href = "admin.html";
      } catch (err) {
        console.error(err);
        setError("Error al iniciar sesión. Inténtalo de nuevo.");
        setSubmitting(false);
      }
    } else {
      setError("Usuario o contraseña incorrectos.");
      setSubmitting(false);
    }
  };

  const disabled = !ready || !username.trim() || !password || submitting;

  return React.createElement(
    "div",
    { className: "w-full max-w-[600px] px-4" },
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "h1",
        { className: "text-center text-2xl font-bold brand-title" },
        "IActiva"
      ),
      React.createElement(
        "p",
        { className: "subtitle text-center mb-4" },
        "Acceso a la plataforma"
      ),
      React.createElement(
        "form",
        { onSubmit: handleLogin, noValidate: true },
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement(
            "label",
            { className: "form-label", htmlFor: "username" },
            "Usuario"
          ),
          React.createElement("input", {
            id: "username",
            type: "text",
            autoComplete: "username",
            placeholder: "Nombre de usuario",
            value: username,
            onChange: (e) => {
              const raw = e.target.value;
              const cleaned = raw.toLowerCase();
              setUsername(cleaned);
              setError("");
            },
            className: "input-base",
          })
        ),
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement(
            "label",
            { className: "form-label", htmlFor: "password" },
            "Contraseña"
          ),
          React.createElement(
            "div",
            { className: "input-wrapper" },
            React.createElement("input", {
              id: "password",
              type: showPassword ? "text" : "password",
              autoComplete: "current-password",
              placeholder: "••••••••",
              value: password,
              onChange: (e) => {
                setPassword(e.target.value);
                setError("");
              },
              className: "input-base",
            }),
            React.createElement(
              "button",
              {
                type: "button",
                className: "toggle-password",
                onClick: () => setShowPassword((s) => !s),
                "aria-label": showPassword
                  ? "Ocultar contraseña"
                  : "Mostrar contraseña",
              },
              showPassword
                ? React.createElement(
                    "svg",
                    {
                      xmlns: "http://www.w3.org/2000/svg",
                      width: 20,
                      height: 20,
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      className: "icon-eye-off",
                    },
                    React.createElement("path", {
                      d: "M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.81 21.81 0 0 1 5.06-6.94",
                    }),
                    React.createElement("path", { d: "M1 1l22 22" }),
                    React.createElement("path", {
                      d: "M9.53 9.53A3.5 3.5 0 0 0 12 15.5a3.5 3.5 0 0 0 3.18-4.87",
                    })
                  )
                : React.createElement(
                    "svg",
                    {
                      xmlns: "http://www.w3.org/2000/svg",
                      width: 20,
                      height: 20,
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: 2,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      className: "icon-eye",
                    },
                    React.createElement("path", {
                      d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z",
                    }),
                    React.createElement("circle", { cx: 12, cy: 12, r: 3 })
                  )
            )
          )
        ),
        disabled
          ? React.createElement(
              "div",
              { className: "info-msg" },
              loadingText || "Cargando..."
            )
          : null,
        error
          ? React.createElement(
              "div",
              { className: "error-msg", role: "alert" },
              error
            )
          : null,
        React.createElement("div", { className: "divider" }),
        React.createElement(
          "button",
          { type: "submit", disabled, className: "submit-btn" },
          submitting ? "Cargando..." : "Entrar"
        ),
        React.createElement(
          "div",
          { className: "footer-hint" },
          "Acceso restringido — uso interno educativo"
        )
      )
    )
  );
}

function mount() {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(Login));
}

mount();
