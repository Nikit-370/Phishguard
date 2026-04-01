// Admin panel client logic

// Pagination state
let usersCurrentPage = 1;
let usersPerPage = 10;
let logsCurrentPage = 1;
let logsPerPage = 10;
let allUsers = [];
let allLogs = [];
// Heartbeat interval id
let statsHeartbeatId = null;

// Expose a function to clear heartbeat so other modules can stop polling (e.g., on logout)
function clearStatsHeartbeat() {
    if (statsHeartbeatId) {
        clearInterval(statsHeartbeatId);
        statsHeartbeatId = null;
    }
}
window.clearStatsHeartbeat = clearStatsHeartbeat;

document.addEventListener('DOMContentLoaded', () => {
    const creds = localStorage.getItem('system_auth');
    if (!creds) {
        showToast('Please login to access admin', 'warning');
        setTimeout(() => window.location.href = '/login', 900);
        return;
    }

    verifyAdmin(creds)
        .then(isAdmin => {
            if (!isAdmin) return;
            loadUsers(creds);
            loadLogs(creds);
            loadStats(creds);
            // Start a heartbeat to refresh stats every 30 seconds
            if (statsHeartbeatId) clearInterval(statsHeartbeatId);
            statsHeartbeatId = setInterval(() => {
                const c = localStorage.getItem('system_auth');
                if (c) loadStats(c);
            }, 30000);
        })
        .catch(err => {
            console.error('Admin init error:', err);
            showToast('Session expired, please login again', 'warning');
            setTimeout(() => window.location.href = '/login', 900);
        });
});

async function verifyAdmin(creds) {
    const res = await fetch('/api/auth/verify', { headers: { 'Authorization': 'Basic ' + creds } });
    if (!res.ok) {
        setTimeout(() => window.location.href = '/login', 900);
        return false;
    }
    const payload = await res.json();
    const user = payload.user || payload;
    if (!user.is_admin) {
        showToast('Admin access required', 'error');
        setTimeout(() => window.location.href = '/dashboard', 900);
        return false;
    }
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.style.display = 'block';
    return true;
}

async function loadUsers(creds) {
    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': 'Basic ' + creds }
        });
        if (!res.ok) throw new Error('Users API failed: ' + res.status);
        const users = await res.json();
        allUsers = users;
        usersCurrentPage = 1;
        displayUsersPage();
    } catch (err) {
        console.error('Load users error:', err);
        showToast('Failed to load users: ' + err.message, 'error');
        const tbody = document.getElementById('users-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#ff6b6b;">
                <i class="fas fa-exclamation-triangle" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>
                Failed to load users
            </td></tr>`;
        }
    }
}

function displayUsersPage() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    const totalPages = Math.ceil(allUsers.length / usersPerPage);
    const start = (usersCurrentPage - 1) * usersPerPage;
    const end = start + usersPerPage;
    const pageUsers = allUsers.slice(start, end);

    tbody.innerHTML = '';

    if (!pageUsers.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">No users found</td></tr>`;
    } else {
        pageUsers.forEach((u) => {
            const row = document.createElement('tr');
            const roleBadge = u.is_admin
                ? '<span class="badge-premium" style="font-size:0.72rem;">Admin</span>'
                : '<span class="badge-premium" style="font-size:0.72rem; background:var(--surface-3); color:var(--text-muted);">User</span>';
            row.innerHTML = `
                <td class="text-muted small">${u.id}</td>
                <td class="font-bold">${u.username}</td>
                <td class="text-muted">${u.email}</td>
                <td>${roleBadge}</td>
                <td class="text-muted small">${new Date(u.created_at).toLocaleDateString()}</td>
                <td class="text-end">
                    <button class="btn-icon-premium" onclick="editUser(${u.id})" title="Edit Member">
                        <i class="fas fa-user-edit"></i>
                    </button>
                    <button class="btn-icon-premium" onclick="viewHistory(${u.id})" title="View Scans">
                        <i class="fas fa-history"></i>
                    </button>
                </td>`;
            tbody.appendChild(row);
        });
    }

    // Update pagination info
    document.getElementById('users-page-info').textContent = `Page ${usersCurrentPage} of ${totalPages}`;
    document.getElementById('users-info').textContent = `Showing ${start + 1}-${Math.min(end, allUsers.length)} of ${allUsers.length}`;

    // Update button states (null-safe)
    const prevBtn = document.getElementById('users-prev-btn');
    const nextBtn = document.getElementById('users-next-btn');
    const firstBtn = document.getElementById('users-first-btn');
    const lastBtn = document.getElementById('users-last-btn');
    if (prevBtn) prevBtn.disabled = usersCurrentPage === 1;
    if (firstBtn) firstBtn.disabled = usersCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = usersCurrentPage >= totalPages;
    if (lastBtn) lastBtn.disabled = usersCurrentPage >= totalPages;
}

