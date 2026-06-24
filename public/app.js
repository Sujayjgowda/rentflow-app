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
let adminUsersList = [];
let reportSelectedYear = '';
let reportSelectedProperty = '';

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
  await setupSidebar();
  navigate(currentUser.role === 'admin' ? 'admin_users' : 'dashboard');
}

async function setupSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const isLandlord = currentUser.role === 'landlord';
  const isAdmin = currentUser.role === 'admin';

  let propertyCount = 0;
  let transactionCount = 0;

  if (isLandlord) {
    try {
      const [props, dash, txs] = await Promise.all([
        api('/properties').catch(() => []),
        api('/dashboard/landlord').catch(() => null),
        api('/transactions').catch(() => ({ transactions: [] }))
      ]);
      propertyCount = props ? props.length : 0;
      transactionCount = (txs && txs.transactions) ? txs.transactions.length : 0;
    } catch (err) {
      console.warn('Failed to load sidebar badge counts:', err);
    }
  }

  const items = isAdmin ? [
    {
      section: 'Admin', items: [
        { id: 'admin_users', icon: 'manage_accounts', label: 'User Management' }
      ]
    }
  ] : isLandlord ? [
    {
      section: 'Main', items: [
        { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
        { id: 'properties', icon: '🏠', label: 'Properties', badge: propertyCount },
        { id: 'tenants', icon: '👤', label: 'Tenants' },
        { id: 'transactions', icon: '₹', label: 'Transactions', badge: transactionCount },
      ]
    },
    {
      section: 'Management', items: [
        { id: 'agreements', icon: '📋', label: 'Agreements' },
        { id: 'rent_receipts', icon: '📄', label: 'Rent Receipts' },
        { id: 'bills', icon: '💡', label: 'Shared Bills' },
        { id: 'advances', icon: '💰', label: 'Advance Amount' },
      ]
    },
    {
      section: 'Insights', items: [
        { id: 'reports', icon: '📊', label: 'Reports' },
        { id: 'automations', icon: '⚡', label: 'Automations' },
      ]
    }
  ] : [
    {
      section: 'Main', items: [
        { id: 'dashboard', icon: '⊞', label: 'Dashboard' },
        { id: 'agreements', icon: '📋', label: 'Agreements' },
        { id: 'transactions', icon: '₹', label: 'My Payments' },
        { id: 'advances', icon: '💰', label: 'Advance Amount' },
        { id: 'bills', icon: '💡', label: 'Shared Bills' },
        { id: 'reports', icon: '📊', label: 'Reports' },
        { id: 'rent_receipts', icon: '📄', label: 'Rent Receipts' },
      ]
    }
  ];

  nav.innerHTML = items.map(section => `
    <div class="nav-section">
      <div class="sidebar-section-label">${section.section}</div>
      ${section.items.map(item => {
        const isMaterial = item.icon.length > 2;
        const iconHtml = isMaterial 
          ? `<span class="material-symbols-rounded">${item.icon}</span>` 
          : `<span class="nav-icon">${item.icon}</span>`;
        return `
          <button class="nav-item ${item.id === currentPage ? 'active' : ''}" data-page="${item.id}" onclick="navigate('${item.id}')">
            ${iconHtml}
            <span>${item.label}</span>
            ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
          </button>
        `;
      }).join('')}
    </div>
  `).join('');

  const user = document.getElementById('sidebar-user');
  const initials = (currentUser.name || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  user.innerHTML = `
    <div class="user-chip" onclick="logout()" title="Click to logout" style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius); background: rgba(255,255,255,0.05); cursor: pointer; transition: var(--transition); width: 100%;">
      <div class="user-avatar" style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: var(--text-primary); flex-shrink: 0;">${initials}</div>
      <div style="flex: 1; min-width: 0;">
        <div class="user-name" style="font-size: 0.82rem; font-weight: 500; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${currentUser.name}</div>
        <div class="user-role" style="font-size: 0.7rem; color: rgba(255,255,255,0.35); text-transform: capitalize;">${currentUser.role}</div>
      </div>
      <span class="material-symbols-rounded" style="color: rgba(255,255,255,0.25); font-size: 1.1rem; flex-shrink: 0;">logout</span>
    </div>`;

  document.getElementById('mobile-menu-btn').onclick = () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.body.classList.toggle('sidebar-open');
  };
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('sidebar').classList.remove('open');
  document.body.classList.remove('sidebar-open');
  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const titles = { dashboard: 'Dashboard', properties: 'Properties', tenants: 'Tenants', transactions: 'Transactions', reports: 'Reports & Analytics', agreements: 'Rent Agreements', advances: 'Advance Amount', admin_users: 'User Management', bills: 'Shared Bills', rent_receipts: 'Rent Receipt Generator', automations: 'Transaction Automations' };
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
    case 'agreements': renderAgreements(); break;
    case 'advances': renderAdvances(); break;
    case 'admin_users': renderAdminUsers(); break;
    case 'bills': renderBills(); break;
    case 'rent_receipts': renderRentReceipts(); break;
    case 'automations': renderAutomations(); break;
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
      const now = new Date();
      const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      const hour = now.getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      const firstName = currentUser.name.split(' ')[0];

      // 1. Calculate historical 6 months summary for the custom bar chart
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          label: monthNames[d.getMonth()],
          paid: 0,
          pending: 0
        });
      }

      try {
        const summaryData = await api(`/transactions/summary?year=${now.getFullYear()}`);
        if (summaryData && summaryData.monthly) {
          summaryData.monthly.forEach(m => {
            const match = last6Months.find(l => l.year === now.getFullYear() && l.month === m.label_id);
            if (match) {
              match.paid = parseFloat(m.paid_amount || 0);
              match.pending = parseFloat(m.pending_amount || 0);
            }
          });
        }
        const prevYear = now.getFullYear() - 1;
        const needsPrevYear = last6Months.some(l => l.year === prevYear);
        if (needsPrevYear) {
          const prevSummary = await api(`/transactions/summary?year=${prevYear}`);
          if (prevSummary && prevSummary.monthly) {
            prevSummary.monthly.forEach(m => {
              const match = last6Months.find(l => l.year === prevYear && l.month === m.label_id);
              if (match) {
                match.paid = parseFloat(m.paid_amount || 0);
                match.pending = parseFloat(m.pending_amount || 0);
              }
            });
          }
        }
      } catch (e) {
        console.warn('Failed to load chart data:', e);
      }

      const maxVal = Math.max(...last6Months.map(m => m.paid + m.pending), 10000);
      const chartBarsHtml = last6Months.map(m => {
        const paidHeight = Math.max(4, Math.round((m.paid / maxVal) * 140));
        const pendingHeight = Math.max(4, Math.round((m.pending / maxVal) * 140));
        const isCurrentMonth = m.month === (now.getMonth() + 1) && m.year === now.getFullYear();
        return `
          <div class="bar-group">
            <div class="bar-pair">
              <div class="bar collected" style="height:${paidHeight}px; ${isCurrentMonth ? 'background:var(--accent-dark)' : ''}" title="Paid: ${formatCurrency(m.paid)}"></div>
              <div class="bar pending" style="height:${pendingHeight}px; ${isCurrentMonth ? 'border-color:var(--accent)' : ''}" title="Pending: ${formatCurrency(m.pending)}"></div>
            </div>
            <div class="bar-label" ${isCurrentMonth ? 'style="color:var(--accent-dark);font-weight:600"' : ''}>${m.label}</div>
          </div>
        `;
      }).join('');

      // 2. Fetch properties list
      let propertiesList = [];
      try {
        propertiesList = await api('/properties');
      } catch (e) {
        console.warn('Failed to fetch properties for dashboard:', e);
      }
      const topPropertiesHtml = propertiesList.slice(0, 2).map((p, idx) => {
        const rentAmount = parseFloat(p.rent_amount) || 0;
        const icon = p.property_type === 'apartment' ? '🏢' : '🏠';
        const bg = idx === 0 ? 'linear-gradient(135deg,#fef3c7,#fde68a)' : 'linear-gradient(135deg,#dcfce7,#bbf7d0)';
        return `
          <div class="prop-card" onclick="navigate('properties')">
            <div class="prop-thumb" style="background:${bg};">
              <div class="prop-thumb-label">${icon}</div>
            </div>
            <div class="prop-info">
              <div class="prop-name">${p.name}</div>
              <div class="prop-addr" title="${p.address || ''}">${p.address || 'Bengaluru, India'}</div>
              <div class="prop-meta">
                <div><div class="prop-rent">${formatCurrency(rentAmount)}</div><div class="prop-rent-label">per month</div></div>
                <div style="display:flex;align-items:center"><div class="prop-status-dot"></div><span class="prop-status-text">Occupied</span></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      const propertiesBlockHtml = topPropertiesHtml || `
        <div class="empty-state" style="padding: 20px;">
          <span class="material-symbols-rounded">home</span>
          <p>No properties added yet</p>
        </div>
      `;

      // 3. Fetch tenants status list
      let tenantsList = [];
      try {
        tenantsList = await api('/tenants');
      } catch (e) {
        console.warn('Failed to fetch tenants for dashboard:', e);
      }
      const tenantRowsHtml = tenantsList.slice(0, 5).map(t => {
        const activeDue = (data.upcomingDues || []).find(d => d.tenant_id === t.id);
        const initials = t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        let status = 'paid';
        let amount = t.rent_amount || 0;
        let statusLabel = 'Paid';
        let avatarBg = '#dcfce7';
        let avatarColor = '#166534';
        let borderColor = '#86efac';

        if (activeDue) {
          status = activeDue.status;
          amount = activeDue.amount;
          if (status === 'overdue') {
            statusLabel = 'Overdue';
            avatarBg = '#fee2e2';
            avatarColor = '#991b1b';
            borderColor = '#fca5a5';
          } else {
            statusLabel = 'Pending';
            avatarBg = '#fef3c7';
            avatarColor = '#92400e';
            borderColor = '#fde68a';
          }
        }
        return `
          <div class="tenant-row" onclick="navigate('tenants')">
            <div class="tenant-avatar" style="background:${avatarBg}; color:${avatarColor}; border-color:${borderColor};">${initials}</div>
            <div>
              <div class="tenant-name">${t.name}</div>
              <div class="tenant-unit">${t.property_name || 'Apartment'}</div>
            </div>
            <div style="margin-left:auto;text-align:right">
              <div class="tenant-amount">${formatCurrency(amount)}</div>
              <span class="status-pill ${status}">${statusLabel}</span>
            </div>
          </div>
        `;
      }).join('');
      const tenantBlockHtml = tenantRowsHtml || `
        <div class="empty-state" style="padding: 20px;">
          <span class="material-symbols-rounded">group</span>
          <p>No tenants registered yet</p>
        </div>
      `;

      // 4. Occupancy Rate Donut
      const totalProps = parseInt(data.stats.propertyCount) || 0;
      const occupiedProps = parseInt(data.stats.tenantCount) || 0;
      const vacantProps = Math.max(0, totalProps - occupiedProps);
      const occupancyRate = totalProps > 0 ? Math.round((occupiedProps / totalProps) * 100) : 0;
      const strokeDasharray = 238.76;
      const strokeDashoffset = strokeDasharray * (1 - occupancyRate / 100);

      // 5. Recent Activity
      const activityItemsHtml = (data.recentActivity || []).slice(0, 3).map((act, idx, arr) => {
        let dotColor = 'var(--text-muted)';
        const action = act.action || '';
        const details = act.details || '';
        if (action.includes('pay') || action.includes('receipt') || details.toLowerCase().includes('paid') || details.toLowerCase().includes('received')) {
          dotColor = 'var(--green)';
        } else if (action.includes('reminder') || action.includes('warning') || action.includes('delete') || action.includes('pause')) {
          dotColor = 'var(--red)';
        } else if (action.includes('automation') || action.includes('update')) {
          dotColor = 'var(--amber)';
        } else if (action.includes('upload') || action.includes('agreement') || action.includes('create') || action.includes('add')) {
          dotColor = 'var(--blue)';
        }
        const showLine = idx < arr.length - 1;
        return `
          <div class="activity-item" style="border-bottom: ${showLine ? '1px solid var(--cream-deep)' : 'none'}">
            <div class="activity-dot-wrap">
              <div class="activity-dot" style="background:${dotColor}"></div>
              ${showLine ? '<div class="activity-line"></div>' : ''}
            </div>
            <div class="activity-body">
              <div class="activity-text">${details}</div>
              <div class="activity-time">${timeAgo(act.created_at)}</div>
            </div>
          </div>
        `;
      }).join('');
      const activityBlockHtml = activityItemsHtml || `
        <div class="empty-state" style="padding: 20px;">
          <span class="material-symbols-rounded">history</span>
          <p>No recent activity logs</p>
        </div>
      `;

      // 6. Topbar actions
      const dateStr = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const actions = document.getElementById('top-bar-actions');
      actions.innerHTML = `
        <span class="topbar-date">📅 ${dateStr}</span>
        <button class="btn btn-primary btn-sm" onclick="showAddPropertyModal()">
          <span class="material-symbols-rounded">add</span>Add Property
        </button>
      `;

      const totalPendingAmt = (data.upcomingDues || []).reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

      // Render dashboard HTML content area
      area.innerHTML = `<div class="page-enter">
        <div class="greeting">
          <div class="greeting-text">
            <h1>${greeting}, ${firstName} 👋</h1>
            <p>Here's your portfolio overview for ${monthName}</p>
          </div>
          <div class="month-chip">🌾 Rent Collection Month</div>
        </div>

        <!-- Stats Row -->
        <div class="stats-grid">
          <div class="stat-card accent">
            <div class="stat-icon amber">🏦</div>
            <div class="stat-label">Total Rent Collected</div>
            <div class="stat-value">${formatCurrency(data.stats.monthlyIncome)}</div>
            <span class="stat-change up">Collected this month</span>
          </div>
          <div class="stat-card green">
            <div class="stat-icon green">🏠</div>
            <div class="stat-label">Properties</div>
            <div class="stat-value">${data.stats.propertyCount}</div>
            <span class="stat-change neu">${occupiedProps} occupied · ${vacantProps} vacant</span>
          </div>
          <div class="stat-card red">
            <div class="stat-icon red">⚠️</div>
            <div class="stat-label">Pending Dues</div>
            <div class="stat-value">${formatCurrency(totalPendingAmt)}</div>
            <span class="stat-change down">▼ ${data.stats.overdueCount} tenants overdue</span>
          </div>
          <div class="stat-card blue">
            <div class="stat-icon blue">👥</div>
            <div class="stat-label">Active Tenants</div>
            <div class="stat-value">${data.stats.tenantCount}</div>
            <span class="stat-change up">▲ active in portfolio</span>
          </div>
        </div>

        <!-- Main Grid: Bar Chart + Tenant Status -->
        <div class="main-grid">
          <!-- Bar Chart -->
          <div class="card">
            <div class="card-head">
              <div style="flex: 1;">
                <div class="card-title">Rent Collection — Last 6 Months</div>
                <div class="card-subtitle">Collected vs Pending</div>
              </div>
              <button class="card-action" onclick="navigate('reports')">View Report →</button>
            </div>
            <div class="chart-area">
              <div class="chart-legend">
                <div class="legend-item"><div class="legend-dot" style="background:var(--accent)"></div> Collected</div>
                <div class="legend-item"><div class="legend-dot" style="background:var(--border-light)"></div> Pending</div>
              </div>
              <div class="bars-wrap">
                ${chartBarsHtml}
              </div>
            </div>
          </div>

          <!-- Tenant Status List -->
          <div class="card">
            <div class="card-head">
              <div style="flex: 1;">
                <div class="card-title">Tenant Status</div>
                <div class="card-subtitle">This month's collection</div>
              </div>
              <button class="card-action" onclick="navigate('tenants')">All →</button>
            </div>
            <div class="tenant-list">
              ${tenantBlockHtml}
            </div>
          </div>
        </div>

        <!-- Bottom Row: Properties + Quick Actions + Donut Chart & Activity -->
        <div class="bottom-row">
          <!-- Top Properties -->
          <div class="card">
            <div class="card-head">
              <div class="card-title" style="flex: 1;">Top Properties</div>
              <button class="card-action" onclick="navigate('properties')">Manage →</button>
            </div>
            <div style="padding:14px; display:flex; flex-direction:column; gap:10px;">
              ${propertiesBlockHtml}
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="card">
            <div class="card-head">
              <div class="card-title" style="flex: 1;">Quick Actions</div>
            </div>
            <div class="actions-grid">
              <div class="action-tile" onclick="navigate('rent_receipts')">
                <span class="action-tile-icon">📄</span>
                <span class="action-tile-label">Generate Receipt</span>
              </div>
              <div class="action-tile" onclick="navigate('tenants'); showAddTenantModal();">
                <span class="action-tile-icon">➕</span>
                <span class="action-tile-label">Add Tenant</span>
              </div>
              <div class="action-tile" onclick="navigate('transactions'); showAddTransactionModal();">
                <span class="action-tile-icon">💳</span>
                <span class="action-tile-label">Record Payment</span>
              </div>
              <div class="action-tile" onclick="navigate('agreements'); showUploadAgreementModal();">
                <span class="action-tile-icon">📋</span>
                <span class="action-tile-label">New Agreement</span>
              </div>
              <div class="action-tile" onclick="navigate('bills'); showAddBillModal();">
                <span class="action-tile-icon">💡</span>
                <span class="action-tile-label">Add Bill</span>
              </div>
              <div class="action-tile" onclick="navigate('reports')">
                <span class="action-tile-icon">📊</span>
                <span class="action-tile-label">View Report</span>
              </div>
            </div>
          </div>

          <!-- Donut Occupancy + Recent Activity -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card">
              <div class="card-head">
                <div class="card-title" style="flex: 1;">Occupancy Rate</div>
              </div>
              <div class="donut-wrap">
                <svg class="donut-svg" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#e8dfd0" stroke-width="10"/>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#d97706" stroke-width="10"
                    stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"
                    stroke-linecap="round"
                    transform="rotate(-90 50 50)"/>
                  <text x="50" y="47" text-anchor="middle" font-family="Lora,serif" font-size="16" font-weight="700" fill="#1c1917">${occupancyRate}%</text>
                  <text x="50" y="60" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="7" fill="#78716c">Occupied</text>
                </svg>
                <div class="donut-stats">
                  <div class="donut-stat">
                    <div class="donut-stat-val" style="color:var(--green)">${occupiedProps}</div>
                    <div class="donut-stat-label">Occupied</div>
                  </div>
                  <div class="donut-stat">
                    <div class="donut-stat-val" style="color:var(--red)">${vacantProps}</div>
                    <div class="donut-stat-label">Vacant</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-head">
                <div class="card-title" style="flex: 1;">Recent Activity</div>
              </div>
              <div class="activity-list">
                ${activityBlockHtml}
              </div>
            </div>
          </div>
        </div>

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
          <div class="stat-card green">
            <div class="stat-icon green">🏦</div>
            <div class="stat-label">Total Paid</div>
            <div class="stat-value">${formatCurrency(data.stats.totalPaid)}</div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon red">⚠️</div>
            <div class="stat-label">Pending</div>
            <div class="stat-value">${formatCurrency(data.stats.pendingAmount)}</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-icon amber">🏠</div>
            <div class="stat-label">Active Leases</div>
            <div class="stat-value">${data.stats.activeLeaseCount}</div>
          </div>
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
      <th>Name</th><th>Property</th><th>Phone</th><th>Email</th><th>Lease Start</th><th>Lease End</th>${currentUser.role === 'landlord' ? '<th>Actions</th>' : ''}</tr></thead><tbody>
      ${tenants.map(t => `<tr><td style="font-weight:600">${t.name}</td><td>${t.property_name || '—'}</td><td>${t.phone || '—'}</td>
        <td>${t.email || '—'}</td><td>${formatDate(t.lease_start)}</td><td>${formatDate(t.lease_end)}</td>
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
    <div class="form-group"><span class="material-symbols-rounded input-icon">phone</span><input type="tel" id="ten-phone" placeholder="Phone number" required></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">email</span><input type="email" id="ten-email" placeholder="Email (optional)"></div>
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
    <div class="form-group"><span class="material-symbols-rounded input-icon">phone</span><input type="tel" id="ten-phone" value="${phone}" required></div>
    <div class="form-group"><span class="material-symbols-rounded input-icon">email</span><input type="email" id="ten-email" value="${email}" placeholder="Email (optional)"></div>
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
async function renderReports(selectedYear = reportSelectedYear, selectedProperty = reportSelectedProperty) {
  reportSelectedYear = selectedYear;
  reportSelectedProperty = selectedProperty;

  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  actions.innerHTML = `<button class="btn btn-secondary btn-sm" onclick="exportCSV()">
    <span class="material-symbols-rounded">download</span>Export CSV</button>`;

  try {
    const params = new URLSearchParams();
    if (selectedYear) params.set('year', selectedYear);
    if (selectedProperty) params.set('property_id', selectedProperty);

    const data = await api(`/transactions/summary?${params}`);

    if (!reportSelectedYear) {
      reportSelectedYear = String(data.year);
    }

    let propertiesList = [];
    if (currentUser.role === 'landlord') {
      try {
        propertiesList = await api('/properties');
      } catch (e) {
        console.warn('Failed to fetch properties for report dropdown:', e);
      }
    }

    let chartLabels = [];
    let paidData = [];
    let pendingData = [];

    const isAllTime = reportSelectedYear === 'all';

    if (isAllTime) {
      chartLabels = (data.monthly || []).map(m => String(m.label_id));
      paidData = (data.monthly || []).map(m => m.paid_amount);
      pendingData = (data.monthly || []).map(m => m.pending_amount);
    } else {
      chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      paidData = new Array(12).fill(0);
      pendingData = new Array(12).fill(0);
      (data.monthly || []).forEach(m => {
        const idx = m.label_id - 1;
        if (idx >= 0 && idx < 12) {
          paidData[idx] = m.paid_amount;
          pendingData[idx] = m.pending_amount;
        }
      });
    }

    const years = data.availableYears || [new Date().getFullYear()];
    const yearOptions = [
      `<option value="all" ${reportSelectedYear === 'all' ? 'selected' : ''}>All Time (All Years)</option>`,
      ...years.map(y => `<option value="${y}" ${String(y) === String(reportSelectedYear) ? 'selected' : ''}>Year ${y}</option>`)
    ].join('');

    const propertyFilterHTML = currentUser.role === 'landlord' ? `
      <select class="filter-select" id="report-filter-prop" onchange="renderReports(reportSelectedYear, this.value)">
        <option value="">All Properties</option>
        ${propertiesList.map(p => `<option value="${p.id}" ${p.id === reportSelectedProperty ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
    ` : '';

    const displayYearTitle = isAllTime ? 'All Time' : `Year ${reportSelectedYear}`;

    area.innerHTML = `<div class="page-enter">
      <div class="filters-bar">
        <select class="filter-select" id="report-filter-year" onchange="renderReports(this.value, reportSelectedProperty)">
          ${yearOptions}
        </select>
        ${propertyFilterHTML}
      </div>

      <div class="stats-grid">
        <div class="stat-card green">
          <div class="stat-icon green">📈</div>
          <div class="stat-label">Total Collected (${displayYearTitle})</div>
          <div class="stat-value">${formatCurrency(data.annual?.total_paid || 0)}</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon red">📉</div>
          <div class="stat-label">Outstanding (${displayYearTitle})</div>
          <div class="stat-value">${formatCurrency(data.annual?.total_pending || 0)}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-icon amber">📄</div>
          <div class="stat-label">Total Transactions (${displayYearTitle})</div>
          <div class="stat-value">${data.annual?.total_count || 0}</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon red">🚨</div>
          <div class="stat-label">Overdue (${displayYearTitle})</div>
          <div class="stat-value">${data.annual?.overdue_count || 0}</div>
        </div>
      </div>
      <div class="content-grid">
        <div class="card"><div class="card-header"><span class="card-title">${isAllTime ? 'Annual Overview' : 'Monthly Overview'} (${displayYearTitle})</span></div>
          <div class="chart-container"><canvas id="monthlyChart"></canvas></div></div>
        <div class="card"><div class="card-header"><span class="card-title">Payment Modes</span></div>
          <div class="chart-container"><canvas id="modeChart"></canvas></div></div>
      </div>
      ${(data.byProperty || []).length > 0 ? `<div class="card"><div class="card-header"><span class="card-title">By Property Breakdown (${displayYearTitle})</span></div>
        <div class="data-table-wrapper"><table class="data-table"><thead><tr>
          <th>Property</th><th>Collected</th><th>Outstanding</th><th>Transactions</th></tr></thead><tbody>
          ${data.byProperty.map(p => `<tr><td style="font-weight:600">${p.name}</td>
            <td style="color:var(--green-text)">${formatCurrency(p.paid_amount)}</td>
            <td style="color:var(--red-text)">${formatCurrency(p.pending_amount)}</td>
            <td>${p.total_count}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
    </div>`;

    // Monthly/Annual bar chart
    const ctx1 = document.getElementById('monthlyChart').getContext('2d');
    chartInstances.monthly = new Chart(ctx1, {
      type: 'bar', data: {
        labels: chartLabels,
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
    } else {
      const modeChartCanvas = document.getElementById('modeChart');
      if (modeChartCanvas) {
        modeChartCanvas.parentElement.innerHTML = '<div class="empty-state" style="padding: 20px;"><span class="material-symbols-rounded">payments</span><p>No paid transactions to show</p></div>';
      }
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
// Rent Agreements Page
// ========================================
async function renderAgreements() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  const isLandlord = currentUser.role === 'landlord';

  try {
    const agreements = await api('/agreements');
    const properties = isLandlord ? await api('/properties') : [];

    if (isLandlord) {
      actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showUploadAgreementModal()">
        <span class="material-symbols-rounded">upload_file</span>Upload Agreement</button>`;
    }

    if (agreements.length === 0) {
      area.innerHTML = `<div class="page-enter empty-state">
        <span class="material-symbols-rounded">description</span>
        <h3>No agreements yet</h3>
        <p>${isLandlord ? 'Upload a rent agreement document for your properties.' : 'No rent agreement has been uploaded by your landlord yet.'}</p>
        ${isLandlord ? '<button class="btn btn-primary" onclick="showUploadAgreementModal()"><span class="material-symbols-rounded">upload_file</span>Upload Agreement</button>' : ''}
      </div>`;
      return;
    }

    area.innerHTML = `<div class="page-enter">
      <div class="agreement-grid">${agreements.map(ag => {
        const isImage = ag.file_type && ag.file_type.startsWith('image/');
        const isPdf = ag.file_type && ag.file_type.includes('pdf');
        const previewUrl = `${SERVER_URL}${ag.file_path}`;
        return `
        <div class="agreement-card">
          <div class="agreement-card-header">
            <div class="agreement-icon">
              <span class="material-symbols-rounded">${isPdf ? 'picture_as_pdf' : 'image'}</span>
            </div>
            <div class="agreement-meta">
              <div class="agreement-property">${ag.property_name}</div>
              <div class="agreement-filename">${ag.file_name}</div>
            </div>
          </div>
          <div class="agreement-preview">
            ${isImage ? `<img src="${previewUrl}" alt="Agreement preview" class="agreement-preview-img" onclick="window.open('${previewUrl}','_blank')">`
              : isPdf ? `<div class="agreement-pdf-preview" onclick="window.open('${previewUrl}','_blank')">
                  <span class="material-symbols-rounded" style="font-size:48px;color:var(--accent-light)">picture_as_pdf</span>
                  <span>Click to view PDF</span>
                </div>`
              : `<div class="agreement-pdf-preview" onclick="window.open('${previewUrl}','_blank')">
                  <span class="material-symbols-rounded" style="font-size:48px;color:var(--accent-light)">description</span>
                  <span>Click to view</span>
                </div>`}
          </div>
          <div class="agreement-info">
            <div class="agreement-info-row">
              <span class="material-symbols-rounded" style="font-size:16px">person</span>
              <span>Uploaded by ${ag.uploaded_by_name || 'Unknown'}</span>
            </div>
            <div class="agreement-info-row">
              <span class="material-symbols-rounded" style="font-size:16px">calendar_today</span>
              <span>${formatDate(ag.updated_at || ag.created_at)}</span>
            </div>
          </div>
          <div class="agreement-actions">
            <a href="${previewUrl}" target="_blank" class="btn btn-secondary btn-sm">
              <span class="material-symbols-rounded">visibility</span>View
            </a>
            <a href="${previewUrl}" download="${ag.file_name}" class="btn btn-secondary btn-sm">
              <span class="material-symbols-rounded">download</span>Download
            </a>
            ${isLandlord ? `
              <button class="btn btn-secondary btn-sm" onclick="showReplaceAgreementModal('${ag.property_id}','${esc(ag.property_name)}')">
                <span class="material-symbols-rounded">sync</span>Replace
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteAgreement('${ag.property_id}')">
                <span class="material-symbols-rounded">delete</span>Delete
              </button>
            ` : ''}
          </div>
        </div>`;
      }).join('')}</div>
    </div>`;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

async function showUploadAgreementModal() {
  let propsHtml = '';
  try {
    const props = await api('/properties');
    propsHtml = props.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch { }
  openModal('Upload Rent Agreement', `<div class="auth-form">
    <div class="form-group no-icon"><label class="form-label">Property</label>
      <select id="agree-prop">${propsHtml}</select></div>
    <div class="form-group no-icon"><label class="form-label">Agreement Document</label>
      <div class="upload-area" onclick="document.getElementById('agree-file').click()">
        <span class="material-symbols-rounded">cloud_upload</span>
        <p>Click to upload agreement (PDF, JPG, PNG, WebP)</p>
        <div class="file-name" id="agree-filename"></div>
      </div>
      <input type="file" id="agree-file" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="document.getElementById('agree-filename').textContent=this.files[0]?.name||''">
    </div>
  </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="submitAgreement()">Upload</button>`);
}

function showReplaceAgreementModal(propertyId, propertyName) {
  openModal('Replace Agreement — ' + propertyName, `<div class="auth-form">
    <div class="form-group no-icon"><label class="form-label">New Agreement Document</label>
      <div class="upload-area" onclick="document.getElementById('agree-replace-file').click()">
        <span class="material-symbols-rounded">cloud_upload</span>
        <p>Click to upload new agreement (PDF, JPG, PNG, WebP)</p>
        <div class="file-name" id="agree-replace-filename"></div>
      </div>
      <input type="file" id="agree-replace-file" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="document.getElementById('agree-replace-filename').textContent=this.files[0]?.name||''">
    </div>
  </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="submitReplaceAgreement('${propertyId}')">Replace</button>`);
}

async function submitAgreement() {
  const propId = document.getElementById('agree-prop').value;
  const file = document.getElementById('agree-file').files[0];
  if (!file) { toast('Please select a file', 'warning'); return; }
  try {
    const formData = new FormData();
    formData.append('agreement', file);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}/agreements/${propId}`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast('Agreement uploaded!', 'success');
    closeModal();
    renderAgreements();
  } catch (err) { toast(err.message, 'error'); }
}

async function submitReplaceAgreement(propId) {
  const file = document.getElementById('agree-replace-file').files[0];
  if (!file) { toast('Please select a file', 'warning'); return; }
  try {
    const formData = new FormData();
    formData.append('agreement', file);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}/agreements/${propId}`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast('Agreement replaced!', 'success');
    closeModal();
    renderAgreements();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteAgreement(propId) {
  if (!confirm('Delete this agreement document? This cannot be undone.')) return;
  try {
    await api(`/agreements/${propId}`, { method: 'DELETE' });
    toast('Agreement deleted', 'success');
    renderAgreements();
  } catch (err) { toast(err.message, 'error'); }
}

// ========================================
// Advance Amount Page
// ========================================
async function renderAdvances() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  const isLandlord = currentUser.role === 'landlord';

  if (isLandlord) {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showAddAdvanceModal()">
      <span class="material-symbols-rounded">add</span>Add Advance</button>`;
  }

  try {
    const properties = isLandlord ? await api('/properties') : [];
    const data = await api('/advances');
    const advances = data.advances || [];
    const totalAdvance = data.total_advance || 0;

    // Build filter bar for landlord
    const filterBar = isLandlord ? `<div class="filters-bar">
      <select class="filter-select" id="adv-filter-prop" onchange="applyAdvanceFilters()">
        <option value="">All Properties</option>
        ${properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    </div>` : '';

    if (advances.length === 0) {
      area.innerHTML = `<div class="page-enter">
        ${filterBar}
        <div class="empty-state">
          <span class="material-symbols-rounded">savings</span>
          <h3>No advance payments</h3>
          <p>${isLandlord ? 'Record advance payments from your tenants.' : 'No advance payments have been recorded yet.'}</p>
          ${isLandlord ? '<button class="btn btn-primary" onclick="showAddAdvanceModal()"><span class="material-symbols-rounded">add</span>Add Advance</button>' : ''}
        </div>
      </div>`;
      return;
    }

    area.innerHTML = `<div class="page-enter">
      ${filterBar}
      <div class="advance-summary-card">
        <div class="advance-summary-icon">
          <span class="material-symbols-rounded">account_balance_wallet</span>
        </div>
        <div class="advance-summary-content">
          <div class="advance-summary-label">Total Advance Amount</div>
          <div class="advance-summary-value">${formatCurrency(totalAdvance)}</div>
        </div>
        <div class="advance-summary-count">
          <span>${advances.length}</span>
          <span class="advance-summary-count-label">Payment${advances.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="card" id="advance-table-card">
        ${renderAdvanceTable(advances, isLandlord)}
      </div>
    </div>`;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderAdvanceTable(advances, isLandlord) {
  if (!advances || advances.length === 0) {
    return '<div class="empty-state"><span class="material-symbols-rounded">savings</span><h3>No advance payments</h3></div>';
  }
  return `<div class="data-table-wrapper"><table class="data-table"><thead><tr>
    <th>Tenant</th><th>Property</th><th>Amount</th><th>Date Paid</th><th>Notes</th><th>Receipt</th>${isLandlord ? '<th>Actions</th>' : ''}
  </tr></thead><tbody>
    ${advances.map(a => `<tr>
      <td style="font-weight:600">${a.tenant_name}</td>
      <td>${a.property_name}</td>
      <td style="font-weight:700;color:var(--green-text)">${formatCurrency(a.amount)}</td>
      <td>${formatDate(a.paid_date)}</td>
      <td>${a.notes || '—'}</td>
      <td>${a.receipt_path ? `<a class="property-action-btn" href="${a.receipt_path}" target="_blank" title="View Receipt"><span class="material-symbols-rounded">attachment</span></a>` : '—'}</td>
      ${isLandlord ? `<td><div style="display:flex;gap:4px">
        <button class="property-action-btn" onclick="showEditAdvanceModal('${a.id}',${a.amount},'${a.paid_date}','${esc(a.notes || '')}','${esc(a.receipt_path || '')}')"><span class="material-symbols-rounded">edit</span></button>
        <button class="property-action-btn" onclick="deleteAdvance('${a.id}')"><span class="material-symbols-rounded">delete</span></button>
      </div></td>` : ''}
    </tr>`).join('')}
  </tbody></table></div>`;
}

async function applyAdvanceFilters() {
  const propId = document.getElementById('adv-filter-prop').value;
  const params = propId ? `?property_id=${propId}` : '';
  try {
    const data = await api(`/advances${params}`);
    const advances = data.advances || [];
    const totalAdvance = data.total_advance || 0;
    const isLandlord = currentUser.role === 'landlord';

    // Update summary card
    const summaryValue = document.querySelector('.advance-summary-value');
    const summaryCount = document.querySelector('.advance-summary-count span:first-child');
    if (summaryValue) summaryValue.textContent = formatCurrency(totalAdvance);
    if (summaryCount) summaryCount.textContent = advances.length;

    document.getElementById('advance-table-card').innerHTML = renderAdvanceTable(advances, isLandlord);
  } catch (err) { toast(err.message, 'error'); }
}

async function showAddAdvanceModal() {
  let propsHtml = '', tenantsHtml = '';
  try {
    const props = await api('/properties');
    propsHtml = props.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const tenants = await api('/tenants');
    tenantsHtml = tenants.map(t => `<option value="${t.id}" data-prop="${t.property_id}">${t.name} (${t.property_name})</option>`).join('');
  } catch { }
  const today = new Date().toISOString().split('T')[0];
  openModal('Add Advance Payment', `<div class="auth-form">
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Property</label>
        <select id="adv-prop" onchange="filterAdvanceTenants()">${propsHtml}</select></div>
      <div class="form-group no-icon"><label class="form-label">Tenant</label>
        <select id="adv-tenant">${tenantsHtml}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Amount (₹)</label>
        <input type="number" id="adv-amount" placeholder="50000" required></div>
      <div class="form-group no-icon"><label class="form-label">Date Paid</label>
        <input type="date" id="adv-date" value="${today}" required></div>
    </div>
    <div class="form-group no-icon"><label class="form-label">Notes</label>
      <textarea id="adv-notes" style="padding:12px;min-height:60px" placeholder="Optional notes..."></textarea></div>
    <div class="form-group no-icon"><label class="form-label">Receipt</label>
      <div class="upload-area" onclick="document.getElementById('adv-receipt').click()">
        <span class="material-symbols-rounded">cloud_upload</span><p>Click to upload receipt</p>
        <div class="file-name" id="adv-receipt-filename"></div>
      </div>
      <input type="file" id="adv-receipt" accept=".jpg,.jpeg,.png,.pdf,.webp" style="display:none" onchange="document.getElementById('adv-receipt-filename').textContent=this.files[0]?.name||''">
    </div>
  </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="submitAdvance()">Add Advance</button>`);
  filterAdvanceTenants();
}

function filterAdvanceTenants() {
  const propId = document.getElementById('adv-prop').value;
  const tenantSelect = document.getElementById('adv-tenant');
  Array.from(tenantSelect.options).forEach(opt => {
    if (opt.dataset.prop) {
      opt.style.display = opt.dataset.prop === propId ? '' : 'none';
    }
  });
  // Select first visible option
  const firstVisible = Array.from(tenantSelect.options).find(o => o.style.display !== 'none');
  if (firstVisible) tenantSelect.value = firstVisible.value;
}

async function submitAdvance() {
  try {
    const formData = new FormData();
    formData.append('property_id', document.getElementById('adv-prop').value);
    formData.append('tenant_id', document.getElementById('adv-tenant').value);
    formData.append('amount', document.getElementById('adv-amount').value);
    formData.append('paid_date', document.getElementById('adv-date').value);
    formData.append('notes', document.getElementById('adv-notes').value);
    
    const receipt = document.getElementById('adv-receipt').files[0];
    if (receipt) formData.append('receipt', receipt);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/advances`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Advance payment recorded!', 'success');
    closeModal();
    renderAdvances();
  } catch (err) { toast(err.message, 'error'); }
}

function showEditAdvanceModal(id, amount, paidDate, notes, receiptPath) {
  openModal('Edit Advance Payment', `<div class="auth-form">
    <div class="form-row">
      <div class="form-group no-icon"><label class="form-label">Amount (₹)</label>
        <input type="number" id="edit-adv-amount" value="${amount}"></div>
      <div class="form-group no-icon"><label class="form-label">Date Paid</label>
        <input type="date" id="edit-adv-date" value="${paidDate}"></div>
    </div>
    <div class="form-group no-icon"><label class="form-label">Notes</label>
      <textarea id="edit-adv-notes" style="padding:12px;min-height:60px">${notes}</textarea></div>
    <div class="form-group no-icon"><label class="form-label">Receipt (Upload to replace)</label>
      <div class="upload-area" onclick="document.getElementById('edit-adv-receipt').click()">
        <span class="material-symbols-rounded">cloud_upload</span><p>Click to replace receipt</p>
        <div class="file-name" id="edit-adv-receipt-filename">${receiptPath ? 'Current receipt uploaded' : ''}</div>
      </div>
      <input type="file" id="edit-adv-receipt" accept=".jpg,.jpeg,.png,.pdf,.webp" style="display:none" onchange="document.getElementById('edit-adv-receipt-filename').textContent=this.files[0]?.name||''">
    </div>
  </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="submitEditAdvance('${id}')">Save Changes</button>`);
}

async function submitEditAdvance(id) {
  try {
    const formData = new FormData();
    formData.append('amount', document.getElementById('edit-adv-amount').value);
    formData.append('paid_date', document.getElementById('edit-adv-date').value);
    formData.append('notes', document.getElementById('edit-adv-notes').value);

    const receipt = document.getElementById('edit-adv-receipt').files[0];
    if (receipt) formData.append('receipt', receipt);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/advances/${id}`, { method: 'PUT', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Advance updated!', 'success');
    closeModal();
    renderAdvances();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteAdvance(id) {
  if (!confirm('Delete this advance payment record?')) return;
  try {
    await api(`/advances/${id}`, { method: 'DELETE' });
    toast('Advance deleted', 'success');
    renderAdvances();
  } catch (err) { toast(err.message, 'error'); }
}

// ========================================
// Admin Dashboard Pages & Logic
// ========================================
async function renderAdminUsers() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  actions.innerHTML = '';

  try {
    adminUsersList = await api('/admin/users');
    area.innerHTML = `
      <div class="page-enter">
        <div class="filters-bar">
          <div class="form-group no-icon" style="flex: 2; margin-bottom: 0;">
            <input type="text" class="filter-input" id="admin-search-user" oninput="applyAdminUserFilters()" placeholder="Search users by name, phone, or email..." style="width: 100%;">
          </div>
          <select class="filter-select" id="admin-filter-role" onchange="applyAdminUserFilters()">
            <option value="">All Roles</option>
            <option value="landlord">Landlord</option>
            <option value="tenant">Tenant</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div class="card" id="admin-users-table-card">
          ${renderAdminUsersTable(adminUsersList)}
        </div>
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderAdminUsersTable(users) {
  if (!users || users.length === 0) {
    return '<div class="empty-state"><span class="material-symbols-rounded">group</span><h3>No users found</h3></div>';
  }

  return `
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Role</th>
            <th>Registered Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="user-avatar" style="background:${u.avatar_color || '#6366f1'};width:36px;height:36px;font-size:0.9rem;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${initials}</div>
                    <span style="font-weight:600">${u.name}</span>
                  </div>
                </td>
                <td>${u.phone}</td>
                <td>${u.email || '—'}</td>
                <td>
                  <span class="status-badge ${u.role}">
                    ${u.role.toUpperCase()}
                  </span>
                </td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-sm" onclick="showAdminEditUserModal('${u.id}', '${esc(u.name)}', '${esc(u.email)}', '${esc(u.phone || '')}', '${u.role}')" title="Edit Info">
                      <span class="material-symbols-rounded" style="font-size:16px">edit</span>Edit
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="showAdminResetPasswordModal('${u.id}', '${esc(u.name)}')" title="Reset Password">
                      <span class="material-symbols-rounded" style="font-size:16px">lock_reset</span>Reset
                    </button>
                    ${u.id !== currentUser.id ? `
                      <button class="btn btn-danger btn-sm" onclick="deleteAdminUser('${u.id}', '${esc(u.name)}')" title="Delete User">
                        <span class="material-symbols-rounded" style="font-size:16px">delete</span>Delete
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function applyAdminUserFilters() {
  const query = document.getElementById('admin-search-user').value.toLowerCase().trim();
  const role = document.getElementById('admin-filter-role').value;

  const filtered = adminUsersList.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(query) || (u.phone && u.phone.includes(query)) || (u.email && u.email.toLowerCase().includes(query));
    const matchesRole = !role || u.role === role;
    return matchesSearch && matchesRole;
  });

  document.getElementById('admin-users-table-card').innerHTML = renderAdminUsersTable(filtered);
}

function showAdminEditUserModal(userId, name, email, phone, role) {
  openModal(`Edit User — ${name}`, `
    <div class="auth-form" style="margin-top: 15px;">
      <div class="form-group">
        <span class="material-symbols-rounded input-icon">person</span>
        <input type="text" id="admin-edit-name" placeholder="Full name" value="${name}" required>
      </div>
      <div class="form-group">
        <span class="material-symbols-rounded input-icon">phone</span>
        <input type="tel" id="admin-edit-phone" placeholder="Phone number" value="${phone}" required>
      </div>
      <div class="form-group">
        <span class="material-symbols-rounded input-icon">email</span>
        <input type="email" id="admin-edit-email" placeholder="Email address (optional)" value="${email}">
      </div>
      <div class="form-group no-icon">
        <label class="form-label">Role</label>
        <select id="admin-edit-role">
          <option value="landlord" ${role === 'landlord' ? 'selected' : ''}>Landlord</option>
          <option value="tenant" ${role === 'tenant' ? 'selected' : ''}>Tenant</option>
          <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </div>
      <div id="admin-edit-error" class="auth-error hidden" style="margin-top: 10px;"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitAdminEditUser('${userId}')">Save Changes</button>
  `);
}

async function submitAdminEditUser(userId) {
  const name = document.getElementById('admin-edit-name').value;
  const email = document.getElementById('admin-edit-email').value;
  const phone = document.getElementById('admin-edit-phone').value;
  const role = document.getElementById('admin-edit-role').value;
  const errorEl = document.getElementById('admin-edit-error');

  if (!name || !phone || !role) {
    errorEl.textContent = 'Name, phone number, and role are required';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');

  try {
    await api(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email, phone, role })
    });
    toast('User updated successfully!', 'success');
    closeModal();
    renderAdminUsers();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

async function deleteAdminUser(userId, userName) {
  if (!confirm(`Are you sure you want to delete user "${userName}"? This will delete all their properties, leases, agreements, and advance payments. This action CANNOT be undone.`)) {
    return;
  }

  try {
    await api(`/admin/users/${userId}`, { method: 'DELETE' });
    toast(`User "${userName}" deleted successfully`, 'success');
    renderAdminUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function showAdminResetPasswordModal(userId, userName) {
  openModal(`Reset Password — ${userName}`, `
    <div class="auth-form" style="margin-top: 15px;">
      <div class="form-group">
        <span class="material-symbols-rounded input-icon">lock</span>
        <input type="password" id="admin-new-password" placeholder="Enter new password (min 6 chars)" required minlength="6">
      </div>
      <div class="form-group">
        <span class="material-symbols-rounded input-icon">lock</span>
        <input type="password" id="admin-confirm-password" placeholder="Confirm new password" required minlength="6">
      </div>
      <div id="reset-password-error" class="auth-error hidden" style="margin-top: 10px;"></div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitAdminResetPassword('${userId}')">Reset Password</button>
  `);
}

async function submitAdminResetPassword(userId) {
  const newPassword = document.getElementById('admin-new-password').value;
  const confirmPassword = document.getElementById('admin-confirm-password').value;
  const errorEl = document.getElementById('reset-password-error');

  if (!newPassword || newPassword.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters long';
    errorEl.classList.remove('hidden');
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'Passwords do not match';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');

  try {
    await api(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
    toast('Password reset successfully!', 'success');
    closeModal();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

// ========================================
// Shared Bills Pages & Logic
// ========================================
let sharedBillsList = [];

async function renderBills() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  const isLandlord = currentUser.role === 'landlord';

  if (isLandlord) {
    actions.innerHTML = `<button class="btn btn-primary btn-sm" onclick="showAddBillModal()">
      <span class="material-symbols-rounded">upload_file</span>Upload Bill</button>`;
  }

  try {
    const properties = isLandlord ? await api('/properties') : [];
    const data = await api('/bills');
    sharedBillsList = data.bills || [];
    const totalPending = data.total_pending || 0;

    const filterBar = `
      <div class="filters-bar">
        ${isLandlord ? `
          <select class="filter-select" id="bill-filter-prop" onchange="applyBillFilters()">
            <option value="">All Properties</option>
            ${properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        ` : ''}
        <select class="filter-select" id="bill-filter-status" onchange="applyBillFilters()">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
      </div>
    `;

    area.innerHTML = `
      <div class="page-enter">
        ${filterBar}
        <div class="advance-summary-card" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); margin-bottom: 20px;">
          <div class="advance-summary-icon" style="background: rgba(255, 255, 255, 0.12); color: #fff;">
            <span class="material-symbols-rounded">receipt_long</span>
          </div>
          <div class="advance-summary-content">
            <div class="advance-summary-label">${isLandlord ? 'Total Pending Tenant Shares' : 'My Outstanding Share (50%)'}</div>
            <div class="advance-summary-value" style="color: #fff;">${formatCurrency(totalPending)}</div>
          </div>
          <div class="advance-summary-count" style="background: rgba(255, 255, 255, 0.15); color: #fff;">
            <span>${sharedBillsList.filter(b => b.status === 'pending').length}</span>
            <span class="advance-summary-count-label">Unpaid</span>
          </div>
        </div>
        <div class="card" id="bills-table-card">
          ${renderBillsTable(sharedBillsList)}
        </div>
      </div>
    `;
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded">error</span><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function renderBillsTable(bills) {
  if (!bills || bills.length === 0) {
    return '<div class="empty-state"><span class="material-symbols-rounded">receipt</span><h3>No bills found</h3><p>Uploaded bills split 50/50 will appear here.</p></div>';
  }

  const isLandlord = currentUser.role === 'landlord';

  return `
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Bill Name</th>
            <th>Property</th>
            <th>Tenant</th>
            <th>Total Amount</th>
            <th>Tenant Share (50%)</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${bills.map(b => {
            const fileUrl = b.file_path ? `${SERVER_URL}${b.file_path}` : null;
            const statusClass = b.status === 'paid' ? 'paid' : 'overdue';
            return `
              <tr>
                <td style="font-weight: 600">${b.bill_name}</td>
                <td>${b.property_name}</td>
                <td>${b.tenant_name}</td>
                <td>${formatCurrency(b.total_amount)}</td>
                <td style="font-weight: 700; color: var(--accent-light)">${formatCurrency(b.tenant_share)}</td>
                <td>${formatDate(b.due_date)}</td>
                <td><span class="status-badge ${statusClass}">${b.status.toUpperCase()}</span></td>
                <td>
                  <div style="display:flex;gap:6px">
                    ${fileUrl ? `<a href="${fileUrl}" target="_blank" class="btn btn-secondary btn-sm" title="View Document"><span class="material-symbols-rounded" style="font-size:16px">visibility</span>View</a>` : ''}
                    ${isLandlord ? `
                      ${b.status !== 'paid' ? `<button class="btn btn-secondary btn-sm" onclick="markBillPaid('${b.id}')"><span class="material-symbols-rounded" style="font-size:16px">check_circle</span>Mark Paid</button>` : ''}
                      <button class="property-action-btn" onclick="showEditBillModal('${b.id}', '${esc(b.bill_name)}', ${b.total_amount}, '${b.due_date}', '${b.status}')"><span class="material-symbols-rounded">edit</span></button>
                      <button class="property-action-btn" onclick="deleteBill('${b.id}')"><span class="material-symbols-rounded">delete</span></button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function applyBillFilters() {
  const propSelect = document.getElementById('bill-filter-prop');
  const statusSelect = document.getElementById('bill-filter-status');
  
  const params = new URLSearchParams();
  if (propSelect && propSelect.value) params.set('property_id', propSelect.value);
  if (statusSelect && statusSelect.value) params.set('status', statusSelect.value);

  try {
    const data = await api(`/bills?${params}`);
    sharedBillsList = data.bills || [];
    const totalPending = data.total_pending || 0;

    const summaryValue = document.querySelector('.advance-summary-value');
    const summaryCount = document.querySelector('.advance-summary-count span:first-child');
    if (summaryValue) summaryValue.textContent = formatCurrency(totalPending);
    if (summaryCount) summaryCount.textContent = sharedBillsList.filter(b => b.status === 'pending').length;

    document.getElementById('bills-table-card').innerHTML = renderBillsTable(sharedBillsList);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function showAddBillModal() {
  let propsHtml = '', tenantsHtml = '';
  try {
    const props = await api('/properties');
    propsHtml = props.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const tenants = await api('/tenants');
    tenantsHtml = tenants.map(t => `<option value="${t.id}" data-prop="${t.property_id}">${t.name} (${t.property_name})</option>`).join('');
  } catch { }

  const today = new Date().toISOString().split('T')[0];

  openModal('Upload Shared Bill (50/50 Split)', `
    <div class="auth-form">
      <div class="form-row">
        <div class="form-group no-icon"><label class="form-label">Property</label>
          <select id="bill-prop" onchange="filterBillTenants()">${propsHtml}</select></div>
        <div class="form-group no-icon"><label class="form-label">Tenant</label>
          <select id="bill-tenant">${tenantsHtml}</select></div>
      </div>
      <div class="form-group"><span class="material-symbols-rounded input-icon">receipt</span>
        <input type="text" id="bill-name" placeholder="Bill Name (e.g., Water Bill - June)" required></div>
      <div class="form-row">
        <div class="form-group no-icon"><label class="form-label">Total Amount (₹)</label>
          <input type="number" id="bill-amount" placeholder="1000" oninput="updateSplitPreview()" required></div>
        <div class="form-group no-icon"><label class="form-label">Due Date</label>
          <input type="date" id="bill-due" value="${today}" required></div>
      </div>
      <div style="background:rgba(99,102,241,0.08); border:1px dashed rgba(99,102,241,0.3); border-radius:10px; padding:12px; margin-bottom:15px; text-align:center;">
        <span style="font-size:0.85rem; color:var(--text-secondary)">Automatic Split Calculator:</span>
        <div style="font-size:1.15rem; font-weight:700; color:var(--accent-light); margin-top:4px;">
          Tenant Share (50%): <span id="bill-split-preview">₹0</span>
        </div>
      </div>
      <div class="form-group no-icon"><label class="form-label">Bill File Attachment</label>
        <div class="upload-area" onclick="document.getElementById('bill-file-input').click()">
          <span class="material-symbols-rounded">cloud_upload</span>
          <p>Click to upload bill image/PDF</p>
          <div class="file-name" id="bill-file-name-preview"></div>
        </div>
        <input type="file" id="bill-file-input" accept=".jpg,.jpeg,.png,.pdf,.webp" style="display:none" onchange="document.getElementById('bill-file-name-preview').textContent=this.files[0]?.name||''">
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitBill()">Upload & Split</button>
  `);
  filterBillTenants();
}

function filterBillTenants() {
  const propId = document.getElementById('bill-prop').value;
  const tenantSelect = document.getElementById('bill-tenant');
  Array.from(tenantSelect.options).forEach(opt => {
    if (opt.dataset.prop) {
      opt.style.display = opt.dataset.prop === propId ? '' : 'none';
    }
  });
  const firstVisible = Array.from(tenantSelect.options).find(o => o.style.display !== 'none');
  if (firstVisible) tenantSelect.value = firstVisible.value;
}

function updateSplitPreview() {
  const amtInput = document.getElementById('bill-amount');
  const preview = document.getElementById('bill-split-preview');
  if (amtInput && preview) {
    const val = parseFloat(amtInput.value) || 0;
    preview.textContent = formatCurrency(val / 2);
  }
}

async function submitBill() {
  try {
    const file = document.getElementById('bill-file-input').files[0];
    const formData = new FormData();
    formData.append('property_id', document.getElementById('bill-prop').value);
    formData.append('tenant_id', document.getElementById('bill-tenant').value);
    formData.append('bill_name', document.getElementById('bill-name').value);
    formData.append('total_amount', document.getElementById('bill-amount').value);
    formData.append('due_date', document.getElementById('bill-due').value);
    if (file) formData.append('bill', file);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/bills`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Bill split and recorded!', 'success');
    closeModal();
    renderBills();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function showEditBillModal(id, name, totalAmount, dueDate, status) {
  openModal('Edit Shared Bill', `
    <div class="auth-form">
      <div class="form-group"><span class="material-symbols-rounded input-icon">receipt</span>
        <input type="text" id="edit-bill-name" placeholder="Bill Name" value="${name}" required></div>
      <div class="form-row">
        <div class="form-group no-icon"><label class="form-label">Total Amount (₹)</label>
          <input type="number" id="edit-bill-amount" placeholder="Total" value="${totalAmount}" oninput="updateEditSplitPreview()" required></div>
        <div class="form-group no-icon"><label class="form-label">Due Date</label>
          <input type="date" id="edit-bill-due" value="${dueDate}" required></div>
      </div>
      <div style="background:rgba(99,102,241,0.08); border:1px dashed rgba(99,102,241,0.3); border-radius:10px; padding:12px; margin-bottom:15px; text-align:center;">
        <span style="font-size:0.85rem; color:var(--text-secondary)">Automatic Split Calculator:</span>
        <div style="font-size:1.15rem; font-weight:700; color:var(--accent-light); margin-top:4px;">
          Tenant Share (50%): <span id="edit-bill-split-preview">${formatCurrency(totalAmount / 2)}</span>
        </div>
      </div>
      <div class="form-group no-icon"><label class="form-label">Status</label>
        <select id="edit-bill-status">
          <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending (Unpaid)</option>
          <option value="paid" ${status === 'paid' ? 'selected' : ''}>Paid</option>
        </select>
      </div>
    </div>
  `, `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitEditBill('${id}')">Save Changes</button>
  `);
}

function updateEditSplitPreview() {
  const amtInput = document.getElementById('edit-bill-amount');
  const preview = document.getElementById('edit-bill-split-preview');
  if (amtInput && preview) {
    const val = parseFloat(amtInput.value) || 0;
    preview.textContent = formatCurrency(val / 2);
  }
}

async function submitEditBill(id) {
  try {
    const body = {
      bill_name: document.getElementById('edit-bill-name').value,
      total_amount: document.getElementById('edit-bill-amount').value,
      due_date: document.getElementById('edit-bill-due').value,
      status: document.getElementById('edit-bill-status').value
    };

    await api(`/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });

    toast('Bill updated successfully!', 'success');
    closeModal();
    renderBills();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function markBillPaid(id) {
  try {
    await api(`/bills/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'paid' })
    });
    toast('Bill marked as paid!', 'success');
    renderBills();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteBill(id) {
  if (!confirm('Delete this shared bill? This cannot be undone.')) return;
  try {
    await api(`/bills/${id}`, { method: 'DELETE' });
    toast('Bill deleted successfully', 'success');
    renderBills();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========================================
// Rent Receipt Generator
// ========================================
function numberToWords(num) {
  if (num === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function convertChunk(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + convertChunk(n % 100) : '');
  }

  // Indian numbering: crore, lakh, thousand, hundred
  let result = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;

  if (crore) result += convertChunk(crore) + ' crore ';
  if (lakh) result += convertChunk(lakh) + ' lakh ';
  if (thousand) result += convertChunk(thousand) + ' thousand ';
  if (num) result += convertChunk(num);

  return result.trim();
}

async function renderRentReceipts() {
  const area = document.getElementById('content-area');
  const isLandlord = currentUser.role === 'landlord';

  let propsHtml = '<option value="">— Select Property —</option>';
  let tenantsData = [];

  try {
    if (isLandlord) {
      const props = await api('/properties');
      propsHtml += props.map(p => `<option value="${p.id}" data-name="${esc(p.name)}" data-address="${esc(p.address || '')}" data-rent="${p.rent_amount}">${p.name}</option>`).join('');
      tenantsData = await api('/tenants');
    }
  } catch { }

  area.innerHTML = `<div class="page-enter">
    <div class="receipt-form-header">
      <div class="receipt-form-header-icon">
        <span class="material-symbols-rounded">receipt_long</span>
      </div>
      <div>
        <h2 style="margin:0;font-size:1.4rem;font-weight:700;color:var(--text-primary)">Create Rent Receipts</h2>
        <p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.92rem">
          Looking for rent receipts for tax saving? Fill the form below, generate & download the PDF. Easy 😊
        </p>
      </div>
    </div>

    <div class="card receipt-generator-form">
      ${isLandlord ? `<div class="receipt-form-section">
        <div class="receipt-form-section-title">
          <span class="material-symbols-rounded">auto_awesome</span> Auto-fill from your data
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Select Property</label>
            <select id="rr-autofill-prop" onchange="autoFillReceiptFromProperty()">${propsHtml}</select>
          </div>
          <div class="form-group no-icon">
            <label class="form-label">Select Tenant</label>
            <select id="rr-autofill-tenant" onchange="autoFillReceiptFromTenant()">
              <option value="">— Select Tenant —</option>
              ${tenantsData.map(t => `<option value="${t.id}" data-name="${esc(t.name)}" data-phone="${esc(t.phone || '')}" data-prop="${t.property_id}">${t.name} (${t.property_name})</option>`).join('')}
            </select>
          </div>
        </div>
      </div>` : ''}

      <div class="receipt-form-section">
        <div class="receipt-form-section-title">
          <span class="material-symbols-rounded">person</span> Tenant Details
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Tenant Name *</label>
            <input type="text" id="rr-tenant-name" placeholder="Tenant's Name" required>
          </div>
          <div class="form-group no-icon">
            <label class="form-label">Tenant Phone</label>
            <input type="tel" id="rr-tenant-phone" placeholder="+91 Tenant's Phone">
          </div>
        </div>
      </div>

      <div class="receipt-form-section">
        <div class="receipt-form-section-title">
          <span class="material-symbols-rounded">domain</span> Owner Details
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Owner Name *</label>
            <input type="text" id="rr-owner-name" placeholder="Owner's Name" value="${esc(currentUser.name)}" required>
          </div>
          <div class="form-group no-icon">
            <label class="form-label">Owner Phone</label>
            <input type="tel" id="rr-owner-phone" placeholder="+91 Owner's Phone" value="${esc(currentUser.phone || '')}">
          </div>
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Owner PAN</label>
            <input type="text" id="rr-owner-pan" placeholder="Owner's PAN (e.g. ABCDE1234F)" maxlength="10" style="text-transform:uppercase">
          </div>
          <div class="form-group no-icon">
            <label class="form-label">Owner Address</label>
            <textarea id="rr-owner-address" placeholder="Current address of the owner" rows="2"></textarea>
          </div>
        </div>
      </div>

      <div class="receipt-form-section">
        <div class="receipt-form-section-title">
          <span class="material-symbols-rounded">home</span> Property & Rent
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Monthly Rent (₹) *</label>
            <input type="number" id="rr-rent" placeholder="Monthly Rent in Rs." required oninput="checkPanWarning()">
          </div>
          <div class="form-group no-icon">
            <label class="form-label">Rented Property Address *</label>
            <textarea id="rr-property-address" placeholder="Address of property as required in rent receipts" rows="2" required></textarea>
          </div>
        </div>
        <div id="rr-pan-warning" class="receipt-pan-warning" style="display:none">
          <span class="material-symbols-rounded">warning</span>
          <span>Annual rent exceeds ₹1,00,000. Owner PAN is mandatory for tenant's HRA exemption claim.</span>
        </div>
      </div>

      <div class="receipt-form-section">
        <div class="receipt-form-section-title">
          <span class="material-symbols-rounded">payments</span> Payment Details
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Mode of Payment *</label>
            <select id="rr-payment-mode" onchange="toggleTxnRef()">
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="NEFT">NEFT / Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div class="form-group no-icon" id="rr-txn-ref-group">
            <label class="form-label">Transaction Ref</label>
            <input type="text" id="rr-txn-ref" placeholder="Cheque No. / UTR / UPI Txn ID">
          </div>
        </div>
      </div>

      <div class="receipt-form-section">
        <div class="receipt-form-section-title">
          <span class="material-symbols-rounded">date_range</span> Receipt Period
        </div>
        <div class="receipt-form-row">
          <div class="form-group no-icon">
            <label class="form-label">Receipt Start Date *</label>
            <input type="date" id="rr-start-date" required>
          </div>
          <div class="form-group no-icon">
            <label class="form-label">Receipt End Date *</label>
            <input type="date" id="rr-end-date" required>
          </div>
        </div>
      </div>

      <div style="padding:0 24px 28px;text-align:center">
        <button class="btn receipt-generate-btn" onclick="generateReceiptPDF()">
          <span class="material-symbols-rounded">picture_as_pdf</span>
          Generate Rent Receipt Now
        </button>
      </div>
    </div>
  </div>`;

  // Initialize: hide txn ref for Cash (default)
  toggleTxnRef();
}

function autoFillReceiptFromProperty() {
  const sel = document.getElementById('rr-autofill-prop');
  const opt = sel.selectedOptions[0];
  if (!opt || !opt.value) return;

  const address = opt.dataset.address || '';
  const rent = opt.dataset.rent || '';

  document.getElementById('rr-property-address').value = address;
  document.getElementById('rr-rent').value = rent;
  checkPanWarning();

  // Filter tenants dropdown to show only tenants of this property
  const tenantSel = document.getElementById('rr-autofill-tenant');
  if (tenantSel) {
    const propId = opt.value;
    Array.from(tenantSel.options).forEach(o => {
      if (!o.value) return; // skip placeholder
      o.style.display = o.dataset.prop === propId ? '' : 'none';
    });
    tenantSel.value = '';
  }
}

function autoFillReceiptFromTenant() {
  const sel = document.getElementById('rr-autofill-tenant');
  const opt = sel.selectedOptions[0];
  if (!opt || !opt.value) return;

  document.getElementById('rr-tenant-name').value = opt.dataset.name || '';
  document.getElementById('rr-tenant-phone').value = opt.dataset.phone || '';
}

function checkPanWarning() {
  const rent = parseFloat(document.getElementById('rr-rent').value) || 0;
  const warning = document.getElementById('rr-pan-warning');
  if (warning) {
    warning.style.display = (rent * 12 > 100000) ? 'flex' : 'none';
  }
}

function toggleTxnRef() {
  const mode = document.getElementById('rr-payment-mode').value;
  const group = document.getElementById('rr-txn-ref-group');
  if (group) {
    group.style.display = mode === 'Cash' ? 'none' : '';
  }
}

function generateReceiptPDF() {
  // Validate required fields
  const tenantName = document.getElementById('rr-tenant-name').value.trim();
  const ownerName = document.getElementById('rr-owner-name').value.trim();
  const rent = parseFloat(document.getElementById('rr-rent').value);
  const propertyAddress = document.getElementById('rr-property-address').value.trim();
  const ownerAddress = document.getElementById('rr-owner-address').value.trim();
  const ownerPAN = document.getElementById('rr-owner-pan').value.trim().toUpperCase();
  const paymentMode = document.getElementById('rr-payment-mode').value;
  const txnRef = document.getElementById('rr-txn-ref').value.trim();
  const startDate = document.getElementById('rr-start-date').value;
  const endDate = document.getElementById('rr-end-date').value;

  if (!tenantName) { toast('Please enter tenant name', 'error'); return; }
  if (!ownerName) { toast('Please enter owner name', 'error'); return; }
  if (!rent || rent <= 0) { toast('Please enter a valid rent amount', 'error'); return; }
  if (!propertyAddress) { toast('Please enter the rented property address', 'error'); return; }
  if (!startDate || !endDate) { toast('Please select both start and end dates', 'error'); return; }

  // PAN warning for annual rent > 1 lakh
  if (rent * 12 > 100000 && !ownerPAN) {
    if (!confirm('Annual rent exceeds ₹1,00,000 but Owner PAN is not provided. This is required for HRA exemption claims. Continue anyway?')) return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) { toast('End date must be after start date', 'error'); return; }

  // Calculate months
  const months = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (current <= endMonth) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }

  if (months.length === 0) { toast('No months in the selected range', 'error'); return; }
  if (months.length > 24) { toast('Maximum 24 months allowed at a time', 'warning'); return; }

  // Generate PDF using jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();   // 297
  const margin = 15;
  const receiptH = 132;  // height of each receipt box (slightly taller for new fields)
  const contentW = pageW - margin * 2;

  const rentWords = numberToWords(Math.floor(rent));
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const showRevenueStamp = paymentMode === 'Cash' && rent > 5000;

  months.forEach((month, idx) => {
    // Two receipts per page: position 0 (top) or 1 (bottom)
    const posOnPage = idx % 2;
    if (idx > 0 && posOnPage === 0) {
      doc.addPage();
    }

    const yStart = posOnPage === 0 ? margin : margin + receiptH + 10;
    const receiptNo = String(idx + 1).padStart(3, '0');

    // Draw border rectangle
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.5);
    doc.rect(margin, yStart, contentW, receiptH);

    let y = yStart + 14;

    // Title: "HOUSE RENT RECEIPT" — bold, centered
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('HOUSE RENT RECEIPT', pageW / 2, y, { align: 'center' });
    y += 10;

    // Receipt No + Date on same line
    const monthYear = `${monthNames[month.getMonth()]} ${month.getFullYear()}`;
    const dayStr = `01 ${monthYear}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Receipt No: ${receiptNo}`, margin + 8, y);
    doc.text(`Dated: ${dayStr}`, margin + contentW - 8, y, { align: 'right' });
    y += 10;

    // Main paragraph
    const bodyText = `This is to acknowledge the receipt from ${tenantName} the sum of Rupees ${Math.floor(rent)}/- (Rupees ${rentWords} only) in lieu of rent payment for the month of ${monthYear}, towards the property bearing the address "${propertyAddress}".`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(bodyText, contentW - 16);
    doc.text(lines, margin + 8, y);
    y += lines.length * 4.5 + 6;

    // Rent Period, Mode of Payment, Transaction Ref
    const labelX = margin + 8;
    const valueX = margin + 50;
    doc.setFontSize(9.5);

    doc.setFont('helvetica', 'normal');
    doc.text('Rent Period:', labelX, y);
    doc.setFont('helvetica', 'bold');
    doc.text(monthYear, valueX, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.text('Mode of Payment:', labelX, y);
    doc.setFont('helvetica', 'bold');
    doc.text(paymentMode, valueX, y);
    y += 5;

    if (txnRef && paymentMode !== 'Cash') {
      doc.setFont('helvetica', 'normal');
      doc.text('Transaction Ref:', labelX, y);
      doc.setFont('helvetica', 'bold');
      doc.text(txnRef, valueX, y);
      y += 5;
    }

    y += 4;

    // Owner's Name and Address
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text("Owner's Name and Address", margin + 8, y);
    // Underline
    const textW = doc.getTextWidth("Owner's Name and Address");
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.3);
    doc.line(margin + 8, y + 1, margin + 8 + textW, y + 1);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(ownerName, margin + 8, y);
    y += 5;

    if (ownerPAN) {
      doc.text(`PAN: ${ownerPAN}`, margin + 8, y);
      y += 5;
    }

    if (ownerAddress) {
      const addrLines = doc.splitTextToSize(ownerAddress, contentW / 2);
      doc.text(addrLines, margin + 8, y);
    }

    // Revenue Stamp — centered, conditional
    if (showRevenueStamp) {
      const stampY = yStart + receiptH - 32;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.rect(pageW / 2 - 14, stampY - 6, 28, 14, 'S');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.text('Revenue', pageW / 2, stampY, { align: 'center' });
      doc.text('Stamp', pageW / 2, stampY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('(affix if paid by cash & amount > \u20B95,000)', pageW / 2, stampY + 10, { align: 'center' });
    }

    // Signature — right aligned at bottom
    const sigY = yStart + receiptH - 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Signature', margin + contentW - 8, sigY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`(${ownerName})`, margin + contentW - 8, sigY + 6, { align: 'right' });
  });

  // Generate filename
  const startMonthStr = monthNames[months[0].getMonth()].slice(0, 3) + months[0].getFullYear();
  const endMonthStr = monthNames[months[months.length - 1].getMonth()].slice(0, 3) + months[months.length - 1].getFullYear();
  const fileName = months.length === 1
    ? `Rent_Receipt_${startMonthStr}.pdf`
    : `Rent_Receipts_${startMonthStr}_to_${endMonthStr}.pdf`;

  doc.save(fileName);
  toast(`✅ ${months.length} rent receipt(s) generated!`, 'success');
}

// ========================================
// Transaction Automations Pages & Logic
// ========================================
async function renderAutomations() {
  const area = document.getElementById('content-area');
  const actions = document.getElementById('top-bar-actions');
  const isLandlord = currentUser.role === 'landlord';

  if (!isLandlord) {
    area.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded">block</span>
        <h3>Access Denied</h3>
        <p>Only landlords/owners can manage transaction automations.</p>
      </div>
    `;
    return;
  }

  actions.innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="showAddAutomationModal()">
      <span class="material-symbols-rounded">add_circle</span>Create Automation
    </button>
  `;

  try {
    const automations = await api('/automations');

    if (!automations || automations.length === 0) {
      area.innerHTML = `
        <div class="page-enter">
          <div class="empty-state">
            <span class="material-symbols-rounded">schedule</span>
            <h3>No automations scheduled</h3>
            <p>Automatically schedule and generate monthly pending rent transactions for your tenants.</p>
            <button class="btn btn-primary" onclick="showAddAutomationModal()">
              <span class="material-symbols-rounded">add_circle</span>Create Your First Automation
            </button>
          </div>
        </div>
      `;
      return;
    }

    area.innerHTML = `
      <div class="page-enter">
        <div class="card">
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Tenant</th>
                  <th>Monthly Amount</th>
                  <th>Start Month</th>
                  <th>Duration</th>
                  <th>Day of Month</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${automations.map(aut => {
                  const statusClass = aut.is_active === 1 ? 'paid' : 'overdue';
                  const statusLabel = aut.is_active === 1 ? 'ACTIVE' : 'PAUSED';
                  return `
                    <tr>
                      <td style="font-weight: 600">${aut.property_name}</td>
                      <td>${aut.tenant_name}</td>
                      <td>${formatCurrency(aut.amount)}</td>
                      <td>${formatDate(aut.start_date)}</td>
                      <td>${aut.num_months} months</td>
                      <td>Day ${aut.due_day}</td>
                      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                      <td>
                        <div style="display:flex;gap:6px">
                          <button class="btn btn-secondary btn-sm" onclick="toggleAutomation('${aut.id}', ${aut.is_active})" title="${aut.is_active === 1 ? 'Pause' : 'Resume'}">
                            <span class="material-symbols-rounded" style="font-size:18px">${aut.is_active === 1 ? 'pause_circle' : 'play_circle'}</span>
                          </button>
                          <button class="btn btn-secondary btn-sm" onclick="deleteAutomation('${aut.id}')" title="Delete" style="color:var(--red)">
                            <span class="material-symbols-rounded" style="font-size:18px">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    area.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded">error</span>
        <h3>Error loading automations</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

async function showAddAutomationModal() {
  let props = [];
  let tenants = [];
  try {
    props = await api('/properties');
    tenants = await api('/tenants');
  } catch (err) {
    toast(err.message, 'error');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const propsHtml = props.map(p => `<option value="${p.id}" data-rent="${p.rent_amount}" data-due="${p.due_day}">${p.name}</option>`).join('');
  
  const bodyHTML = `
    <div class="auth-form">
      <div class="form-row">
        <div class="form-group no-icon">
          <label class="form-label">Property</label>
          <select id="auto-property" onchange="onAutoPropertyChange()">${propsHtml}</select>
        </div>
        <div class="form-group no-icon">
          <label class="form-label">Tenant</label>
          <select id="auto-tenant"></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group no-icon">
          <label class="form-label">Monthly Amount (₹)</label>
          <input type="number" id="auto-amount" placeholder="15000">
        </div>
        <div class="form-group no-icon">
          <label class="form-label">Start Date</label>
          <input type="date" id="auto-start" value="${today}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group no-icon">
          <label class="form-label">Duration (Months)</label>
          <input type="number" id="auto-months" min="1" max="120" value="12">
        </div>
        <div class="form-group no-icon">
          <label class="form-label">Day of Month (1-31)</label>
          <input type="number" id="auto-day" min="1" max="31" value="5">
        </div>
      </div>
      <div class="form-group no-icon">
        <label class="form-label">Notes</label>
        <textarea id="auto-notes" style="padding:12px;min-height:60px" placeholder="e.g. Monthly rent or maintenance auto-charge..."></textarea>
      </div>
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitAutomation()">Save Automation</button>
  `;

  openModal('Add Transaction Automation', bodyHTML, footerHTML);

  window.allTenantsForAutomation = tenants;
  onAutoPropertyChange();
}

window.onAutoPropertyChange = function() {
  const propSelect = document.getElementById('auto-property');
  const tenantSelect = document.getElementById('auto-tenant');
  const amountInput = document.getElementById('auto-amount');
  const dayInput = document.getElementById('auto-day');

  if (!propSelect || !tenantSelect) return;

  const propId = propSelect.value;
  const tenants = window.allTenantsForAutomation || [];

  const filtered = tenants.filter(t => t.property_id === propId);
  tenantSelect.innerHTML = filtered.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  if (filtered.length === 0) {
    tenantSelect.innerHTML = `<option value="">— No active tenants —</option>`;
  }

  const selectedOpt = propSelect.selectedOptions[0];
  if (selectedOpt) {
    amountInput.value = selectedOpt.dataset.rent || '';
    dayInput.value = selectedOpt.dataset.due || '5';
  }
};

async function submitAutomation() {
  try {
    const property_id = document.getElementById('auto-property').value;
    const tenant_id = document.getElementById('auto-tenant').value;
    const amount = document.getElementById('auto-amount').value;
    const start_date = document.getElementById('auto-start').value;
    const num_months = document.getElementById('auto-months').value;
    const due_day = document.getElementById('auto-day').value;
    const notes = document.getElementById('auto-notes').value;

    if (!property_id || !tenant_id) {
      throw new Error('Please select both property and tenant');
    }
    if (!amount || parseFloat(amount) <= 0) {
      throw new Error('Please enter a valid monthly amount');
    }
    if (!start_date) {
      throw new Error('Please select a start date');
    }
    if (!num_months || parseInt(num_months) <= 0) {
      throw new Error('Please enter a valid duration (months)');
    }
    if (!due_day || parseInt(due_day) < 1 || parseInt(due_day) > 31) {
      throw new Error('Please enter a valid day of month (1 to 31)');
    }

    const body = {
      property_id,
      tenant_id,
      amount: parseFloat(amount),
      start_date,
      num_months: parseInt(num_months),
      due_day: parseInt(due_day),
      notes
    };

    const res = await api('/automations', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    toast(`Automation saved successfully! Generated ${res.generated} transaction(s).`, 'success');
    closeModal();
    renderAutomations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleAutomation(id, currentStatus) {
  try {
    const newStatus = currentStatus === 1 ? 0 : 1;
    await api(`/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: newStatus })
    });
    toast(`Automation ${newStatus === 1 ? 'resumed' : 'paused'}`, 'success');
    renderAutomations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteAutomation(id) {
  if (!confirm('Are you sure you want to delete this automation rule? This will stop future automatic transaction creation.')) return;
  try {
    await api(`/automations/${id}`, {
      method: 'DELETE'
    });
    toast('Automation rule deleted', 'success');
    renderAutomations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========================================
// App Initialization
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  if (token) { showApp(); }
});
