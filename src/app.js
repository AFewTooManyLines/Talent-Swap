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
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-Ex97OdxkzcD8gJyTp1AVn79xTNId_kM",
  authDomain: "talentswap-bcea8.firebaseapp.com",
  projectId: "talentswap-bcea8",
  storageBucket: "talentswap-bcea8.appspot.com",
  messagingSenderId: "445238511776",
  appId: "1:445238511776:web:b9525e2d8d08c8ccea21c5",
  measurementId: "G-YNPHVY5LRE",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const storageFallback = getStorage(app, `gs://${firebaseConfig.projectId}.firebasestorage.app`);
const page = document.body.dataset.page;
const privatePages = new Set(["profiles", "find-match", "alerts", "settings", "connections"]);

initTheme();
initStarfield();
initTiltCards();
setupAuthRouter();
window.lucide?.createIcons();

if (page === "signup") initSignup();
if (page === "signin") initSignin();
if (page === "profile") initProfilePage();

function setupAuthRouter() {
  onAuthStateChanged(auth, async (user) => {
    if (page === "landing" && user) return window.location.replace("profiles.html");
    if ((page === "signin" || page === "signup") && user) return window.location.replace("profiles.html");
    if (privatePages.has(page) && !user) return window.location.replace("signin.html");
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
  if (profileLabel) profileLabel.textContent = profileData.displayName || user.displayName || "Profile";
  if (profileLink) profileLink.href = `profile.html?uid=${user.uid}`;
  logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("signin.html");
  });

  const alertQuery = query(collection(db, "alerts"), where("toUid", "==", user.uid), where("status", "==", "pending"));
  onSnapshot(alertQuery, (snapshot) => {
    const amount = snapshot.size;
    document.getElementById("alertDot")?.classList.toggle("visible", amount > 0);
    const count = document.getElementById("alertCount");
    if (count) count.textContent = amount > 0 ? `${amount}` : "";
  });
  window.lucide?.createIcons();
}

function initSignup() {
  const form = document.getElementById("signupForm");
  const status = document.getElementById("signupStatus");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const displayName = String(fd.get("displayName") || "").trim();
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const talents = parseCommaList(fd.get("talents"));
    try {
      status.textContent = "Creating account...";
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      await updateProfile(credential.user, { displayName });
      await setDoc(doc(db, "users", uid), {
        uid, displayName, email, talents,
        description: "",
        photoURL: "", bannerURL: "",
        createdAt: serverTimestamp(),
      });
      status.textContent = "Account created. Redirecting...";
      setTimeout(() => (window.location.href = "profiles.html"), 500);
    } catch (error) { status.textContent = error.message; }
  });
}

function initSignin() {
  const form = document.getElementById("signinForm");
  const status = document.getElementById("signinStatus");
  const resetBtn = document.getElementById("resetPasswordBtn");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    try {
      status.textContent = "Signing in...";
      await signInWithEmailAndPassword(auth, email, password);
      status.textContent = "Signed in.";
      setTimeout(() => (window.location.href = "profiles.html"), 300);
    } catch (error) { status.textContent = error.message; }
  });

  resetBtn?.addEventListener("click", async () => {
    const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
    if (!email) return (status.textContent = "Enter your email first.");
    try {
      await sendPasswordResetEmail(auth, email);
      status.textContent = "Reset email sent.";
    } catch (error) { status.textContent = error.message; }
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
    const filtered = users.filter((profile) => [profile.displayName, profile.email, profile.description, ...(profile.talents || [])].join(" ").toLowerCase().includes(term.trim().toLowerCase()));
    if (!filtered.length) return (list.innerHTML = '<p class="muted">No matching users found.</p>');

    list.innerHTML = filtered.map((profile) => {
      const options = (profile.talents || []).length
        ? (profile.talents || []).map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")
        : '<option value="General talent">General talent</option>';
      return `<article class="row-card">
          <div>
            <img class="profile-banner" src="${escapeHtml(getBanner(profile))}" alt="Banner" />
            <div class="row-main">
              <img class="profile-avatar" src="${escapeHtml(getAvatar(profile))}" alt="Avatar" />
              <div>
                <h3>${escapeHtml(profile.displayName || "Unnamed")}</h3>
                <p class="muted">${escapeHtml(profile.email || "No email")}</p>
                <p class="profile-description">${escapeHtml(profile.description || "No profile description yet.")}</p>
                <div class="chips">${(profile.talents || []).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>
              </div>
            </div>
          </div>
          <div class="row-actions">
            <a class="ghost-btn" href="profile.html?uid=${profile.uid}" aria-label="Open profile"><i data-lucide="external-link"></i></a>
            <select id="talent-${profile.uid}" class="tiny-select">${options}</select>
            <button class="primary-btn invite-btn" data-user-id="${profile.uid}" data-user-name="${escapeHtml(profile.displayName || "User")}"><i data-lucide="send"></i></button>
          </div>
        </article>`;
    }).join("");

    list.querySelectorAll(".invite-btn").forEach((button) => button.addEventListener("click", () => sendInvite(user, button, status)));
    window.lucide?.createIcons();
  };

  render();
  search?.addEventListener("input", (event) => render(String(event.target.value || "")));
}