function firstUsersPage() {
    usersCurrentPage = 1;
    displayUsersPage();
}

function lastUsersPage() {
    const totalPages = Math.ceil(allUsers.length / usersPerPage);
    usersCurrentPage = totalPages;
    displayUsersPage();
}

function nextUsersPage() {
    const totalPages = Math.ceil(allUsers.length / usersPerPage);
    if (usersCurrentPage < totalPages) {
        usersCurrentPage++;
        displayUsersPage();
    }
}

function prevUsersPage() {
    if (usersCurrentPage > 1) {
        usersCurrentPage--;
        displayUsersPage();
    }
}

function goToUsersPage() {
    const totalPages = Math.ceil(allUsers.length / usersPerPage);
    const input = document.getElementById('users-goto-input');
    if (!input) return;
    const page = parseInt(input.value);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
        usersCurrentPage = page;
        input.value = '';
        displayUsersPage();
    } else {
        showToast(`Please enter a page between 1 and ${totalPages}`, 'warning');
    }
}

async function loadLogs(creds) {
    try {
        const res = await fetch('/api/admin/logs', { headers: { 'Authorization': 'Basic ' + creds } });
        if (!res.ok) throw new Error('logs failed');
        const logs = await res.json();

        // Store all logs for pagination
        allLogs = logs;
        logsCurrentPage = 1;

        // Display first page
        displayLogsPage();
    } catch (err) {
        console.error(err);
        showToast('Failed to load logs', 'error');
    }
}

async function loadStats(creds) {
    try {
        const res = await fetch('/api/stats', { headers: { 'Authorization': 'Basic ' + creds } });
        if (!res.ok) throw new Error('stats failed');
        const stats = await res.json();

        const totalUsersEl = document.getElementById('total-users');
        if (totalUsersEl) totalUsersEl.textContent = stats.total_users || allUsers.length || 0;

        const totalScansEl = document.getElementById('total-scans-admin');
        if (totalScansEl) totalScansEl.textContent = stats.total_scans || 0;

        const phishingEl = document.getElementById('phishing-detected-admin');
        if (phishingEl) phishingEl.textContent = stats.phishing_detected || 0;
        // Indicate system online in the UI
        const sysEl = document.getElementById('system-status');
        if (sysEl) {
            sysEl.classList.remove('system-offline');
            sysEl.classList.add('system-online');
            const dot = sysEl.querySelector('.status-indicator-pulse');
            if (dot) { dot.classList.remove('offline'); dot.classList.add('online'); }
            const label = sysEl.querySelector('span');
            if (label) label.textContent = 'System Online';
        }
    } catch (err) {
        const totalUsersEl = document.getElementById('total-users');
        if (totalUsersEl && allUsers.length) totalUsersEl.textContent = allUsers.length;
        // Mark system offline if stats failed
        const sysEl = document.getElementById('system-status');
        if (sysEl) {
            sysEl.classList.remove('system-online');
            sysEl.classList.add('system-offline');
            const dot = sysEl.querySelector('.status-indicator-pulse');
            if (dot) { dot.classList.remove('online'); dot.classList.add('offline'); }
            const label = sysEl.querySelector('span');
            if (label) label.textContent = 'System Offline';
        }
    }
}

