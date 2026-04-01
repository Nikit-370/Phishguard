// Dashboard client logic for authenticated users

const HISTORY_PAGE_SIZE = 5;
let historyPage = 1;
let historyPages = 1;
let historyTotal = 0;

document.addEventListener('DOMContentLoaded', () => {
    const creds = localStorage.getItem('system_auth');
    if (!creds) {
        showToast('Please login to access dashboard', 'warning');
        setTimeout(() => window.location.href = '/login', 900);
        return;
    }

    verifyUser(creds)
        .then(user => {
            if (!user) return;
            renderUser(user);
            loadStats(creds);
            loadHistory(creds);
        })
        .catch(() => {
            showToast('Session expired, please login again', 'warning');
            setTimeout(() => window.location.href = '/login', 900);
        });
});

async function verifyUser(creds) {
    const res = await fetch('/api/auth/verify', { headers: { 'Authorization': 'Basic ' + creds } });
    if (!res.ok) return null;
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
    const adminLink = document.getElementById('admin-link');
    const dashboardLink = document.getElementById('dashboard-link');
    if (adminLink) adminLink.style.display = userObj.is_admin ? 'block' : 'none';
    if (dashboardLink) dashboardLink.style.display = userObj.is_admin ? 'block' : 'none';
    return userObj;
}

function renderUser(user) {
    const greeting = document.getElementById('user-greeting');
    const avatar = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    if (greeting) greeting.textContent = `Welcome, ${user.name}`;
    if (avatar) avatar.textContent = (user.name || '?').charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
}

async function loadStats(creds) {
    try {
        const res = await fetch('/api/stats', { headers: { 'Authorization': 'Basic ' + creds } });
        if (!res.ok) throw new Error('stats failed');
        const stats = await res.json();
        setText('total-user-scans', stats.total_checks);
        setText('safe-count', stats.legitimate_found);
        setText('phishing-count', stats.phishing_found);
        setText('accuracy', `${stats.avg_confidence || 0}%`);
    } catch (err) {
        console.error(err);
        showToast('Could not load stats', 'error');
    }
}