async function sendInvite(currentUser, button, statusElement, selectedTalent) {
  const toUid = button.dataset.userId;
  const toName = button.dataset.userName || "User";
  const talent = selectedTalent || document.getElementById(`talent-${toUid}`)?.value || "General talent";
  const me = await getDoc(doc(db, "users", currentUser.uid));
  const currentData = me.exists() ? me.data() : {};
  await addDoc(collection(db, "alerts"), { fromUid: currentUser.uid, fromName: currentData.displayName || currentUser.displayName || currentUser.email, fromEmail: currentUser.email || "", toUid, toName, talent, status: "pending", createdAt: serverTimestamp() });
  statusElement.textContent = `Invite sent to ${toName} for ${talent}.`;
}

async function initFindMatch(user) { /* unchanged behavior */
  const list = document.getElementById("matchList");
  const input = document.getElementById("matchSearch");
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const userData = userDoc.exists() ? userDoc.data() : {};
  const snapshot = await getDocs(collection(db, "users"));
  const users = snapshot.docs.map((entry) => entry.data()).filter((entry) => entry.uid !== user.uid);
  const render = (term = "") => {
    const t = term.trim().toLowerCase();
    const matches = users.filter((entry) => (entry.talents || []).some((talent) => talent.toLowerCase().includes(t)));
    if (!t) return (list.innerHTML = '<p class="muted">Type a talent you are looking for to find matches.</p>');
    if (!matches.length) return (list.innerHTML = '<p class="muted">No matches yet for that talent.</p>');
    list.innerHTML = matches.map((entry) => `<article class="row-card"><div><h3>${escapeHtml(entry.displayName || "Unnamed")}</h3><div class="chips">${(entry.talents || []).map((talent) => `<span class="chip">${escapeHtml(talent)}</span>`).join("")}</div></div><a class="ghost-btn" href="profile.html?uid=${entry.uid}"><i data-lucide="user-round"></i></a></article>`).join("");
    window.lucide?.createIcons();
  };
  input.value = (userData.talents || [""])[0] || "";
  render(input.value);
  input?.addEventListener("input", (event) => render(String(event.target.value || "")));
}

async function initAlerts(user) { /* kept */
  const incoming = document.getElementById("incomingAlerts");
  const outgoing = document.getElementById("outgoingAlerts");
  onSnapshot(query(collection(db, "alerts"), where("toUid", "==", user.uid)), (snapshot) => {
    const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    incoming.innerHTML = items.length ? items.map((alert) => `<article class="row-card"><div><h3>${escapeHtml(alert.fromName || "Unknown user")}</h3><p class="muted">Request for: ${escapeHtml(alert.talent || "General talent")}</p><p class="status-pill ${alert.status}">${escapeHtml(alert.status)}</p></div>${alert.status === "pending" ? `<div class="row-actions"><button class="primary-btn accept-btn" data-id="${alert.id}"><i data-lucide="check"></i></button><button class="ghost-btn decline-btn" data-id="${alert.id}"><i data-lucide="x"></i></button></div>` : ""}</article>`).join("") : '<p class="muted">No incoming alerts right now.</p>';
    incoming.querySelectorAll(".accept-btn").forEach((b) => b.addEventListener("click", async () => updateDoc(doc(db, "alerts", b.dataset.id), { status: "accepted" })));
    incoming.querySelectorAll(".decline-btn").forEach((b) => b.addEventListener("click", async () => updateDoc(doc(db, "alerts", b.dataset.id), { status: "declined" })));
    window.lucide?.createIcons();
  });
  onSnapshot(query(collection(db, "alerts"), where("fromUid", "==", user.uid)), (snapshot) => {
    const items = snapshot.docs.map((entry) => entry.data());
    outgoing.innerHTML = items.length ? items.map((alert) => `<article class="row-card"><div><h3>${escapeHtml(alert.toName || "User")}</h3><p class="muted">Talent: ${escapeHtml(alert.talent || "General talent")}</p></div><p class="status-pill ${alert.status}">${escapeHtml(alert.status || "pending")}</p></article>`).join("") : '<p class="muted">No outgoing requests yet.</p>';
  });
}

