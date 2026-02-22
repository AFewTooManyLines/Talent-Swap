import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  setDoc,
  doc,
  serverTimestamp,
  getDocs,
  collection,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-Ex97OdxkzcD8gJyTp1AVn79xTNId_kM",
  authDomain: "talentswap-bcea8.firebaseapp.com",
  projectId: "talentswap-bcea8",
  storageBucket: "talentswap-bcea8.firebasestorage.app",
  messagingSenderId: "445238511776",
  appId: "1:445238511776:web:b9525e2d8d08c8ccea21c5",
  measurementId: "G-YNPHVY5LRE",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const page = document.body.dataset.page;

initStarfield();
initTiltCards();

if (page === "signup") initSignup();
if (page === "signin") initSignin();
if (page === "profiles") initProfiles();
if (page === "profile") initProfilePage();

function initSignup() {
  const form = document.getElementById("signupForm");
  const status = document.getElementById("signupStatus");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const displayName = String(formData.get("displayName") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const talents = String(formData.get("talents") || "")
      .split(",")
      .map((talent) => talent.trim())
      .filter(Boolean);

    try {
      status.textContent = "Creating account...";
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      await updateProfile(credential.user, { displayName });

      await setDoc(doc(db, "users", uid), {
        uid,
        displayName,
        email,
        talents,
        signUpDate: new Date().toISOString(),
        signUpDateReadable: new Date().toLocaleDateString(),
        passwordManagedBy: "firebase-auth",
        createdAt: serverTimestamp(),
      });

      status.textContent = "Account created. Redirecting to profiles...";
      setTimeout(() => (window.location.href = "profiles.html"), 700);
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function initSignin() {
  const form = document.getElementById("signinForm");
  const status = document.getElementById("signinStatus");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    try {
      status.textContent = "Signing in...";
      await signInWithEmailAndPassword(auth, email, password);
      status.textContent = "Signed in. Redirecting...";
      setTimeout(() => (window.location.href = "profiles.html"), 450);
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function initProfiles() {
  const list = document.getElementById("profilesList");
  const search = document.getElementById("profileSearch");
  const sessionEmail = document.getElementById("sessionEmail");
  const logoutBtn = document.getElementById("logoutBtn");

  let users = [];

  onAuthStateChanged(auth, (user) => {
    sessionEmail.textContent = user ? `Signed in as ${user.email}` : "Viewing as guest";
    logoutBtn.style.display = user ? "inline-flex" : "none";
  });

  logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "signin.html";
  });

  const snapshot = await getDocs(collection(db, "users"));
  users = snapshot.docs.map((entry) => entry.data());
  renderProfiles(list, users);

  search?.addEventListener("input", (event) => {
    const term = String(event.target.value || "").toLowerCase().trim();
    const filtered = users.filter((user) => {
      const talentJoined = Array.isArray(user.talents) ? user.talents.join(" ") : "";
      return [user.displayName, user.email, talentJoined].join(" ").toLowerCase().includes(term);
    });
    renderProfiles(list, filtered);
  });
}

function renderProfiles(element, users) {
  if (!element) return;
  if (!users.length) {
    element.innerHTML = '<p class="muted">No profiles found yet.</p>';
    return;
  }

  element.innerHTML = users
    .map(
      (user) => `
      <a class="glass-card tilt-card profile-card" href="profile.html?uid=${user.uid}">
        <h3>${escapeHtml(user.displayName || "Unnamed user")}</h3>
        <p class="muted">${escapeHtml(user.email || "No email")}</p>
        <p><strong>Sign up date:</strong> ${escapeHtml(user.signUpDateReadable || "-")}</p>
        <div class="chips">${(user.talents || []).map((talent) => `<span class="chip">${escapeHtml(talent)}</span>`).join("")}</div>
      </a>
    `,
    )
    .join("");

  initTiltCards();
}

async function initProfilePage() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  const container = document.getElementById("profileDetail");

  if (!uid || !container) {
    if (container) container.innerHTML = "<p>User not found.</p>";
    return;
  }

  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    container.innerHTML = "<p>Sorry, that profile does not exist.</p>";
    return;
  }

  const user = snapshot.data();

  container.innerHTML = `
    <article class="auth-card pop-in">
      <h1>${escapeHtml(user.displayName || "Anonymous")}</h1>
      <p><strong>Email:</strong> ${escapeHtml(user.email || "Not shared")}</p>
      <p><strong>Sign up date:</strong> ${escapeHtml(user.signUpDateReadable || "-")}</p>
      <h3>Talents</h3>
      <div class="chips">${(user.talents || []).map((talent) => `<span class="chip">${escapeHtml(talent)}</span>`).join("") || '<span class="muted">No talents listed.</span>'}</div>
    </article>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initTiltCards() {
  const cards = document.querySelectorAll(".tilt-card");
  cards.forEach((card) => {
    card.onmousemove = (event) => {
      const rect = card.getBoundingClientRect();
      const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
      const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateX(${offsetY * -8}deg) rotateY(${offsetX * 8}deg)`;
    };
    card.onmouseleave = () => {
      card.style.transform = "perspective(600px) rotateX(0) rotateY(0)";
    };
  });
}

function initStarfield() {
  const canvas = document.getElementById("starCanvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const stars = [];
  const amount = 120;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener("resize", resize);
  resize();

  for (let i = 0; i < amount; i += 1) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.8,
      speed: 0.08 + Math.random() * 0.35,
    });
  }

  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(28, 23, 46, 0.95)";

    stars.forEach((star) => {
      star.y += star.speed;
      if (star.y > canvas.height) {
        star.y = -2;
        star.x = Math.random() * canvas.width;
      }

      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    });

    requestAnimationFrame(draw);
  }

  draw();
}
