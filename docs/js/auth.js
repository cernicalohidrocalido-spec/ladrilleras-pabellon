import { auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "./db.js?v=7";

const loginOverlay = document.getElementById("login-overlay");
const appRoot = document.getElementById("app-root");
const authStatus = document.getElementById("auth-status");
const loginError = document.getElementById("login-error");

function mostrarApp(nombre) {
  loginOverlay.style.display = "none";
  appRoot.style.display = "grid";
  authStatus.textContent = nombre ? `Sesión: ${nombre}` : "Sesión activa";
  window.dispatchEvent(new CustomEvent("cq:autenticado"));
}

function mostrarLogin(mensaje) {
  loginOverlay.style.display = "flex";
  appRoot.style.display = "none";
  authStatus.textContent = "Sin sesión";
  if (mensaje) loginError.textContent = mensaje;
}

// --- Estado de sesión ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    mostrarLogin();
    return;
  }

  // Verifica que el usuario exista en usuarios_sistema y esté activo,
  // ya que las reglas de Firestore dependen de esa colección.
  try {
    const snap = await getDoc(doc(db, "usuarios_sistema", user.uid));
    if (!snap.exists() || snap.data().activo !== true) {
      loginError.textContent =
        "Tu cuenta no está dada de alta como usuario activo del sistema. Contacta al administrador.";
      await signOut(auth);
      return;
    }
    mostrarApp(snap.data().nombre || user.email);
  } catch (err) {
    console.error(err);
    loginError.textContent = "No se pudo verificar tu acceso. Intenta de nuevo.";
    await signOut(auth);
  }
});

// --- Botón de login ---
document.getElementById("login-btn").addEventListener("click", intentarLogin);
document.getElementById("login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") intentarLogin();
});

async function intentarLogin() {
  loginError.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    loginError.textContent = "Ingresa correo y contraseña.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginError.textContent = "Correo o contraseña incorrectos.";
  }
}

// --- Logout ---
document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth);
});