async function initSettings(user) {
  const form = document.getElementById("settingsForm");
  const status = document.getElementById("settingsStatus");
  const displayName = document.getElementById("settingsDisplayName");
  const talents = document.getElementById("settingsTalents");
  const description = document.getElementById("settingsDescription");
  const avatarInput = document.getElementById("settingsAvatar");
  const bannerInput = document.getElementById("settingsBanner");
  const avatarPreview = document.getElementById("avatarPreview");
  const bannerPreview = document.getElementById("bannerPreview");

  const snapshot = await getDoc(doc(db, "users", user.uid));
  const data = snapshot.exists() ? snapshot.data() : {};
  displayName.value = data.displayName || "";
  talents.value = (data.talents || []).join(", ");
  description.value = data.description || "";
  avatarPreview.src = getAvatar(data);
  bannerPreview.src = getBanner(data);

  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    avatarPreview.src = URL.createObjectURL(file);
  });

  bannerInput?.addEventListener("change", () => {
    const file = bannerInput.files?.[0];
    if (!file) return;
    bannerPreview.src = URL.createObjectURL(file);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      status.textContent = "Saving...";
      const next = {
        displayName: displayName.value.trim(),
        talents: parseCommaList(talents.value),
        description: description.value.trim(),
      };
      if (avatarInput?.files?.[0]) next.photoURL = await uploadImage(user.uid, avatarInput.files[0], "avatar");
      if (bannerInput?.files?.[0]) next.bannerURL = await uploadImage(user.uid, bannerInput.files[0], "banner");
      await updateDoc(doc(db, "users", user.uid), next);
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: next.displayName, photoURL: next.photoURL || data.photoURL || "" });
      avatarPreview.src = getAvatar({ ...data, ...next });
      bannerPreview.src = getBanner({ ...data, ...next });
      status.textContent = "Profile updated successfully.";
    } catch (error) {
      status.textContent = `Unable to save settings: ${error.message}`;
    }
  });
}

async function uploadImage(uid, file, type) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `users/${uid}/${type}-${Date.now()}-${safeName}`;
  const storages = [storage, storageFallback];

  let latestError;
  for (const targetStorage of storages) {
    try {
      const fileRef = ref(targetStorage, path);
      await uploadBytes(fileRef, file, { contentType: file.type || "application/octet-stream" });
      return await getDownloadURL(fileRef);
    } catch (error) {
      latestError = error;
    }
  }

  throw latestError || new Error("Image upload failed.");
}

async function initConnections(user) {
  const list = document.getElementById("connectionsList");
  const incomingAccepted = await getDocs(query(collection(db, "alerts"), where("toUid", "==", user.uid), where("status", "==", "accepted")));
  const outgoingAccepted = await getDocs(query(collection(db, "alerts"), where("fromUid", "==", user.uid), where("status", "==", "accepted")));
  const connections = [...incomingAccepted.docs.map((e) => ({ direction: "incoming", ...e.data() })), ...outgoingAccepted.docs.map((e) => ({ direction: "outgoing", ...e.data() }))];
  if (!connections.length) return (list.innerHTML = '<p class="muted">No active connections yet. Accept alerts to connect.</p>');
  list.innerHTML = connections.map((item) => `<article class="row-card"><div><h3>${escapeHtml((item.direction === "incoming" ? item.fromName : item.toName) || "Connection")}</h3><p class="muted">Connected for talent: ${escapeHtml(item.talent || "General")}</p></div><p class="status-pill accepted">Connected</p></article>`).join("");
}

