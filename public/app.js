// ========================================
// RentFlow — Main Application
// ========================================

// Detect if running in Capacitor (native app) or browser
const IS_NATIVE = window.Capacitor !== undefined ||
  (window.location.protocol === 'https:' && window.location.hostname === 'localhost' && window.location.port === '') ||
  window.location.protocol === 'capacitor:';

// When running as a native app, point to the cloud server
const SERVER_URL = IS_NATIVE ? 'https://rentflow-app.onrender.com' : '';
const API = `${SERVER_URL}/api`;
let token = localStorage.getItem('rf_token');
let currentUser = null;
let currentPage = '';
let chartInstances = {};

// ========================================
// API Client
// ========================================
async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ========================================
// Toast Notifications
// ========================================
function toast(message, type = 'info') {
  const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="material-symbols-rounded">${icons[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ========================================
// Modal
// ========================================
function openModal(title, bodyHTML, footerHTML = '') {
  document.getElementById('modal-header').innerHTML = `<h2>${title}</h2>
    <button class="modal-close" onclick="closeModal()"><span class="material-symbols-rounded">close</span></button>`;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ========================================
// Auth
// ========================================
function setupAuth() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
      document.getElementById('register-form').classList.toggle('hidden', tab.dataset.tab !== 'register');
      document.getElementById('auth-error').classList.add('hidden');
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value
        })
      });
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('rf_token', token);
      showApp();
    } catch (err) {
      showAuthError(err.message);
    }
    btn.disabled = false;
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('reg-name').value,
          email: document.getElementById('reg-email').value,
          password: document.getElementById('reg-password').value,
          phone: document.getElementById('reg-phone').value,
          role: document.querySelector('input[name="role"]:checked').value
        })
      });
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('rf_token', token);
      showApp();
    } catch (err) {
      showAuthError(err.message);
    }
    btn.disabled = false;
  });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('rf_token');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('login-form').reset();
}

// ========================================
// App Shell Setup
// ========================================
async function showApp() {
  try {
    if (!currentUser) currentUser = await api('/auth/me');
  } catch {
    logout();
    return;
  }

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  setupSidebar();
  navigate('dashboard');
}

function setupSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const isLandlord = currentUser.role === 'landlord';

  const items = isLandlord ? [
    {
      section: 'Main', items: [
        { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
        { id: 'properties', icon: 'domain', label: 'Properties' },
        { id: 'tenants', icon: 'group', label: 'Tenants' },
      ]
    },
    {
      section: 'Finance', items: [
        { id: 'transactions', icon: 'receipt_long', label: 'Transactions' },
        { id: 'reports', icon: 'bar_chart', label: 'Reports' },
      ]
    }
  ] : [
    {
      section: 'Main', items: [
        { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
        { id: 'transactions', icon: 'receipt_long', label: 'My Payments' },
        { id: 'reports', icon: 'bar_chart', label: 'Reports' },
      ]
    }
  ];

  nav.innerHTML = items.map(section => `
    <div class="nav-section">
      <div class="nav-section-title">${section.section}</div>
      ${section.items.map(item => `
        <button class="nav-item" data-page="${item.id}" onclick="navigate('${item.id}')">
          <span class="material-symbols-rounded">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `).join('')}
    </div>
  `).join('');

  const user = document.getElementById('sidebar-user');
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  user.innerHTML = `
    <div class="user-avatar" style="background:${currentUser.avatar_color}">${initials}</div>
    <div class="user-info"><div class="user-name">${currentUser.name}</div><div class="user-role">${currentUser.role}</div></div>
    <button class="logout-btn" onclick="logout()" title="Logout"><span class="material-symbols-rounded">logout</span></button>`;

  document.getElementById('mobile-menu-btn').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
  };
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('sidebar').classList.remove('open');
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const titles = { dashboard: 'Dashboard', properties: 'Properties', tenants: 'Tenants', transactions: 'Transactions', reports: 'Reports & Analytics' };
  document.getElementById('page-title').textContent = titles[page] || page;

  const area = document.getElementById('content-area');
  area.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const actions = document.getElementById('top-bar-actions');
  actions.innerHTML = '';

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'properties': renderProperties(); break;
    case 'tenants': renderTenants(); break;
    case 'transactions': renderTransactions(); break;
    case 'reports': renderReports(); break;
  }
}