function displayLogsPage() {
    const list = document.getElementById('logs-table-body');
    if (!list) return;
    list.innerHTML = '';

    const totalPages = Math.ceil(allLogs.length / logsPerPage); // Use logsPerPage
    const start = (logsCurrentPage - 1) * logsPerPage; // Use logsCurrentPage and logsPerPage
    const end = start + logsPerPage;
    const pageLogs = allLogs.slice(start, end); // Use logsPerPage

    if (allLogs.length === 0) {
        list.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">No security events recorded.</td></tr>';
        // Update pagination info for empty state
        document.getElementById('logs-page-info').textContent = 'Page 0 of 0';
        document.getElementById('logs-info').textContent = '0 results';
        // Disable all buttons
        const lPrev = document.getElementById('logs-prev-btn');
        const lNext = document.getElementById('logs-next-btn');
        const lFirst = document.getElementById('logs-first-btn');
        const lLast = document.getElementById('logs-last-btn');
        if (lPrev) lPrev.disabled = true;
        if (lFirst) lFirst.disabled = true;
        if (lNext) lNext.disabled = true;
        if (lLast) lLast.disabled = true;
        return;
    }

    pageLogs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-muted small">${new Date(log.timestamp).toLocaleString()}</td>
            <td><span class="badge-premium" style="font-size:0.75rem;">${log.action}</span></td>
            <td class="text-muted small">${log.details || ''}</td>
        `;
        list.appendChild(row);
    });
    // updateLogsPagination(); // This function is not defined, assuming it's meant to be the existing pagination update logic

    // Update pagination info
    document.getElementById('logs-page-info').textContent = `Page ${logsCurrentPage} of ${totalPages}`;
    document.getElementById('logs-info').textContent = `Showing ${start + 1}-${Math.min(end, allLogs.length)} of ${allLogs.length}`;

    // Update button states (null-safe)
    const lPrev = document.getElementById('logs-prev-btn');
    const lNext = document.getElementById('logs-next-btn');
    const lFirst = document.getElementById('logs-first-btn');
    const lLast = document.getElementById('logs-last-btn');
    if (lPrev) lPrev.disabled = logsCurrentPage === 1;
    if (lFirst) lFirst.disabled = logsCurrentPage === 1;
    if (lNext) lNext.disabled = logsCurrentPage >= totalPages;
    if (lLast) lLast.disabled = logsCurrentPage >= totalPages;
}

function firstLogsPage() {
    logsCurrentPage = 1;
    displayLogsPage();
}

function lastLogsPage() {
    const totalPages = Math.ceil(allLogs.length / logsPerPage);
    logsCurrentPage = totalPages;
    displayLogsPage();
}

function nextLogsPage() {
    const totalPages = Math.ceil(allLogs.length / logsPerPage);
    if (logsCurrentPage < totalPages) {
        logsCurrentPage++;
        displayLogsPage();
    }
}

function prevLogsPage() {
    if (logsCurrentPage > 1) {
        logsCurrentPage--;
        displayLogsPage();
    }
}

function goToLogsPage() {
    const totalPages = Math.ceil(allLogs.length / logsPerPage);
    const input = document.getElementById('logs-goto-input');
    if (!input) return;
    const page = parseInt(input.value);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
        logsCurrentPage = page;
        input.value = '';
        displayLogsPage();
    } else {
        showToast(`Please enter a page between 1 and ${totalPages}`, 'warning');
    }
}

async function editUser(userId) {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    try {
        const detailRes = await fetch(`/api/admin/users/${userId}`, { headers: { 'Authorization': 'Basic ' + creds } });
        if (!detailRes.ok) throw new Error('detail failed');
        const user = await detailRes.json();

        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editPassword').value = '';
        document.getElementById('editRole').value = user.is_admin ? 'admin' : 'user';

        openModal('editUserModal');
    } catch (err) {
        console.error(err);
        showToast('Load failure', 'error');
    }
}

async function submitEditUser() {
    const creds = localStorage.getItem('system_auth');
    const userId = document.getElementById('editUserId').value;
    const body = {
        username: document.getElementById('editUsername').value,
        email: document.getElementById('editEmail').value,
        is_admin: document.getElementById('editRole').value === 'admin'
    };
    const pwd = document.getElementById('editPassword').value;
    if (pwd) body.password = pwd;

    try {
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + creds
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Update failed');
        }
        showToast('Member profile synchronized', 'success');
        closeModal('editUserModal');
        loadUsers(creds);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function refreshUsers() {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    // Reset filter controls
    const searchInput = document.getElementById('user-search');
    const roleFilter = document.getElementById('role-filter');
    if (searchInput) searchInput.value = '';
    if (roleFilter) roleFilter.value = 'all';
    loadUsers(creds);
}

function searchUsers() {
    const query = (document.getElementById('user-search')?.value || '').toLowerCase().trim();
    const role = document.getElementById('role-filter')?.value || 'all';

    let filtered = allUsers;

    // Filter by role
    if (role === 'admin') {
        filtered = filtered.filter(u => u.is_admin);
    } else if (role === 'user') {
        filtered = filtered.filter(u => !u.is_admin);
    }

    // Filter by search text
    if (query) {
        filtered = filtered.filter(u =>
            String(u.id).includes(query) ||
            (u.username || '').toLowerCase().includes(query) ||
            (u.email || '').toLowerCase().includes(query)
        );
    }

    // Re-render with filtered list
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem;" class="text-muted">No matching users found</td></tr>';
        const pageInfo = document.getElementById('users-page-info');
        if (pageInfo) pageInfo.textContent = 'Page 0 of 0';
        const info = document.getElementById('users-info');
        if (info) info.textContent = '0 results';
        return;
    }

    filtered.forEach(u => {
        const row = document.createElement('tr');
        const roleBadge = u.is_admin
            ? '<span class="badge-premium" style="font-size:0.72rem;">Admin</span>'
            : '<span class="badge-premium" style="font-size:0.72rem; background:var(--surface-3); color:var(--text-muted);">User</span>';
        row.innerHTML = `
            <td class="text-muted small">${u.id}</td>
            <td class="font-bold">${u.username}</td>
            <td class="text-muted">${u.email}</td>
            <td>${roleBadge}</td>
            <td class="text-muted small">${new Date(u.created_at).toLocaleDateString()}</td>
            <td class="text-end">
                <button class="btn-icon-premium" onclick="editUser(${u.id})">
                    <i class="fas fa-user-edit"></i>
                </button>
            </td>`;
        tbody.appendChild(row);
    });

    const pageInfo = document.getElementById('users-page-info');
    if (pageInfo) pageInfo.textContent = `${filtered.length} results`;
    const info = document.getElementById('users-info');
    if (info) info.textContent = `Showing ${filtered.length} of ${allUsers.length}`;
}

function addNewUser() {
    openModal('addUserModal');
}

function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('d-none');
    m.style.display = 'flex';
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('d-none');
    m.style.display = 'none';
}

async function viewHistory(userId) {
    const creds = localStorage.getItem('system_auth');
    if (!creds) return;
    try {
        const res = await fetch(`/api/admin/users/${userId}/history?per_page=5`, { headers: { 'Authorization': 'Basic ' + creds } });
        if (!res.ok) throw new Error('history failed');
        const payload = await res.json();
        const items = payload.checks || [];
        if (!items.length) {
            if (typeof customAlert === 'function') {
                customAlert('No History', 'No history for this user yet.');
            } else {
                alert('No history for this user yet.');
            }
            return;
        }
        const lines = items.map(c => `${new Date(c.checked_at).toLocaleString()} - ${c.url} - ${c.prediction_label} (${c.confidence}%)`).join('\n');
        if (typeof customAlert === 'function') {
            customAlert('User History', lines);
        } else {
            alert(lines);
        }
    } catch (err) {
        console.error(err);
        showToast('History load failed', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return alert(message);
    const icon = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    }[type] || 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
