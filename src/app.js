import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  setDoc,
  doc,
  serverTimestamp,
  getDocs,
  collection,
  getDoc,
  query,
  where,
  addDoc,
  updateDoc,
  onSnapshot,
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
const privatePages = new Set(["profiles", "find-match", "alerts", "settings", "connections"]);

initTheme();
initStarfield();
initTiltCards();
setupAuthRouter();

if (page === "signup") initSignup();
if (page === "signin") initSignin();
if (page === "profile") initProfilePage();

function setupAuthRouter() {
  onAuthStateChanged(auth, async (user) => {
    if (page === "landing" && user) {
      window.location.replace("profiles.html");
      return;
    }

    if ((page === "signin" || page === "signup") && user) {
      window.location.replace("profiles.html");
      return;
    }

    if (privatePages.has(page) && !user) {
      window.location.replace("signin.html");
      return;
    }

    if (privatePages.has(page) && user) {
      await initDashboardLayout(user);
      if (page === "profiles") await initDashboard(user);
      if (page === "find-match") await initFindMatch(user);
      if (page === "alerts") await initAlerts(user);
      if (page === "settings") await initSettings(user);
      if (page === "connections") await initConnections(user);
    }
  });
}

async function initDashboardLayout(user) {
  const profileLabel = document.getElementById("profileLabel");
  const profileLink = document.getElementById("profileLink");
  const logoutBtn = document.getElementById("logoutBtn");

  const profileDoc = await getDoc(doc(db, "users", user.uid));
  const profileData = profileDoc.exists() ? profileDoc.data() : {};

  if (profileLabel) {
    profileLabel.textContent = profileData.displayName || user.displayName || "Profile";
  }

  if (profileLink) {
    profileLink.href = `profile.html?uid=${user.uid}`;
  }

  logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("signin.html");
  });

  const alertQuery = query(collection(db, "alerts"), where("toUid", "==", user.uid), where("status", "==", "pending"));
  onSnapshot(alertQuery, (snapshot) => {
    const dot = document.getElementById("alertDot");
    const count = document.getElementById("alertCount");
    const amount = snapshot.size;
    if (dot) dot.classList.toggle("visible", amount > 0);
    if (count) count.textContent = amount > 0 ? `${amount}` : "";
  });

  if (window.lucide) window.lucide.createIcons();
}