// ========================================
// Helpers
// ========================================
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr) {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function statusBadge(status) {
  const icons = { paid: '✅', pending: '⚠️', overdue: '❌' };
  return `<span class="status-badge ${status}"><span class="status-dot ${status}"></span>${status.charAt(0).toUpperCase() + status.slice(1)}</span>`;
}

// ========================================
// Dashboard
// ========================================
async function renderDashboard() {
  const area = document.getElementById('content-area');
  try {
    const endpoint = currentUser.role === 'landlord' ? '/dashboard/landlord' : '/dashboard/tenant';
    const data = await api(endpoint);

    if (currentUser.role === 'landlord') {
      area.innerHTML = `<div class="page-enter">
        <div class="stats-grid">
          <div class="stat-card accent"><div class="stat-icon"><span class="material-symbols-rounded">domain</span></div>
            <div class="stat-value">${data.stats.propertyCount}</div><div class="stat-label">Properties</div></div>
          <div class="stat-card green"><div class="stat-icon"><span class="material-symbols-rounded">group</span></div>
            <div class="stat-value">${data.stats.tenantCount}</div><div class="stat-label">Active Tenants</div></div>
          <div class="stat-card amber"><div class="stat-icon"><span class="material-symbols-rounded">account_balance_wallet</span></div>
            <div class="stat-value">${formatCurrency(data.stats.monthlyIncome)}</div><div class="stat-label">This Month</div></div>
          <div class="stat-card red"><div class="stat-icon"><span class="material-symbols-rounded">warning</span></div>
            <div class="stat-value">${data.stats.overdueCount}</div><div class="stat-label">Overdue</div></div>
        </div>
        <div class="content-grid">
          <div class="card"><div class="card-header"><span class="card-title">Upcoming Dues</span></div>
            <div id="upcoming-dues">${renderDuesList(data.upcomingDues)}</div></div>
          <div class="card"><div class="card-header"><span class="card-title">Recent Activity</span></div>
            <div class="activity-list">${renderActivityList(data.recentActivity)}</div></div>
        </div>
        <div class="card"><div class="card-header"><span class="card-title">Recent Transactions</span></div>
          ${renderTransactionsTable(data.recentTransactions)}</div>
      </div>`;
    } else {
      // Build pending rent alert banner
      let pendingBanner = '';
      const pendingAmt = parseFloat(data.stats.pendingAmount) || 0;
      if (pendingAmt > 0 || (data.upcomingDues && data.upcomingDues.length > 0)) {
        const overdueItems = (data.upcomingDues || []).filter(d => d.status === 'overdue');
        const pendingItems = (data.upcomingDues || []).filter(d => d.status === 'pending');
        pendingBanner = `
          <div style="background:linear-gradient(135deg,#dc262620,#f5920020);border:1px solid #dc262640;border-radius:16px;padding:20px 24px;margin-bottom:20px;animation:slideDown 0.4s ease">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
              <span class="material-symbols-rounded" style="font-size:32px;color:#ef4444">notification_important</span>
              <div>
                <div style="font-size:1.1rem;font-weight:700;color:#ef4444">⚠️ Rent Payment Pending</div>
                <div style="font-size:0.9rem;color:var(--text-secondary)">You have <strong>${formatCurrency(pendingAmt)}</strong> in pending payments</div>
              </div>
            </div>
            ${overdueItems.length > 0 ? `<div style="margin-top:8px;padding:12px;background:rgba(239,68,68,0.1);border-radius:10px">
              <div style="font-weight:600;color:#ef4444;margin-bottom:6px">🔴 Overdue (${overdueItems.length})</div>
              ${overdueItems.map(d => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.88rem">
                <span>${d.property_name} — ${formatCurrency(d.amount)}</span><span style="color:#ef4444">Due: ${formatDate(d.due_date)}</span></div>`).join('')}
            </div>` : ''}
            ${pendingItems.length > 0 ? `<div style="margin-top:8px;padding:12px;background:rgba(245,158,11,0.1);border-radius:10px">
              <div style="font-weight:600;color:#f59e0b;margin-bottom:6px">🟡 Upcoming (${pendingItems.length})</div>
              ${pendingItems.map(d => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.88rem">
                <span>${d.property_name} — ${formatCurrency(d.amount)}</span><span style="color:#f59e0b">Due: ${formatDate(d.due_date)}</span></div>`).join('')}
            </div>` : ''}
          </div>`;
      }

      area.innerHTML = `<div class="page-enter">
        ${pendingBanner}
        <div class="stats-grid">
          <div class="stat-card green"><div class="stat-icon"><span class="material-symbols-rounded">payments</span></div>
            <div class="stat-value">${formatCurrency(data.stats.totalPaid)}</div><div class="stat-label">Total Paid</div></div>
          <div class="stat-card red"><div class="stat-icon"><span class="material-symbols-rounded">pending_actions</span></div>
            <div class="stat-value">${formatCurrency(data.stats.pendingAmount)}</div><div class="stat-label">Pending</div></div>
          <div class="stat-card accent"><div class="stat-icon"><span class="material-symbols-rounded">home</span></div>
            <div class="stat-value">${data.stats.activeLeaseCount}</div><div class="stat-label">Active Leases</div></div>
        </div>
        <div class="content-grid">
          <div class="card"><div class="card-header"><span class="card-title">Upcoming Dues</span></div>
            ${renderDuesList(data.upcomingDues)}</div>
          <div class="card"><div class="card-header"><span class="card-title">Recent Payments</span></div>
            ${renderTransactionsTable(data.recentPayments)}</div>
        </div>
      </div>`;
    }
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error loading dashboard</h3><p>${err.message}</p></div>`;
  }
}

function renderDuesList(dues) {
  if (!dues || dues.length === 0) return '<div class="empty-state"><span class="material-symbols-rounded">event_available</span><h3>All caught up!</h3><p>No upcoming dues.</p></div>';
  return dues.map(d => `<div class="activity-item">
    <div class="activity-icon" style="background:${d.status === 'overdue' ? 'var(--red-bg)' : 'var(--yellow-bg)'}">
      <span class="material-symbols-rounded" style="color:${d.status === 'overdue' ? 'var(--red-text)' : 'var(--yellow-text)'}">${d.status === 'overdue' ? 'error' : 'schedule'}</span></div>
    <div class="activity-content"><div class="activity-text">${d.property_name || 'Property'} — ${formatCurrency(d.amount)}</div>
      <div class="activity-time">Due: ${formatDate(d.due_date)}</div></div>
    ${statusBadge(d.status)}
  </div>`).join('');
}

function renderActivityList(activities) {
  if (!activities || activities.length === 0) return '<p style="color:var(--text-muted);padding:12px;font-size:0.88rem">No recent activity.</p>';
  return activities.map(a => `<div class="activity-item">
    <div class="activity-icon" style="background:var(--blue-bg)"><span class="material-symbols-rounded" style="color:var(--accent-light)">history</span></div>
    <div class="activity-content"><div class="activity-text">${a.details || a.action}</div><div class="activity-time">${timeAgo(a.created_at)}</div></div>
  </div>`).join('');
}

function renderTransactionsTable(txns) {
  if (!txns || txns.length === 0) return '<p style="color:var(--text-muted);padding:12px;font-size:0.88rem">No transactions yet.</p>';
  return `<div class="data-table-wrapper"><table class="data-table"><thead><tr>
    <th>Property</th><th>Tenant</th><th>Amount</th><th>Due Date</th><th>Mode</th><th>Status</th></tr></thead><tbody>
    ${txns.map(t => `<tr><td>${t.property_name || '—'}</td><td>${t.tenant_name || '—'}</td>
      <td style="font-weight:600">${formatCurrency(t.amount)}</td><td>${formatDate(t.due_date)}</td>
      <td><span style="text-transform:uppercase;font-size:0.78rem">${t.mode}</span></td><td>${statusBadge(t.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

// ========================================
// Properties Page
// ========================================
async function renderProperties() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  if (currentUser.role === 'landlord') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showAddPropertyModal()">
      <span class="material-symbols-rounded">add</span>Add Property</button>`;
  }
  try {
    const properties = await api('/properties');
    if (properties.length === 0) {
      area.innerHTML = `<div class="page-enter empty-state"><span class="material-symbols-rounded">domain_add</span>
        <h3>No properties yet</h3><p>Add your first property to start tracking rent.</p>
        ${currentUser.role === 'landlord' ? '<button class="btn btn-primary" onclick="showAddPropertyModal()"><span class="material-symbols-rounded">add</span>Add Property</button>' : ''}
      </div>`;
      return;
    }
    area.innerHTML = `<div class="page-enter property-grid">${properties.map(p => `
      <div class="property-card" onclick="navigate('tenants')">
        <div class="property-card-header">
          <div class="property-icon"><span class="material-symbols-rounded">${p.property_type === 'house' ? 'home' : p.property_type === 'commercial' ? 'store' : 'apartment'}</span></div>
          ${currentUser.role === 'landlord' ? `<div class="property-actions">
            <button class="property-action-btn" onclick="event.stopPropagation();showEditPropertyModal('${p.id}','${esc(p.name)}','${esc(p.address || '')}',${p.rent_amount},${p.due_day},'${p.property_type}')"><span class="material-symbols-rounded">edit</span></button>
            <button class="property-action-btn" onclick="event.stopPropagation();deleteProperty('${p.id}')"><span class="material-symbols-rounded">delete</span></button>
          </div>` : ''}
        </div>
        <div class="property-name">${p.name}</div>
        <div class="property-address"><span class="material-symbols-rounded" style="font-size:16px">location_on</span>${p.address || 'No address'}</div>
        <div class="property-stats">
          <div class="property-stat"><div class="property-stat-value">${formatCurrency(p.rent_amount)}</div><div class="property-stat-label">Rent/Month</div></div>
          <div class="property-stat"><div class="property-stat-value">${p.tenant_count || 0}</div><div class="property-stat-label">Tenants</div></div>
          <div class="property-stat"><div class="property-stat-value">${p.due_day}</div><div class="property-stat-label">Due Day</div></div>
        </div>
      </div>`).join('')}</div>`;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function esc(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

function propertyFormHTML(name = '', address = '', rent = '', due = 1, type = 'apartment') {
  return `<div class="auth-form">
    <div class="form-group"><span class="material-symbols-rounded input-icon">domain</span>
      <input type="text" id="prop-name" placeholder="Property name" value="${name}" required></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">location_on</span>
      <input type="text" id="prop-address" placeholder="Address" value="${address}"></div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Rent Amount (₹)</label>
        <input type="number" id="prop-rent" placeholder="15000" value="${rent}" required></div>
      <div class="form-group no-icon"><label class="form-label">Due Day</label>
        <input type="number" id="prop-due" min="1" max="28" value="${due}" placeholder="1"></div>
    </div>
    <div class="form-group no-icon"><label class="form-label">Type</label>
      <select id="prop-type"><option value="apartment" ${type === 'apartment' ? 'selected' : ''}>Apartment</option><option value="house" ${type === 'house' ? 'selected' : ''}>House</option><option value="commercial" ${type === 'commercial' ? 'selected' : ''}>Commercial</option><option value="parking" ${type === 'parking' ? 'selected' : ''}>Parking</option></select></div>
  </div>`;
}

function showAddPropertyModal() {
  openModal('Add Property', propertyFormHTML(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitProperty()">Add Property</button>`);
}

function showEditPropertyModal(id, name, address, rent, due, type) {
  openModal('Edit Property', propertyFormHTML(name, address, rent, due, type),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitProperty('${id}')">Save Changes</button>`);
}

async function submitProperty(id) {
  try {
    const body = {
      name: document.getElementById('prop-name').value,
      address: document.getElementById('prop-address').value,
      rent_amount: parseFloat(document.getElementById('prop-rent').value),
      due_day: parseInt(document.getElementById('prop-due').value) || 1,
      property_type: document.getElementById('prop-type').value
    };
    if (id) { await api(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(body) }); toast('Property updated', 'success'); }
    else { await api('/properties', { method: 'POST', body: JSON.stringify(body) }); toast('Property added!', 'success'); }
    closeModal();
    renderProperties();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteProperty(id) {
  if (!confirm('Delete this property? This cannot be undone.')) return;
  try { await api(`/properties/${id}`, { method: 'DELETE' }); toast('Property deleted', 'success'); renderProperties(); }
  catch (err) { toast(err.message, 'error'); }
}

// ========================================
// Tenants Page
// ========================================
async function renderTenants() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  if (currentUser.role === 'landlord') {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showAddTenantModal()">
      <span class="material-symbols-rounded">person_add</span>Add Tenant</button>`;
  }
  try {
    const tenants = await api('/tenants');
    if (tenants.length === 0) {
      area.innerHTML = `<div class="page-enter empty-state"><span class="material-symbols-rounded">person_add</span>
        <h3>No tenants yet</h3><p>Add tenants to your properties.</p></div>`;
      return;
    }
    area.innerHTML = `<div class="page-enter card"><div class="data-table-wrapper"><table class="data-table"><thead><tr>
      <th>Name</th><th>Property</th><th>Email</th><th>Phone</th><th>Lease Start</th><th>Lease End</th>${currentUser.role === 'landlord' ? '<th>Actions</th>' : ''}</tr></thead><tbody>
      ${tenants.map(t => `<tr><td style="font-weight:600">${t.name}</td><td>${t.property_name || '—'}</td><td>${t.email || '—'}</td>
        <td>${t.phone || '—'}</td><td>${formatDate(t.lease_start)}</td><td>${formatDate(t.lease_end)}</td>
        ${currentUser.role === 'landlord' ? `<td><div style="display:flex;gap:4px">
          <button class="property-action-btn" onclick="showEditTenantModal('${t.id}','${esc(t.name)}','${esc(t.email || '')}','${esc(t.phone || '')}','${t.lease_start || ''}','${t.lease_end || ''}')"><span class="material-symbols-rounded">edit</span></button>
          <button class="property-action-btn" onclick="deleteTenant('${t.id}')"><span class="material-symbols-rounded">delete</span></button>
        </div></td>` : ''}</tr>`).join('')}
    </tbody></table></div></div>`;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

async function showAddTenantModal() {
  let propsHtml = '';
  try {
    const props = await api('/properties');
    propsHtml = props.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch { }
  openModal('Add Tenant', `<div class="auth-form">
    <div class="form-group no-icon"><label class="form-label">Property</label><select id="ten-prop">${propsHtml}</select></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">person</span><input type="text" id="ten-name" placeholder="Tenant name" required></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">email</span><input type="email" id="ten-email" placeholder="Email"></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">phone</span><input type="tel" id="ten-phone" placeholder="Phone"></div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Lease Start</label><input type="date" id="ten-start"></div>
      <div class="form-group no-icon"><label class="form-label">Lease End</label><input type="date" id="ten-end"></div>
    </div></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitTenant()">Add Tenant</button>`);
}

function showEditTenantModal(id, name, email, phone, start, end) {
  openModal('Edit Tenant', `<div class="auth-form">
    <div class="form-group"><span class="material-symbols-rounded input-icon">person</span><input type="text" id="ten-name" value="${name}" required></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">email</span><input type="email" id="ten-email" value="${email}"></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">phone</span><input type="tel" id="ten-phone" value="${phone}"></div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Lease Start</label><input type="date" id="ten-start" value="${start}"></div>
      <div class="form-group no-icon"><label class="form-label">Lease End</label><input type="date" id="ten-end" value="${end}"></div>
    </div></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitTenant('${id}')">Save</button>`);
}

async function submitTenant(id) {
  try {
    const body = {
      name: document.getElementById('ten-name').value, email: document.getElementById('ten-email').value,
      phone: document.getElementById('ten-phone').value, lease_start: document.getElementById('ten-start').value, lease_end: document.getElementById('ten-end').value
    };
    if (id) { await api(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(body) }); toast('Tenant updated', 'success'); }
    else { body.property_id = document.getElementById('ten-prop').value; await api('/tenants', { method: 'POST', body: JSON.stringify(body) }); toast('Tenant added!', 'success'); }
    closeModal(); renderTenants();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTenant(id) {
  if (!confirm('Remove this tenant?')) return;
  try { await api(`/tenants/${id}`, { method: 'DELETE' }); toast('Tenant removed', 'success'); renderTenants(); }
  catch (err) { toast(err.message, 'error'); }
}

// ========================================
// Transactions Page
// ========================================
async function renderTransactions() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showAddTransactionModal()">
    <span class="material-symbols-rounded">add</span>Add Transaction</button>`;
  try {
    const props = await api('/properties');
    const result = await api('/transactions');
    const txns = result.transactions || [];
    area.innerHTML = `<div class="page-enter">
      <div class="filters-bar">
        <select class="filter-select" id="tx-filter-prop" onchange="applyTxFilters()">
          <option value="">All Properties</option>
          ${props.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <select class="filter-select" id="tx-filter-status" onchange="applyTxFilters()">
          <option value="">All Status</option>
          <option value="paid">Paid</option><option value="pending">Pending</option><option value="overdue">Overdue</option>
        </select>
        <input type="date" class="filter-input" id="tx-filter-from" onchange="applyTxFilters()" placeholder="From">
        <input type="date" class="filter-input" id="tx-filter-to" onchange="applyTxFilters()" placeholder="To">
      </div>
      <div class="card" id="tx-table-card">${renderFullTxTable(txns)}</div>
    </div>`;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderFullTxTable(txns) {
  if (!txns || txns.length === 0) return '<div class="empty-state"><span class="material-symbols-rounded">receipt_long</span><h3>No transactions</h3><p>Record your first transaction.</p></div>';
  return `<div class="data-table-wrapper"><table class="data-table"><thead><tr>
    <th>Property</th><th>Tenant</th><th>Amount</th><th>Due Date</th><th>Paid On</th><th>Mode</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${txns.map(t => `<tr>
      <td>${t.property_name || '—'}</td><td>${t.tenant_name || '—'}</td>
      <td style="font-weight:700">${formatCurrency(t.amount)}</td>
      <td>${formatDate(t.due_date)}</td><td>${formatDate(t.date_paid)}</td>
      <td><span style="text-transform:uppercase;font-size:0.78rem">${t.mode}</span></td>
      <td>${statusBadge(t.status)}</td>
      <td><div style="display:flex;gap:4px">
        <button class="property-action-btn" title="Edit" onclick='showEditTxModal(${JSON.stringify(t).replace(/'/g, "&#39;")})'><span class="material-symbols-rounded">edit</span></button>
        ${t.status !== 'paid' ? `<button class="property-action-btn" title="Mark Paid" onclick="markTxPaid('${t.id}')"><span class="material-symbols-rounded">check_circle</span></button>` : ''}
        ${t.status !== 'paid' && t.tenant_phone ? `<button class="property-action-btn" title="WhatsApp Reminder" onclick="sendWhatsAppReminder('${t.tenant_phone}','${esc(t.tenant_name || '')}','${formatCurrency(t.amount)}','${esc(t.property_name || '')}','${t.due_date || ''}')" style="color:#25d366"><span class="material-symbols-rounded">chat</span></button>` : ''}
        ${t.receipt_path ? `<a class="property-action-btn" href="${t.receipt_path}" target="_blank" title="View Receipt"><span class="material-symbols-rounded">attachment</span></a>` : ''}
        <button class="property-action-btn" onclick="deleteTx('${t.id}')"><span class="material-symbols-rounded">delete</span></button>
      </div></td></tr>`).join('')}
  </tbody></table></div>`;
}

async function applyTxFilters() {
  const params = new URLSearchParams();
  const prop = document.getElementById('tx-filter-prop').value;
  const status = document.getElementById('tx-filter-status').value;
  const from = document.getElementById('tx-filter-from').value;
  const to = document.getElementById('tx-filter-to').value;
  if (prop) params.set('property_id', prop);
  if (status) params.set('status', status);
  if (from) params.set('from_date', from);
  if (to) params.set('to_date', to);
  try {
    const result = await api(`/transactions?${params}`);
    document.getElementById('tx-table-card').innerHTML = renderFullTxTable(result.transactions || []);
  } catch (err) { toast(err.message, 'error'); }
}

async function showAddTransactionModal() {
  let propsHtml = '', tenantsHtml = '';
  try {
    const props = await api('/properties');
    propsHtml = props.map(p => `<option value="${p.id}" data-rent="${p.rent_amount}">${p.name}</option>`).join('');
    const tenants = await api('/tenants');
    tenantsHtml = tenants.map(t => `<option value="${t.id}">${t.name} (${t.property_name})</option>`).join('');
  } catch { }
  const today = new Date().toISOString().split('T')[0];
  openModal('Add Transaction', `<div class="auth-form">
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Property</label><select id="tx-prop" onchange="autoFillRent()">${propsHtml}</select></div>
      <div class="form-group no-icon"><label class="form-label">Tenant</label><select id="tx-tenant"><option value="">— Select —</option>${tenantsHtml}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Amount (₹)</label><input type="number" id="tx-amount" placeholder="15000"></div>
      <div class="form-group no-icon"><label class="form-label">Due Date</label><input type="date" id="tx-due" value="${today}"></div>
    </div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Mode</label>
        <select id="tx-mode"><option value="cash">Cash</option><option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option></select></div>
      <div class="form-group no-icon"><label class="form-label">Status</label>
        <select id="tx-status"><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div>
    </div>
    <div class="form-group no-icon"><label class="form-label">Date Paid</label><input type="date" id="tx-paid"></div>
    <div class="form-group no-icon"><label class="form-label">Notes</label><textarea id="tx-notes" style="padding:12px;min-height:60px" placeholder="Optional notes..."></textarea></div>
    <div class="form-group no-icon"><label class="form-label">Receipt</label>
      <div class="upload-area" onclick="document.getElementById('tx-receipt').click()">
        <span class="material-symbols-rounded">cloud_upload</span><p>Click to upload receipt</p>
        <div class="file-name" id="receipt-filename"></div>
      </div>
      <input type="file" id="tx-receipt" accept=".jpg,.jpeg,.png,.pdf,.webp" style="display:none" onchange="document.getElementById('receipt-filename').textContent=this.files[0]?.name||''">
    </div>
  </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="submitTransaction()">Save Transaction</button>`);
  autoFillRent();
}

function autoFillRent() {
  const sel = document.getElementById('tx-prop');
  if (sel && sel.selectedOptions[0]) {
    const rent = sel.selectedOptions[0].dataset.rent;
    if (rent) document.getElementById('tx-amount').value = rent;
  }
}

async function submitTransaction() {
  try {
    const formData = new FormData();
    formData.append('property_id', document.getElementById('tx-prop').value);
    const tenantVal = document.getElementById('tx-tenant').value;
    if (tenantVal) formData.append('tenant_id', tenantVal);
    formData.append('amount', document.getElementById('tx-amount').value);
    formData.append('due_date', document.getElementById('tx-due').value);
    formData.append('mode', document.getElementById('tx-mode').value);
    formData.append('status', document.getElementById('tx-status').value);
    const paid = document.getElementById('tx-paid').value;
    if (paid) formData.append('date_paid', paid);
    const notes = document.getElementById('tx-notes').value;
    if (notes) formData.append('notes', notes);
    const receipt = document.getElementById('tx-receipt').files[0];
    if (receipt) formData.append('receipt', receipt);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}/transactions`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast('Transaction recorded!', 'success');
    closeModal();
    renderTransactions();
  } catch (err) { toast(err.message, 'error'); }
}

async function markTxPaid(id) {
  try {
    await api(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'paid', date_paid: new Date().toISOString().split('T')[0] }) });
    toast('Marked as paid', 'success');
    renderTransactions();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTx(id) {
  if (!confirm('Delete this transaction?')) return;
  try { await api(`/transactions/${id}`, { method: 'DELETE' }); toast('Transaction deleted', 'success'); renderTransactions(); }
  catch (err) { toast(err.message, 'error'); }
}

// ========================================
// Edit Transaction
// ========================================
function showEditTxModal(tx) {
  openModal('Edit Transaction', `<div class="auth-form">
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Amount (₹)</label><input type="number" id="edit-tx-amount" value="${tx.amount}"></div>
      <div class="form-group no-icon"><label class="form-label">Due Date</label><input type="date" id="edit-tx-due" value="${tx.due_date || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Mode</label>
        <select id="edit-tx-mode">
          <option value="cash" ${tx.mode === 'cash' ? 'selected' : ''}>Cash</option>
          <option value="bank_transfer" ${tx.mode === 'bank_transfer' ? 'selected' : ''}>Bank Transfer</option>
          <option value="upi" ${tx.mode === 'upi' ? 'selected' : ''}>UPI</option>
          <option value="cheque" ${tx.mode === 'cheque' ? 'selected' : ''}>Cheque</option>
          <option value="other" ${tx.mode === 'other' ? 'selected' : ''}>Other</option>
        </select></div>
      <div class="form-group no-icon"><label class="form-label">Status</label>
        <select id="edit-tx-status">
          <option value="pending" ${tx.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="paid" ${tx.status === 'paid' ? 'selected' : ''}>Paid</option>
          <option value="overdue" ${tx.status === 'overdue' ? 'selected' : ''}>Overdue</option>
        </select></div>
    </div>
    <div class="form-group no-icon"><label class="form-label">Date Paid</label><input type="date" id="edit-tx-paid" value="${tx.date_paid || ''}"></div>
    <div class="form-group no-icon"><label class="form-label">Notes</label><textarea id="edit-tx-notes" style="padding:12px;min-height:60px">${tx.notes || ''}</textarea></div>
  </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitEditTx('${tx.id}')">Save Changes</button>`);
}

async function submitEditTx(id) {
  try {
    const body = {
      amount: document.getElementById('edit-tx-amount').value,
      due_date: document.getElementById('edit-tx-due').value,
      mode: document.getElementById('edit-tx-mode').value,
      status: document.getElementById('edit-tx-status').value,
      date_paid: document.getElementById('edit-tx-paid').value || null,
      notes: document.getElementById('edit-tx-notes').value
    };
    await api(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    toast('Transaction updated!', 'success');
    closeModal();
    renderTransactions();
  } catch (err) { toast(err.message, 'error'); }
}

// ========================================
// WhatsApp Reminder
// ========================================
function sendWhatsAppReminder(phone, tenantName, amount, propertyName, dueDate) {
  // Clean phone number - remove spaces, dashes, and leading zeros
  let cleanPhone = phone.replace(/[\s\-()]/g, '');
  // Add India country code if not present
  if (!cleanPhone.startsWith('+') && !cleanPhone.startsWith('91')) {
    cleanPhone = '91' + cleanPhone;
  } else if (cleanPhone.startsWith('+')) {
    cleanPhone = cleanPhone.substring(1);
  }

  const message = `Hi ${tenantName},\n\nThis is a friendly reminder that your rent payment of *${amount}* for *${propertyName}* was due on *${dueDate}*.\n\nPlease make the payment at your earliest convenience.\n\nThank you! 🏠\n— RentFlow`;

  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  toast('Opening WhatsApp...', 'success');
}

// ========================================
// Reports & Analytics
// ========================================
async function renderReports() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  const currentYear = new Date().getFullYear();
  actions.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="exportCSV()">
    <span class="material-symbols-rounded">download</span>Export CSV</button>`;
  try {
    const data = await api(`/transactions/summary?year=${currentYear}`);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const paidData = new Array(12).fill(0);
    const pendingData = new Array(12).fill(0);
    (data.monthly || []).forEach(m => { paidData[m.month - 1] = m.paid_amount; pendingData[m.month - 1] = m.pending_amount; });

    area.innerHTML = `<div class="page-enter">
      <div class="stats-grid">
        <div class="stat-card green"><div class="stat-icon"><span class="material-symbols-rounded">trending_up</span></div>
          <div class="stat-value">${formatCurrency(data.annual?.total_paid || 0)}</div><div class="stat-label">Total Collected (${currentYear})</div></div>
        <div class="stat-card red"><div class="stat-icon"><span class="material-symbols-rounded">trending_down</span></div>
          <div class="stat-value">${formatCurrency(data.annual?.total_pending || 0)}</div><div class="stat-label">Outstanding</div></div>
        <div class="stat-card accent"><div class="stat-icon"><span class="material-symbols-rounded">receipt</span></div>
          <div class="stat-value">${data.annual?.total_count || 0}</div><div class="stat-label">Total Transactions</div></div>
        <div class="stat-card amber"><div class="stat-icon"><span class="material-symbols-rounded">error</span></div>
          <div class="stat-value">${data.annual?.overdue_count || 0}</div><div class="stat-label">Overdue</div></div>
      </div>
      <div class="content-grid">
        <div class="card"><div class="card-header"><span class="card-title">Monthly Overview (${currentYear})</span></div>
          <div class="chart-container"><canvas id="monthlyChart"></canvas></div></div>
        <div class="card"><div class="card-header"><span class="card-title">Payment Modes</span></div>
          <div class="chart-container"><canvas id="modeChart"></canvas></div></div>
      </div>
      ${(data.byProperty || []).length > 0 ? `<div class="card"><div class="card-header"><span class="card-title">By Property</span></div>
        <div class="data-table-wrapper"><table class="data-table"><thead><tr>
          <th>Property</th><th>Collected</th><th>Outstanding</th><th>Transactions</th></tr></thead><tbody>
          ${data.byProperty.map(p => `<tr><td style="font-weight:600">${p.name}</td>
            <td style="color:var(--green-text)">${formatCurrency(p.paid_amount)}</td>
            <td style="color:var(--red-text)">${formatCurrency(p.pending_amount)}</td>
            <td>${p.total_count}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
    </div>`;

    // Monthly bar chart
    const ctx1 = document.getElementById('monthlyChart').getContext('2d');
    chartInstances.monthly = new Chart(ctx1, {
      type: 'bar', data: {
        labels: months,
        datasets: [
          { label: 'Collected', data: paidData, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 6 },
          { label: 'Pending', data: pendingData, backgroundColor: 'rgba(245,158,11,0.7)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#a0a0b8', font: { family: 'Inter' } } } },
        scales: {
          x: { ticks: { color: '#6b6b82' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#6b6b82', callback: v => '₹' + (v / 1000) + 'k' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });

    // Mode donut chart
    if (data.byMode && data.byMode.length > 0) {
      const ctx2 = document.getElementById('modeChart').getContext('2d');
      const modeColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
      chartInstances.mode = new Chart(ctx2, {
        type: 'doughnut', data: {
          labels: data.byMode.map(m => m.mode.toUpperCase()),
          datasets: [{ data: data.byMode.map(m => m.total_amount), backgroundColor: modeColors.slice(0, data.byMode.length), borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          plugins: { legend: { position: 'bottom', labels: { color: '#a0a0b8', padding: 16, font: { family: 'Inter' } } } }
        }
      });
    }
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

async function exportCSV() {
  try {
    const result = await api('/transactions');
    const txns = result.transactions || [];
    if (txns.length === 0) { toast('No transactions to export', 'warning'); return; }
    const headers = ['Property', 'Tenant', 'Amount', 'Due Date', 'Date Paid', 'Mode', 'Status', 'Notes'];
    const rows = txns.map(t => [t.property_name || '', t.tenant_name || '', t.amount, t.due_date || '', t.date_paid || '', t.mode, t.status, t.notes || '']);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rent_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('CSV exported!', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ========================================
// App Initialization
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  if (token) { showApp(); }
});
