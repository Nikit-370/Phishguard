/* ═══════════════════════════════════════════════════════════
   PhishGuard — Authentication Management (Basic Auth)
   Handles auth state, UI updates, and session management.
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
    initAuth();
});

function initAuth() {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.addEventListener('click', () => window.location.href = '/login');
    if (registerBtn) registerBtn.addEventListener('click', () => window.location.href = '/login');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Instant pre-render from localStorage to prevent navbar flash
    const creds = localStorage.getItem('system_auth');
    const cachedUser = localStorage.getItem('system_user');
    if (creds && cachedUser) {
        try {
            updateAuthUI(JSON.parse(cachedUser));
        } catch (e) { /* ignore parse errors */ }
    }

    // Then verify in background (will correct if session expired)
    checkAuthStatus();
}

/* ── Check stored auth credentials against the server ── */
async function checkAuthStatus() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) { updateAuthUI(null); return; }
    try {
        const res = await fetch('/api/auth/verify', {
            headers: { 'Authorization': 'Basic ' + creds }
        });
        if (!res.ok) { handleLogout(); return; }
        const payload = await res.json();
        const user = payload.user || payload;
        const userObj = {
            id: user.id,
            name: user.username || user.name || user.email,
            email: user.email || user.username,
            is_admin: !!user.is_admin,
            role: user.is_admin ? 'admin' : 'user'
        };
        localStorage.setItem('system_user', JSON.stringify(userObj));
        updateAuthUI(userObj);
    } catch (err) {
        console.error('Auth check failed:', err);
        updateAuthUI(null);
    }
}

/* ── Logout ── */
function handleLogout() {
    localStorage.removeItem('system_auth');
    localStorage.removeItem('system_user');
    // Clear any background heartbeats (admin stats) if present
    try { if (typeof window.clearStatsHeartbeat === 'function') window.clearStatsHeartbeat(); } catch(e) {}
    updateAuthUI(null);
    if (typeof showToast === 'function') {
        showToast('You have been logged out', 'info');
    }
    if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('admin')) {
        setTimeout(() => { window.location.href = '/login'; }, 500);
    }
}

/* ── Update UI based on auth state ── */
function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminLink = document.getElementById('admin-link');
    const userGreeting = document.getElementById('user-greeting');
    const navbar = document.getElementById('main-navbar');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (adminLink) adminLink.style.display = user.is_admin ? 'block' : 'none';
        if (userGreeting) {
            userGreeting.textContent = `Welcome, ${user.name}`;
            userGreeting.classList.remove('d-none');
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'flex';
        if (registerBtn) registerBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (userGreeting) {
            userGreeting.classList.add('d-none');
            userGreeting.textContent = '';
        }
    }

    // Sync mobile drawer
    updateMobileAuthUI(user);

    // Toggle a navbar-level class so CSS can show/hide the greeting reliably
    try {
        if (navbar) {
            if (user) navbar.classList.add('user-present');
            else navbar.classList.remove('user-present');
        }
    } catch (e) { /* ignore */ }
}

/* ── Email validation helper ── */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/* ── Mobile Navigation Toggle ── */
function toggleMobileNav() {
    const navbar = document.getElementById('main-navbar');
    if (navbar) navbar.classList.toggle('mobile-nav-open');
}

/* ── Update mobile drawer auth state ── */
function updateMobileAuthUI(user) {
    const mobileLoginBtn = document.getElementById('mobile-login-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const mobileGreeting = document.getElementById('mobile-greeting');
    const mobileAdminLink = document.getElementById('mobile-admin-link');

    if (user) {
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
        if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'block';
        if (mobileGreeting) {
            mobileGreeting.textContent = `Welcome, ${user.name}`;
            mobileGreeting.style.display = 'block';
        }
        if (mobileAdminLink) mobileAdminLink.style.display = user.is_admin ? 'block' : 'none';
    } else {
        if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
        if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
        if (mobileGreeting) mobileGreeting.style.display = 'none';
        if (mobileAdminLink) mobileAdminLink.style.display = 'none';
    }
}

/* ── Global exports ── */
window.checkAuthStatus = checkAuthStatus;
window.handleLogout = handleLogout;
window.toggleMobileNav = toggleMobileNav;

/* ═══════════════════════════════════════════════════════════
   Theme Management (shared across all pages)
   ═══════════════════════════════════════════════════════════ */

function initTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Initialize theme on load
initTheme();

window.toggleTheme = toggleTheme;
window.initTheme = initTheme;