async function initProfilePage() {
  const uid = new URLSearchParams(window.location.search).get("uid");
  const container = document.getElementById("profileDetail");
  if (!uid || !container) return;
  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return (container.innerHTML = "<p>Sorry, that profile does not exist.</p>");
  const user = snapshot.data();
  const talents = user.talents || [];
  const canInvite = auth.currentUser && auth.currentUser.uid !== uid;
  const inviteOptions = talents.length
    ? talents.map((talent) => `<option value="${escapeHtml(talent)}">${escapeHtml(talent)}</option>`).join("")
    : '<option value="General talent">General talent</option>';

  container.innerHTML = `<article class="auth-card pop-in profile-detail-card"><img class="profile-banner" src="${escapeHtml(getBanner(user))}" alt="Banner" /><div class="profile-hero"><img class="profile-avatar large" src="${escapeHtml(getAvatar(user))}" alt="Avatar" /><div><h1>${escapeHtml(user.displayName || "Anonymous")}</h1><p><strong>Email:</strong> ${escapeHtml(user.email || "Not shared")}</p><p class="profile-description"><strong>Description:</strong> ${escapeHtml(user.description || "No profile description yet.")}</p></div></div><h3>Talents</h3><div class="chips">${talents.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("") || '<span class="muted">No talents listed.</span>'}</div>${canInvite ? `<div class="row-actions profile-invite-actions"><select id="profileTalentSelect" class="tiny-select">${inviteOptions}</select><button id="profileInviteBtn" class="primary-btn" data-user-id="${user.uid}" data-user-name="${escapeHtml(user.displayName || "User")}"><i data-lucide="send"></i> Send connection request</button></div><p id="profileInviteStatus" class="status"></p>` : ""}</article>`;

  if (canInvite && auth.currentUser) {
    const inviteButton = document.getElementById("profileInviteBtn");
    const inviteStatus = document.getElementById("profileInviteStatus");
    inviteButton?.addEventListener("click", async () => {
      const selectedTalent = document.getElementById("profileTalentSelect")?.value || "General talent";
      await sendInvite(auth.currentUser, inviteButton, inviteStatus, selectedTalent);
    });
  }

  window.lucide?.createIcons();
}

function getAvatar(profile = {}) {
  const avatar = profile.photoURL || profile.photoUrl || profile.avatarURL || profile.avatarUrl || profile.profilePicture || profile.profilePictureURL;
  return avatar || "https://api.iconify.design/lucide:user-round.svg?color=%23777777";
}
function getBanner(profile = {}) {
  const banner = profile.bannerURL || profile.bannerUrl || profile.coverURL || profile.coverUrl || profile.bannerImage;
  return banner || "https://singlecolorimage.com/get/999999/1200x300";
}
function parseCommaList(value) { return String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean); }
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
function escapeHtml(text) { return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function initTiltCards() { document.querySelectorAll(".tilt-card").forEach((card) => { card.onmousemove = (event) => { const rect = card.getBoundingClientRect(); const offsetX = (event.clientX - rect.left) / rect.width - 0.5; const offsetY = (event.clientY - rect.top) / rect.height - 0.5; card.style.transform = `perspective(600px) rotateX(${offsetY * -8}deg) rotateY(${offsetX * 8}deg)`; }; card.onmouseleave = () => { card.style.transform = "perspective(600px) rotateX(0) rotateY(0)"; }; }); }
function initStarfield() {
  const canvas = document.getElementById("starCanvas");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const stars = [];
  const amount = 110;
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  window.addEventListener("resize", resize);
  resize();
  for (let i = 0; i < amount; i += 1) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.8, speed: 0.08 + Math.random() * 0.35 });
  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255, 196, 0, 0.5)";
    stars.forEach((star) => { star.y += star.speed; if (star.y > canvas.height) { star.y = -2; star.x = Math.random() * canvas.width; } context.beginPath(); context.arc(star.x, star.y, star.radius, 0, Math.PI * 2); context.fill(); });
    requestAnimationFrame(draw);
  };
  draw();
}