function initSignup() {
  const form = document.getElementById("signupForm");
  const status = document.getElementById("signupStatus");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const displayName = String(formData.get("displayName") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const talents = parseCommaList(formData.get("talents"));

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
        createdAt: serverTimestamp(),
        signUpDateReadable: new Date().toLocaleDateString(),
      });

      status.textContent = "Account created. Redirecting...";
      setTimeout(() => (window.location.href = "profiles.html"), 500);
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function initSignin() {
  const form = document.getElementById("signinForm");
  const status = document.getElementById("signinStatus");
  const resetBtn = document.getElementById("resetPasswordBtn");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    try {
      status.textContent = "Signing in...";
      await signInWithEmailAndPassword(auth, email, password);
      status.textContent = "Signed in.";
      setTimeout(() => (window.location.href = "profiles.html"), 300);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  resetBtn?.addEventListener("click", async () => {
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();

    if (!email) {
      status.textContent = "Enter your email first.";
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      status.textContent = "Password reset email sent.";
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function initDashboard(user) {
  const list = document.getElementById("profilesList");
  const search = document.getElementById("profileSearch");
  const status = document.getElementById("dashboardStatus");

  const snapshot = await getDocs(collection(db, "users"));
  const users = snapshot.docs.map((entry) => entry.data()).filter((entry) => entry.uid !== user.uid);

  const render = (term = "") => {
    const normalized = term.trim().toLowerCase();
    const filtered = users.filter((profile) => {
      const blob = [profile.displayName, profile.email, ...(profile.talents || [])].join(" ").toLowerCase();
      return blob.includes(normalized);
    });

    if (!filtered.length) {
      list.innerHTML = '<p class="muted">No matching users found.</p>';
      return;
    }

    list.innerHTML = filtered
      .map((profile) => {
        const options = (profile.talents || []).map((talent) => `<option value="${escapeHtml(talent)}">${escapeHtml(talent)}</option>`).join("");
        return `
          <article class="row-card">
            <div>
              <h3>${escapeHtml(profile.displayName || "Unnamed")}</h3>
              <p class="muted">${escapeHtml(profile.email || "No email")}</p>
              <div class="chips">${(profile.talents || []).map((talent) => `<span class="chip">${escapeHtml(talent)}</span>`).join("")}</div>
            </div>
            <div class="row-actions">
              <select id="talent-${profile.uid}" class="tiny-select">${options}</select>
              <button class="primary-btn invite-btn" data-user-id="${profile.uid}" data-user-name="${escapeHtml(profile.displayName || "User")}">
                <i data-lucide="send"></i> Send
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    list.querySelectorAll(".invite-btn").forEach((button) => {
      button.addEventListener("click", () => sendInvite(user, button, status));
    });

    if (window.lucide) window.lucide.createIcons();
  };

  render();
  search?.addEventListener("input", (event) => render(String(event.target.value || "")));
}

async function sendInvite(currentUser, button, statusElement) {
  const toUid = button.dataset.userId;
  const toName = button.dataset.userName || "User";
  const select = document.getElementById(`talent-${toUid}`);
  const talent = select?.value || "General talent";

  const currentDoc = await getDoc(doc(db, "users", currentUser.uid));
  const currentData = currentDoc.exists() ? currentDoc.data() : {};

  await addDoc(collection(db, "alerts"), {
    fromUid: currentUser.uid,
    fromName: currentData.displayName || currentUser.displayName || currentUser.email,
    fromEmail: currentUser.email || "",
    toUid,
    toName,
    talent,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  statusElement.textContent = `Invite sent to ${toName} for ${talent}.`;
}

async function initFindMatch(user) {
  const list = document.getElementById("matchList");
  const input = document.getElementById("matchSearch");
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const userData = userDoc.exists() ? userDoc.data() : {};

  const snapshot = await getDocs(collection(db, "users"));
  const users = snapshot.docs.map((entry) => entry.data()).filter((entry) => entry.uid !== user.uid);

  const render = (searchTerm) => {
    const term = (searchTerm || "").trim().toLowerCase();
    const matches = users.filter((entry) => (entry.talents || []).some((talent) => talent.toLowerCase().includes(term)));

    if (!term) {
      list.innerHTML = '<p class="muted">Type a talent you are looking for to find matches.</p>';
      return;
    }

    if (!matches.length) {
      list.innerHTML = '<p class="muted">No matches yet for that talent.</p>';
      return;
    }

    list.innerHTML = matches
      .map(
        (entry) => `
      <article class="row-card">
        <div>
          <h3>${escapeHtml(entry.displayName || "Unnamed")}</h3>
          <div class="chips">${(entry.talents || []).map((talent) => `<span class="chip">${escapeHtml(talent)}</span>`).join("")}</div>
        </div>
        <a class="ghost-btn" href="profile.html?uid=${entry.uid}"><i data-lucide="user-round"></i> View profile</a>
      </article>`,
      )
      .join("");

    if (window.lucide) window.lucide.createIcons();
  };

  input.value = (userData.talents || [""])[0] || "";
  render(input.value);
  input?.addEventListener("input", (event) => render(String(event.target.value || "")));
}

async function initAlerts(user) {
  const incoming = document.getElementById("incomingAlerts");
  const outgoing = document.getElementById("outgoingAlerts");

  const incomingQuery = query(collection(db, "alerts"), where("toUid", "==", user.uid));
  const outgoingQuery = query(collection(db, "alerts"), where("fromUid", "==", user.uid));

  onSnapshot(incomingQuery, (snapshot) => {
    const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    incoming.innerHTML = items.length
      ? items
          .map(
            (alert) => `
        <article class="row-card">
          <div>
            <h3>${escapeHtml(alert.fromName || "Unknown user")}</h3>
            <p class="muted">Request for: ${escapeHtml(alert.talent || "General talent")}</p>
            <p class="status-pill ${alert.status}">${escapeHtml(alert.status)}</p>
          </div>
          ${
            alert.status === "pending"
              ? `<div class="row-actions">
                <button class="primary-btn accept-btn" data-id="${alert.id}"><i data-lucide="check"></i> Accept</button>
                <button class="ghost-btn decline-btn" data-id="${alert.id}"><i data-lucide="x"></i> Decline</button>
              </div>`
              : ""
          }
        </article>`,
          )
          .join("")
      : '<p class="muted">No incoming alerts right now.</p>';

    incoming.querySelectorAll(".accept-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await updateDoc(doc(db, "alerts", button.dataset.id), { status: "accepted" });
      });
    });

    incoming.querySelectorAll(".decline-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        await updateDoc(doc(db, "alerts", button.dataset.id), { status: "declined" });
      });
    });

    if (window.lucide) window.lucide.createIcons();
  });

  onSnapshot(outgoingQuery, (snapshot) => {
    const items = snapshot.docs.map((entry) => entry.data());
    outgoing.innerHTML = items.length
      ? items
          .map(
            (alert) => `
      <article class="row-card">
        <div>
          <h3>${escapeHtml(alert.toName || "User")}</h3>
          <p class="muted">Talent: ${escapeHtml(alert.talent || "General talent")}</p>
        </div>
        <p class="status-pill ${alert.status}">${escapeHtml(alert.status || "pending")}</p>
      </article>`,
          )
          .join("")
      : '<p class="muted">No outgoing requests yet.</p>';
  });
}

async function initSettings(user) {
  const form = document.getElementById("settingsForm");
  const status = document.getElementById("settingsStatus");
  const displayName = document.getElementById("settingsDisplayName");
  const talents = document.getElementById("settingsTalents");

  const snapshot = await getDoc(doc(db, "users", user.uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  displayName.value = data.displayName || "";
  talents.value = (data.talents || []).join(", ");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nextName = displayName.value.trim();
    const nextTalents = parseCommaList(talents.value);

    await updateDoc(doc(db, "users", user.uid), {
      displayName: nextName,
      talents: nextTalents,
    });

    if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: nextName });
    status.textContent = "Profile updated successfully.";
  });
}

async function initConnections(user) {
  const list = document.getElementById("connectionsList");
  const incomingAccepted = await getDocs(
    query(collection(db, "alerts"), where("toUid", "==", user.uid), where("status", "==", "accepted")),
  );
  const outgoingAccepted = await getDocs(
    query(collection(db, "alerts"), where("fromUid", "==", user.uid), where("status", "==", "accepted")),
  );

  const connections = [
    ...incomingAccepted.docs.map((entry) => ({ direction: "incoming", ...entry.data() })),
    ...outgoingAccepted.docs.map((entry) => ({ direction: "outgoing", ...entry.data() })),
  ];

  if (!connections.length) {
    list.innerHTML = '<p class="muted">No active connections yet. Accept alerts to connect.</p>';
    return;
  }

  list.innerHTML = connections
    .map((item) => {
      const peer = item.direction === "incoming" ? item.fromName : item.toName;
      return `
        <article class="row-card">
          <div>
            <h3>${escapeHtml(peer || "Connection")}</h3>
            <p class="muted">Connected for talent: ${escapeHtml(item.talent || "General")}</p>
          </div>
          <p class="status-pill accepted">Connected</p>
        </article>
      `;
    })
    .join("");
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
      <h3>Talents</h3>
      <div class="chips">${(user.talents || []).map((talent) => `<span class="chip">${escapeHtml(talent)}</span>`).join("") || '<span class="muted">No talents listed.</span>'}</div>
    </article>
  `;
}

function parseCommaList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.body.dataset.theme = saved;

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-action='toggle-theme']");
    if (!toggle) return;

    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
  });
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
  const amount = 110;

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
    context.fillStyle = "rgba(62, 79, 110, 0.55)";

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