async function loadHistory(creds, page = 1) {
    try {
        const res = await fetch(`/api/history?page=${page}&per_page=${HISTORY_PAGE_SIZE}`, { headers: { 'Authorization': 'Basic ' + creds } });
        if (!res.ok) throw new Error('history failed');
        const payload = await res.json();
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        historyPage = payload.current_page || page;
        historyPages = payload.pages || 1;
        historyTotal = payload.total || (payload.checks ? payload.checks.length : 0);
        updateHistoryPagination();

        if (!payload.checks || payload.checks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">No scan history yet.</td></tr>`;
            return;
        }
        payload.checks.forEach(check => {
            const row = document.createElement('tr');
            const date = new Date(check.checked_at).toLocaleDateString();
            const time = new Date(check.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const isPhish = check.prediction === 1;
            const statusClass = isPhish ? 'status-danger' : 'status-safe';
            const statusLabel = isPhish ? 'Phishing' : 'Legitimate';
            const typeLabel = isPhish ? 'Malicious' : 'Trusted';

            row.innerHTML = `
                <td class="text-muted small">${date} <span class="opacity-50">${time}</span></td>
                <td title="${check.url}" class="font-bold">${truncate(check.url, 45)}</td>
                <td><span class="badge-premium" style="background:${isPhish ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; color:${isPhish ? '#ef4444' : '#22c55e'}; border:1px solid ${isPhish ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'};">${statusLabel}</span></td>
                <td class="text-muted small">${typeLabel}</td>
                <td class="font-bold">${check.confidence.toFixed(1)}%</td>
                <td class="text-end">
                    <button class="btn-icon-premium" onclick="deleteHistoryItem(${check.id})" title="Purge Record">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error(err);
        showToast('Could not load history', 'error');
    }
}

function updateHistoryPagination() {
    const prevBtn = document.getElementById('history-prev');
    const nextBtn = document.getElementById('history-next');
    const pageLabel = document.getElementById('history-page-label');
    const countLabel = document.getElementById('history-count');

    if (prevBtn) prevBtn.disabled = historyPage <= 1;
    if (nextBtn) nextBtn.disabled = historyPage >= historyPages;
    if (pageLabel) pageLabel.textContent = `Page ${historyPage} of ${Math.max(historyPages, 1)}`;
    if (countLabel) countLabel.textContent = `${HISTORY_PAGE_SIZE} per page / ${historyTotal} total`;
}

function nextHistoryPage() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    if (historyPage >= historyPages) return;
    loadHistory(creds, historyPage + 1);
}

function prevHistoryPage() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    if (historyPage <= 1) return;
    loadHistory(creds, historyPage - 1);
}

function firstHistoryPage() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    loadHistory(creds, 1);
}

function lastHistoryPage() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    loadHistory(creds, historyPages);
}

function goToHistoryPage() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    const input = document.getElementById('history-goto-input');
    if (!input) return;
    const page = parseInt(input.value);
    if (!isNaN(page) && page >= 1 && page <= historyPages) {
        input.value = '';
        loadHistory(creds, page);
    } else {
        alert(`Please enter a page between 1 and ${historyPages}`);
    }
}

async function deleteHistoryItem(checkId) {
    const confirmDelete = async () => {
        const creds = localStorage.getItem('system_auth');
        if (!creds) return;

        try {
            const res = await fetch(`/api/history/${checkId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Basic ' + creds }
            });

            if (!res.ok) throw new Error('Delete failed');

            showToast('History item deleted', 'success');
            loadHistory(creds, historyPage);
            loadStats(creds);
        } catch (err) {
            console.error(err);
            showToast('Failed to delete history item', 'error');
        }
    };

    if (typeof customConfirm === 'function') {
        customConfirm('Delete History Item', 'Are you sure you want to delete this history item?', confirmDelete);
    } else if (confirm('Delete this history item?')) {
        confirmDelete();
    }
}

async function clearAllHistory() {
    const confirmClear = async () => {
        const creds = localStorage.getItem('system_auth');
        if (!creds) return;

        try {
            const res = await fetch('/api/history/clear', {
                method: 'DELETE',
                headers: { 'Authorization': 'Basic ' + creds }
            });

            if (!res.ok) throw new Error('Clear failed');

            showToast('All history cleared', 'success');
            loadHistory(creds, 1);
            loadStats(creds);
        } catch (err) {
            console.error(err);
            showToast('Failed to clear history', 'error');
        }
    };

    if (typeof customConfirm === 'function') {
        customConfirm('Clear All History', 'Are you sure you want to clear all history? This action cannot be undone.', confirmClear);
    } else if (confirm('Clear all history? This action cannot be undone.')) {
        confirmClear();
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max - 3) + '...' : str;
}

// Profile Management
function openProfileModal() {
    const user = JSON.parse(localStorage.getItem('system_user') || '{}');
    document.getElementById('profileUsername').value = user.name || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profilePassword').value = '';

    const m = document.getElementById('profileModal');
    if (m) {
        m.classList.remove('d-none');
        m.style.display = 'flex';
    }
}

function closeProfileModal() {
    const m = document.getElementById('profileModal');
    if (m) {
        m.classList.add('d-none');
        m.style.display = 'none';
    }
}

async function updateProfile() {
    const creds = localStorage.getItem('system_auth');
    const username = document.getElementById('profileUsername').value;
    const email = document.getElementById('profileEmail').value;
    const password = document.getElementById('profilePassword').value;

    const body = { username, email };
    if (password) body.password = password;

    try {
        const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + creds
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Profile synchronization failed');

        showToast('Identity records updated', 'success');

        // Update credentials if password changed
        if (password) {
            const newCreds = btoa(`${username}:${password}`);
            localStorage.setItem('system_auth', newCreds);
        } else if (username !== JSON.parse(localStorage.getItem('system_user')).name) {
            // If username changed, we might need new creds (Basic Auth works on username:password)
            // But we don't have the password. This is a limitation of Basic Auth profile updates.
            // Usually, a profile update that changes username in Basic Auth would require re-login or knowing the password.
            // For now, let's assume the user knows their password if they change username.
            showToast('Please re-login if username was changed', 'warning');
        }

        closeProfileModal();
        location.reload(); // Refresh to update all UI components
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Simple toast fallback if not already defined
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return alert(message);
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
