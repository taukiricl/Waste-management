const SUPABASE_URL = "https://kzvgwfjyartclvinroon.supabase.co";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6dmd3Zmp5YXJ0Y2x2aW5yb29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDU3MTYsImV4cCI6MjA5ODM4MTcxNn0.hiKp0InVXCaWXweH_6LKCxW6bn9IRojeDeAsxOCPVVA";

const STORAGE_KEY = 'waste-management-state-v1';
const supabase = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
const APP_STATE_TABLE = 'app_state';
const CUSTOMERS_TABLE = 'customers';

const DEFAULT_COMPANY = {
  name: 'Waste Management Recycling Pvt. Ltd',
  phone: '+977-9856023786',
  address: 'Pokhara, Nepal',
  qrImage: ''
};

const state = {
  currentUser: null,
  currentView: 'dashboard',
  customers: [],
  areas: ['Ward 10', 'Ward 14', 'Ward 15'],
  payments: [],
  feeRequests: [],
  notifications: [],
  theme: 'light',
  selectedCustomerId: null,
  currentPage: 1,
  pageSize: 6,
  company: { ...DEFAULT_COMPANY },
  closeRequests: [],
  users: []
};

const appShell = document.getElementById('app-shell');
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const navItems = document.querySelectorAll('.nav-item');
const viewMap = {
  dashboard: document.getElementById('view-dashboard'),
  customers: document.getElementById('view-customers'),
  registration: document.getElementById('view-registration'),
  billing: document.getElementById('view-billing'),
  payments: document.getElementById('view-payments'),
  areas: document.getElementById('view-areas'),
  reports: document.getElementById('view-reports'),
  'fee-requests': document.getElementById('view-fee-requests'),
  notifications: document.getElementById('view-notifications'),
  users: document.getElementById('view-users'),
  settings: document.getElementById('view-settings')
};

async function saveState() {
  try {
    const payload = JSON.parse(JSON.stringify(state));
    if (!supabase) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return;
    }
    const { error } = await supabase.from(APP_STATE_TABLE).upsert([{ id: 'main', payload }], { onConflict: 'id' });
    if (error) throw error;
  } catch (error) {
    console.error('Unable to save app state:', error);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (storageError) {
      console.error('Unable to save app state locally:', storageError);
    }
  }
}

async function loadState() {
  try {
    if (!supabase) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const payload = JSON.parse(stored);
        Object.assign(state, payload);
        state.company = { ...DEFAULT_COMPANY, ...(payload.company || {}) };
        state.customers = Array.isArray(payload.customers) ? payload.customers : [];
        state.payments = Array.isArray(payload.payments) ? payload.payments : [];
        state.feeRequests = Array.isArray(payload.feeRequests) ? payload.feeRequests : [];
        state.notifications = Array.isArray(payload.notifications) ? payload.notifications : [];
        state.closeRequests = Array.isArray(payload.closeRequests) ? payload.closeRequests : [];
        state.users = Array.isArray(payload.users) ? payload.users : [];
        state.areas = Array.isArray(payload.areas) && payload.areas.length ? payload.areas : ['Ward 10', 'Ward 14', 'Ward 15'];
        ensureUsers();
        applyBranding();
        return true;
      }
      return false;
    }

    const { data, error } = await supabase.from(APP_STATE_TABLE).select('payload').eq('id', 'main').maybeSingle();
    if (error) throw error;
    if (data?.payload) {
      Object.assign(state, data.payload);
      state.company = { ...DEFAULT_COMPANY, ...(data.payload.company || {}) };
      state.customers = Array.isArray(data.payload.customers) ? data.payload.customers : [];
      state.payments = Array.isArray(data.payload.payments) ? data.payload.payments : [];
      state.feeRequests = Array.isArray(data.payload.feeRequests) ? data.payload.feeRequests : [];
      state.notifications = Array.isArray(data.payload.notifications) ? data.payload.notifications : [];
      state.closeRequests = Array.isArray(data.payload.closeRequests) ? data.payload.closeRequests : [];
      state.users = Array.isArray(data.payload.users) ? data.payload.users : [];
      state.areas = Array.isArray(data.payload.areas) && data.payload.areas.length ? data.payload.areas : ['Ward 10', 'Ward 14', 'Ward 15'];
      ensureUsers();
      applyBranding();
      return true;
    }
  } catch (error) {
    console.error('Unable to load app state:', error);
  }
  return false;
}

async function fetchCustomersFromSupabase() {
  if (!supabase) return state.customers;
  try {
    const { data, error } = await supabase.from(CUSTOMERS_TABLE).select('id, payload, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    state.customers = Array.isArray(data) ? data.map(entry => ({ ...(entry.payload || {}), id: entry.id })) : [];
    return state.customers;
  } catch (error) {
    console.error('Unable to load customers from Supabase:', error);
    return state.customers;
  }
}

async function createCustomerInSupabase(customer) {
  if (!supabase) return null;
  try {
    const record = { id: customer.id, payload: { ...customer }, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from(CUSTOMERS_TABLE).insert([record]).select('id, payload').single();
    if (error) throw error;
    return data?.payload || null;
  } catch (error) {
    console.error('Unable to create customer in Supabase:', error);
    return null;
  }
}

async function updateCustomerInSupabase(customer) {
  if (!supabase) return null;
  try {
    const record = { id: customer.id, payload: { ...customer }, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from(CUSTOMERS_TABLE).upsert([record], { onConflict: 'id' }).select('id, payload').single();
    if (error) throw error;
    return data?.payload || null;
  } catch (error) {
    console.error('Unable to update customer in Supabase:', error);
    return null;
  }
}

async function deleteCustomerInSupabase(customerId) {
  if (!supabase) return true;
  try {
    const { error } = await supabase.from(CUSTOMERS_TABLE).delete().eq('id', customerId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Unable to delete customer in Supabase:', error);
    return false;
  }
}

function applyBranding() {
  const companyName = state.company?.name || DEFAULT_COMPANY.name;
  document.querySelectorAll('.brand-name').forEach(element => {
    element.textContent = companyName;
  });
}

function ensureUsers() {
  const defaults = [
    { id: 'admin-user', name: 'Administrator', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'staff-user', name: 'Staff User', username: 'staff', password: 'staff123', role: 'staff' }
  ];

  if (!Array.isArray(state.users) || state.users.length === 0) {
    state.users = defaults;
    return state.users;
  }

  const mergedUsers = defaults.map(user => ({ ...user }));
  state.users.forEach(user => {
    if (!user?.username) return;
    const existing = mergedUsers.find(existing => existing.username.toLowerCase() === user.username.toLowerCase());
    if (existing) {
      Object.assign(existing, { ...existing, ...user });
    } else {
      mergedUsers.push({ ...user });
    }
  });

  const adminUser = mergedUsers.find(user => user.username.toLowerCase() === 'admin');
  if (adminUser) {
    adminUser.name = 'Administrator';
    adminUser.password = 'admin123';
    adminUser.role = 'admin';
  }

  const staffUser = mergedUsers.find(user => user.username.toLowerCase() === 'staff');
  if (staffUser) {
    staffUser.name = 'Staff User';
    staffUser.password = 'staff123';
    staffUser.role = 'staff';
  }

  state.users = mergedUsers;
  return state.users;
}

function addMonthsToNepaliDate(dateValue, monthsToAdd) {
  const [yearText, monthText] = String(dateValue || '2083-01').split('-');
  let year = Number(yearText);
  let month = Number(monthText);
  const totalMonths = year * 12 + month - 1 + monthsToAdd;
  year = Math.floor(totalMonths / 12);
  month = (totalMonths % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function seedData() {
  const loaded = await loadState();
  if (loaded) {
    await fetchCustomersFromSupabase();
    return;
  }

  const initialCustomers = [
    { id: 'C-1001', name: 'Ramesh Thapa', father: 'Bhoj Thapa', phone: '9841000001', altPhone: '9800000001', address: 'Buddha Colony', area: 'Ward 10', houseNumber: 'A-12', monthlyFee: 250, familyMembers: 4, registrationDate: '2024-01-05', paymentStartsFrom: '2083-01', paidUpTo: '2083-03', remarks: 'Regular', status: 'green' },
    { id: 'C-1002', name: 'Sita Shrestha', father: 'Hari Shrestha', phone: '9841000002', altPhone: '9800000002', address: 'Gairigaun', area: 'Ward 14', houseNumber: 'B-04', monthlyFee: 300, familyMembers: 5, registrationDate: '2024-02-10', paymentStartsFrom: '2083-02', paidUpTo: '2082-12', remarks: 'Needs reminder', status: 'yellow' },
    { id: 'C-1003', name: 'Bikash Lama', father: 'Nir Lama', phone: '9841000003', altPhone: '9800000003', address: 'Mahadevsthan', area: 'Ward 15', houseNumber: 'C-09', monthlyFee: 350, familyMembers: 3, registrationDate: '2024-03-15', paymentStartsFrom: '2083-03', paidUpTo: '2082-09', remarks: 'High risk', status: 'red' }
  ];

  state.customers = initialCustomers;

  state.payments = [
    { billNumber: 'B-1001', customerId: 'C-1001', customerName: 'Ramesh Thapa', amount: 750, method: 'Cash', date: '2026-06-20', nepaliDate: '2083-03', months: 3, collectedBy: 'Admin' },
    { billNumber: 'B-1002', customerId: 'C-1002', customerName: 'Sita Shrestha', amount: 600, method: 'Online QR', date: '2026-06-18', nepaliDate: '2083-02', months: 2, collectedBy: 'Staff' }
  ];

  state.feeRequests = [
    { id: 1, customerId: 'C-1002', customerName: 'Sita Shrestha', oldFee: 300, requestedFee: 250, reason: 'Financial hardship', requestedBy: 'Staff', requestDate: '2026-06-24', status: 'Pending', approvedBy: '', approvalDate: '', rejectionReason: '' }
  ];

  state.notifications = [
    { id: 1, title: 'Fee request pending', message: 'Sita Shrestha requested a fee reduction', type: 'info' },
    { id: 2, title: 'Payment received', message: 'Ramesh Thapa paid three months in cash', type: 'success' }
  ];
  state.company = { ...DEFAULT_COMPANY };
  state.closeRequests = [];
  state.users = [];
  ensureUsers();
  for (const customer of initialCustomers) {
    await createCustomerInSupabase(customer);
  }
  await saveState();
  applyBranding();
}

function formatCurrency(value) {
  return `Rs. ${Number(value).toLocaleString('en-US')}`;
}

function showToast(message, type = 'info') {
  const stack = document.getElementById('toast-stack');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function showBillModal(bill) {
  const modalRoot = document.getElementById('modal-root');
  const customer = state.customers.find(item => item.id === bill.customerId);
  modalRoot.innerHTML = `
    <div class="modal-card">
      <div class="toolbar">
        <div>
          <h3 style="margin:0;">${state.company.name}</h3>
          <p style="margin:4px 0 0; color:var(--muted);">Payment Receipt</p>
        </div>
        <button class="btn btn-ghost" id="close-bill-modal">Close</button>
      </div>
      <div style="border:1px solid var(--line); border-radius:16px; padding:16px; margin-top:12px;">
        <p><strong>Bill Number:</strong> ${bill.billNumber}</p>
        <p><strong>Customer:</strong> ${bill.customerName}</p>
        <p><strong>Phone:</strong> ${customer?.phone || '—'}</p>
        <p><strong>Address:</strong> ${customer?.address || '—'}</p>
        <p><strong>Months Paid:</strong> ${bill.months}</p>
        <p><strong>Payment Method:</strong> ${bill.method}</p>
        <p><strong>Total Amount:</strong> ${formatCurrency(bill.amount)}</p>
        <p><strong>Received By:</strong> ${bill.receivedBy || bill.collectedBy || '—'}</p>
        <p><strong>Date:</strong> ${bill.date}</p>
      </div>
      <div class="search-row" style="margin-top:16px;">
        <button class="btn btn-primary" id="print-bill-from-modal">Print</button>
      </div>
    </div>
  `;

  modalRoot.classList.add('active');
  document.getElementById('close-bill-modal')?.addEventListener('click', () => {
    modalRoot.classList.remove('active');
    modalRoot.innerHTML = '';
  });
  document.getElementById('print-bill-from-modal')?.addEventListener('click', () => window.print());
}

function renderDashboard() {
  const content = document.getElementById('dashboard-content');
  const user = state.currentUser || { role: 'admin' };
  const isAdmin = user.role === 'admin';
  const stats = [
    { label: 'Total Customers', value: state.customers.length },
    { label: 'Active Customers', value: state.customers.filter(c => c.status !== 'red').length }
  ];

  if (isAdmin) {
    stats.push(
      { label: 'Today\'s Collection', value: formatCurrency(state.payments.reduce((sum, p) => sum + p.amount, 0) / 2) },
      { label: 'Current Month Collection', value: formatCurrency(state.payments.reduce((sum, p) => sum + p.amount, 0)) }
    );
  }
  const searchValue = document.getElementById('dashboard-search')?.value || '';
  const suggestions = state.customers.filter(customer => [customer.name, customer.phone, customer.area, customer.id].join(' ').toLowerCase().includes(searchValue.toLowerCase()));
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const staffSummary = state.users
    .filter(user => user.role === 'staff')
    .map(user => {
      const staffPayments = state.payments.filter(payment => {
        const collectedBy = (payment.receivedBy || payment.collectedBy || '').trim();
        return collectedBy.toLowerCase() === user.name.toLowerCase();
      });
      const todayPayments = staffPayments.filter(payment => payment.date === today);
      const monthPayments = staffPayments.filter(payment => (payment.date || '').slice(0, 7) === currentMonth);
      return {
        ...user,
        totalCollection: staffPayments.reduce((sum, payment) => sum + payment.amount, 0),
        todayCollection: todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
        todayBills: todayPayments.length,
        monthCollection: monthPayments.reduce((sum, payment) => sum + payment.amount, 0),
        monthBills: monthPayments.length
      };
    });

  content.innerHTML = `
    <div class="grid grid-4">
      ${stats.map(stat => `
        <div class="card">
          <div class="metric">
            <span class="value">${stat.value}</span>
            <span class="label">${stat.label}</span>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="grid grid-2" style="margin-top:18px;">
      <div class="card">
        <h3>Staff Status</h3>
        ${isAdmin ? `
          <ul style="padding-left:18px;">
            ${staffSummary.length ? staffSummary.map(staff => `
              <li style="margin-bottom:12px;">
                <button class="btn btn-ghost" type="button" data-staff-toggle="${staff.id}" style="padding:0;border:none;background:none;text-align:left;color:inherit;">
                  <strong>${staff.name}</strong>
                </button>
                <div style="margin-top:4px;color:var(--muted);">
                  Total collection: ${formatCurrency(staff.totalCollection)}<br/>
                  Today: ${formatCurrency(staff.todayCollection)} • ${staff.todayBills} bill${staff.todayBills === 1 ? '' : 's'}
                </div>
                <div id="staff-details-${staff.id}" hidden style="margin-top:6px;padding-left:12px;color:var(--muted);">
                  Monthly collection: ${formatCurrency(staff.monthCollection)}<br/>
                  Monthly bills: ${staff.monthBills}
                </div>
              </li>
            `).join('') : '<li>No staff accounts yet.</li>'}
          </ul>
        ` : '<p>Staff summary is available for admins.</p>'}
      </div>
      <div class="card">
        <h3>Notifications</h3>
        <ul>
          ${state.notifications.map(n => `<li>${n.title}</li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="grid grid-3" style="margin-top:18px;">
      <div class="card">
        <h3>Monthly Collection</h3>
        <div style="display:flex;align-items:flex-end;gap:8px;height:140px;margin-top:12px;">
          ${[80, 120, 100, 160, 140, 180].map(height => `<div style="flex:1;height:${height}px;background:linear-gradient(180deg,var(--primary),var(--accent));border-radius:10px 10px 0 0;"></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3>Customer Status</h3>
        <p>Green: ${state.customers.filter(c => c.status === 'green').length}</p>
        <p>Yellow: ${state.customers.filter(c => c.status === 'yellow').length}</p>
        <p>Red: ${state.customers.filter(c => c.status === 'red').length}</p>
      </div>
      <div class="card">
        <h3>Quick Search</h3>
        <input id="dashboard-search" placeholder="Search by name, phone, area" value="${searchValue}" />
        <div style="margin-top:10px;">
          ${suggestions.length ? suggestions.slice(0, 4).map(customer => `<button class="btn btn-secondary" style="display:block;width:100%;margin-bottom:8px;text-align:left;" data-search-customer="${customer.id}">${customer.name} • ${customer.area}</button>`).join('') : '<p style="color:var(--muted);margin:0;">No matches.</p>'}
        </div>
      </div>
    </div>
  `;

  content.querySelectorAll('[data-search-customer]').forEach(button => button.addEventListener('click', () => {
    const customerId = button.getAttribute('data-search-customer');
    openCustomerDetails(customerId);
  }));
  content.querySelectorAll('[data-staff-toggle]').forEach(button => button.addEventListener('click', () => {
    const staffId = button.getAttribute('data-staff-toggle');
    const details = content.querySelector(`#staff-details-${staffId}`);
    if (details) {
      details.hidden = !details.hidden;
    }
  }));
  document.getElementById('dashboard-search')?.addEventListener('input', renderDashboard);
}

function renderCustomerList() {
  const content = document.getElementById('customers-content');
  const search = document.getElementById('customer-search')?.value?.toLowerCase() || '';
  const area = document.getElementById('customer-area-filter')?.value || 'All';
  const filtered = state.customers.filter(customer => {
    const matchesSearch = [customer.name, customer.phone, customer.houseNumber, customer.area, customer.id].join(' ').toLowerCase().includes(search);
    const matchesArea = area === 'All' || customer.area === area;
    return matchesSearch && matchesArea;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const currentPage = Math.min(state.currentPage, totalPages);
  const start = (currentPage - 1) * state.pageSize;
  const pagedCustomers = filtered.slice(start, start + state.pageSize);
  const areas = ['All', ...new Set(state.areas)];
  const selectedCustomer = state.customers.find(c => c.id === state.selectedCustomerId) || filtered[0];

  content.innerHTML = `
    <div class="toolbar">
      <div class="search-row">
        <input id="customer-search" placeholder="Search customers" value="${search}" />
        <select id="customer-area-filter">
          ${areas.map(a => `<option value="${a}" ${a === area ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" data-action="open-registration">Register Customer</button>
    </div>
    ${selectedCustomer ? `
      <div class="card" style="margin-bottom:18px;">
        <h3>${selectedCustomer.name}</h3>
        <p>${selectedCustomer.address} • ${selectedCustomer.area} • ${selectedCustomer.phone}</p>
        <div class="search-row" style="margin-top:12px;">
          <button class="btn btn-primary" data-action="view-details">Open Details</button>
          <button class="btn btn-secondary" data-action="new-bill">Generate Bill</button>
        </div>
      </div>
    ` : ''}
    <div class="grid grid-3">
      ${pagedCustomers.map(customer => `
        <button class="customer-card" data-customer-id="${customer.id}">
          <div>
            <h4>${customer.name}</h4>
            <p>${customer.address} • ${customer.area}</p>
          </div>
          <span class="badge ${customer.status}">${customer.status.toUpperCase()}</span>
        </button>
      `).join('')}
    </div>
    <div class="toolbar" style="margin-top:16px;">
      <p style="margin:0;color:var(--muted);">Showing ${pagedCustomers.length} of ${filtered.length} results</p>
      <div class="search-row">
        <button class="btn btn-secondary" data-action="prev-page" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <span>Page ${currentPage} / ${totalPages}</span>
        <button class="btn btn-secondary" data-action="next-page" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;

  document.querySelectorAll('.customer-card').forEach(card => card.addEventListener('click', () => {
    const customerId = card.getAttribute('data-customer-id');
    state.selectedCustomerId = customerId;
    openCustomerDetails(customerId);
  }));

  document.querySelector('[data-action="view-details"]')?.addEventListener('click', () => {
    if (selectedCustomer) openCustomerDetails(selectedCustomer.id);
  });

  document.querySelector('[data-action="new-bill"]')?.addEventListener('click', () => {
    if (selectedCustomer) openCustomerDetails(selectedCustomer.id);
  });

  document.querySelector('[data-action="prev-page"]')?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage -= 1;
      renderCustomerList();
    }
  });

  document.querySelector('[data-action="next-page"]')?.addEventListener('click', () => {
    state.currentPage += 1;
    renderCustomerList();
  });

  const searchInput = document.getElementById('customer-search');
  const filterSelect = document.getElementById('customer-area-filter');
  searchInput?.addEventListener('input', () => {
    state.currentPage = 1;
    renderCustomerList();
  });
  filterSelect?.addEventListener('change', () => {
    state.currentPage = 1;
    renderCustomerList();
  });
  document.querySelector('[data-action="open-registration"]')?.addEventListener('click', () => switchView('registration'));
}

function renderRegistration() {
  const content = document.getElementById('registration-content');
  content.innerHTML = `
    <div class="card">
      <h3>Register Customer</h3>
      <form id="registration-form" class="form-grid">
        <div class="field"><label>Customer Name</label><input name="name" required /></div>
        <div class="field"><label>Father/Husband Name</label><input name="father" required /></div>
        <div class="field"><label>Phone Number</label><input name="phone" required pattern="[0-9]{10}" /></div>
        <div class="field"><label>Alternative Phone</label><input name="altPhone" pattern="[0-9]{10}" /></div>
        <div class="field full"><label>Address</label><input name="address" required /></div>
        <div class="field"><label>Area</label><select name="area">${state.areas.map(a => `<option>${a}</option>`).join('')}</select></div>
        <div class="field"><label>House Number</label><input name="houseNumber" required /></div>
        <div class="field"><label>Monthly Fee</label><input name="monthlyFee" type="number" min="1" required /></div>
        <div class="field"><label>Number of Family Members</label><input name="familyMembers" type="number" min="1" required /></div>
        <div class="field"><label>Registration Date</label><input name="registrationDate" type="date" required /></div>
        <div class="field"><label>Payment Starts From (Nepali Date)</label><input name="paymentStartsFrom" placeholder="2083-01" required /></div>
        <div class="field"><label>Status</label><select name="status"><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option></select></div>
        <div class="field full"><label>Remarks</label><textarea name="remarks"></textarea></div>
        <div class="field full"><button type="submit" class="btn btn-primary">Save Customer</button></div>
      </form>
    </div>
  `;

  document.getElementById('registration-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const customer = Object.fromEntries(formData.entries());
    const duplicate = state.customers.find(item => item.phone === customer.phone && item.houseNumber === customer.houseNumber);
    if (duplicate) {
      showToast('Duplicate customer detected for this phone and house number', 'error');
      return;
    }
    const generatedId = `C-${1000 + state.customers.length + 1}`;
    const newCustomer = {
      id: generatedId,
      ...customer,
      monthlyFee: Number(customer.monthlyFee),
      familyMembers: Number(customer.familyMembers),
      status: customer.status || 'green',
      paidUpTo: customer.paymentStartsFrom,
      registeredBy: state.currentUser?.name || 'System'
    };
    state.customers.unshift(newCustomer);
    await createCustomerInSupabase(newCustomer);
    await saveState();
    showToast('Customer registered successfully', 'success');
    renderCustomerList();
    switchView('customers');
  });
}

function openCustomerDetails(customerId) {
  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) return;
  state.selectedCustomerId = customer.id;
  switchView('customers');
  const content = document.getElementById('customers-content');
  content.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <h3 style="margin:0;">${customer.name}</h3>
        <button class="btn btn-secondary" id="back-to-list">Back to Customer List</button>
      </div>
      <div class="grid grid-4">
        <div class="metric"><span class="label">Customer ID</span><span class="value">${customer.id}</span></div>
        <div class="metric"><span class="label">Area</span><span class="value">${customer.area}</span></div>
        <div class="metric"><span class="label">House Number</span><span class="value">${customer.houseNumber}</span></div>
        <div class="metric"><span class="label">Monthly Fee</span><span class="value">${formatCurrency(customer.monthlyFee)}</span></div>
      </div>
      <div class="grid grid-3" style="margin-top:18px;">
        <div class="card">
          <h4>Billing</h4>
          <div class="field"><label>Months</label><select id="billing-months"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="6">6</option><option value="12">12</option><option value="custom">Custom</option></select></div>
          <div class="field" id="custom-months-wrap" style="display:none; margin-top:8px;"><label>Custom Months</label><input id="custom-months" type="number" min="1" /></div>
          <div class="field" style="margin-top:8px;"><label>Total</label><input id="billing-total" value="${customer.monthlyFee}" readonly /></div>
          <div class="field" style="margin-top:8px;"><label>Bill Number</label><input id="billing-bill-number" placeholder="Optional custom bill number" /></div>
          <div class="field" style="margin-top:8px;"><label>Payment Method</label><select id="payment-method"><option>Cash</option><option>Online QR</option></select></div>
          <div class="field" style="margin-top:8px;"><button class="btn btn-primary" id="generate-bill">Generate Bill</button></div>
          <div class="field" style="margin-top:8px;"><button class="btn btn-secondary" id="print-bill">Print Bill</button></div>
          <div class="field" style="margin-top:8px;"><button class="btn btn-secondary" id="download-bill">Download PDF</button></div>
        </div>
        <div class="card">
          <h4>Payment History</h4>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Bill</th><th>Amount</th><th>Method</th><th>Received By</th></tr></thead>
              <tbody>
                ${state.payments.filter(p => p.customerId === customer.id).map(p => `<tr><td>${p.billNumber}</td><td>${formatCurrency(p.amount)}</td><td>${p.method}</td><td>${p.receivedBy || p.collectedBy || '—'}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h4>Customer Details</h4>
          <p><strong>Phone:</strong> ${customer.phone}</p>
          <p><strong>Alternative Phone:</strong> ${customer.altPhone || '—'}</p>
          <p><strong>Family Members:</strong> ${customer.familyMembers}</p>
          <p><strong>Registered By:</strong> ${customer.registeredBy || '—'}</p>
          <p><strong>Paid Up To:</strong> ${customer.paidUpTo}</p>
          <p><strong>Remarks:</strong> ${customer.remarks || '—'}</p>
        </div>
      </div>
          <div class="card" style="margin-top:18px;">
        <h4>QR Payment Placeholder</h4>
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <img src="${state.company.qrImage || 'assets/qr-placeholder.svg'}" alt="QR placeholder" style="width:180px;height:180px;object-fit:contain;border:1px solid var(--line);border-radius:16px;" />
          <div>
            <p><strong>Company Name:</strong> ${state.company.name}</p>
            <p><strong>Message:</strong> Please scan the QR code to complete payment.</p>
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:18px;">
        <h4>Account Closure Requests</h4>
        ${state.currentUser?.role === 'staff' ? `
          <form id="close-account-form" class="form-grid">
            <div class="field full"><label>Reason</label><textarea name="reason" required></textarea></div>
            <div class="field full"><button class="btn btn-primary" type="submit">Submit Closure Request</button></div>
          </form>
        ` : ''}
        ${state.currentUser?.role === 'admin' ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                ${state.closeRequests.filter(request => request.customerId === customer.id).map(request => `
                  <tr>
                    <td>${request.customerName}</td>
                    <td>${request.reason}</td>
                    <td>${request.status}</td>
                    <td>
                      <button class="btn btn-primary" data-close-action="approve" data-id="${request.id}">Approve</button>
                      <button class="btn btn-ghost" data-close-action="reject" data-id="${request.id}">Reject</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('back-to-list').addEventListener('click', renderCustomerList);
  document.getElementById('billing-months').addEventListener('change', (event) => {
    const customWrap = document.getElementById('custom-months-wrap');
    const totalInput = document.getElementById('billing-total');
    if (event.target.value === 'custom') {
      customWrap.style.display = 'block';
      totalInput.value = customer.monthlyFee;
    } else {
      customWrap.style.display = 'none';
      totalInput.value = customer.monthlyFee * Number(event.target.value);
    }
  });

  document.getElementById('custom-months').addEventListener('input', (event) => {
    const totalInput = document.getElementById('billing-total');
    totalInput.value = customer.monthlyFee * Number(event.target.value || 0);
  });

  document.getElementById('generate-bill').addEventListener('click', async () => {
    const months = document.getElementById('billing-months').value === 'custom' ? Number(document.getElementById('custom-months').value || 0) : Number(document.getElementById('billing-months').value);
    const paymentMethod = document.getElementById('payment-method').value;
    const customBillNumber = document.getElementById('billing-bill-number')?.value?.trim() || '';
    const billNumber = customBillNumber || `B-${1000 + state.payments.length + 1}`;
    const nextPaidUpTo = addMonthsToNepaliDate(customer.paidUpTo, months);
    state.payments.unshift({
      billNumber,
      customerId: customer.id,
      customerName: customer.name,
      amount: customer.monthlyFee * months,
      method: paymentMethod,
      date: new Date().toISOString().slice(0, 10),
      nepaliDate: nextPaidUpTo,
      months,
      collectedBy: state.currentUser?.name || 'System',
      receivedBy: state.currentUser?.name || 'System'
    });
    customer.paidUpTo = nextPaidUpTo;
    await updateCustomerInSupabase(customer);
    await saveState();
    showToast('Bill generated and payment recorded', 'success');
    showBillModal(state.payments[0]);
    openCustomerDetails(customer.id);
  });

  document.getElementById('close-account-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.closeRequests.unshift({
      id: Date.now(),
      customerId: customer.id,
      customerName: customer.name,
      reason: formData.get('reason'),
      requestedBy: state.currentUser?.name || 'Staff',
      requestDate: new Date().toISOString().slice(0, 10),
      status: 'Pending'
    });
    await saveState();
    showToast('Account closure request submitted', 'success');
    openCustomerDetails(customer.id);
  });

  document.querySelectorAll('[data-close-action]').forEach(button => button.addEventListener('click', async () => {
    const request = state.closeRequests.find(item => item.id === Number(button.getAttribute('data-id')));
    if (!request) return;

    if (button.getAttribute('data-close-action') === 'approve') {
      request.status = 'Approved';
      state.customers = state.customers.filter(item => item.id !== request.customerId);
      state.payments = state.payments.filter(item => item.customerId !== request.customerId);
      state.closeRequests = state.closeRequests.filter(item => item.customerId !== request.customerId);
      state.selectedCustomerId = null;
      await deleteCustomerInSupabase(request.customerId);
      await saveState();
      showToast('Customer record removed after approval', 'success');
      renderCustomerList();
      switchView('customers');
      return;
    }

    request.status = 'Rejected';
    await saveState();
    showToast('Account closure request rejected', 'info');
    openCustomerDetails(customer.id);
  }));

  document.getElementById('print-bill').addEventListener('click', () => window.print());
  document.getElementById('download-bill').addEventListener('click', () => {
    const receipt = `GreenWaste Receipt\nCustomer: ${customer.name}\nBill Number: B-${1000 + state.payments.length + 1}\nAmount: ${formatCurrency(customer.monthlyFee)}`;
    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'receipt.pdf';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Receipt download started', 'info');
  });

  document.getElementById('page-title').textContent = `Customer Details · ${customer.name}`;
}

function renderPayments() {
  const content = document.getElementById('payments-content');
  const search = document.getElementById('payment-search')?.value?.toLowerCase() || '';
  const method = document.getElementById('payment-method-filter')?.value || 'All';
  const filtered = state.payments.filter(payment => {
    const matchesSearch = [payment.billNumber, payment.customerName, payment.method].join(' ').toLowerCase().includes(search);
    const matchesMethod = method === 'All' || payment.method === method;
    return matchesSearch && matchesMethod;
  });

  content.innerHTML = `
    <div class="card">
      <h3>Payment History</h3>
      <div class="toolbar">
        <div class="search-row">
          <input id="payment-search" placeholder="Search payments" value="${search}" />
          <select id="payment-method-filter">
            <option value="All">All Methods</option>
            <option value="Cash" ${method === 'Cash' ? 'selected' : ''}>Cash</option>
            <option value="Online QR" ${method === 'Online QR' ? 'selected' : ''}>Online QR</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Bill #</th><th>Customer</th><th>Amount</th><th>Method</th><th>Date</th><th>Received By</th></tr></thead>
          <tbody>
            ${filtered.map(p => `<tr><td>${p.billNumber}</td><td>${p.customerName}</td><td>${formatCurrency(p.amount)}</td><td>${p.method}</td><td>${p.date}</td><td>${p.receivedBy || p.collectedBy || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('payment-search')?.addEventListener('input', renderPayments);
  document.getElementById('payment-method-filter')?.addEventListener('change', renderPayments);
}

function renderAreas() {
  const content = document.getElementById('areas-content');
  content.innerHTML = `
    <div class="card">
      <h3>Area Management</h3>
      <div class="toolbar">
        <div class="search-row">
          <input placeholder="New area" id="new-area-input" />
          <button class="btn btn-primary" id="add-area-btn">Add Area</button>
        </div>
      </div>
      <div class="grid grid-3">
        ${state.areas.map(area => `<div class="card"><h4>${area}</h4><p>Used for customer organization and filtering.</p></div>`).join('')}
      </div>
    </div>
  `;

  document.getElementById('add-area-btn').addEventListener('click', () => {
    const input = document.getElementById('new-area-input');
    const area = input.value.trim();
    if (!area) return;
    state.areas.push(area);
    input.value = '';
    renderAreas();
    showToast('Area added', 'success');
  });
}

function renderReports() {
  const content = document.getElementById('reports-content');
  content.innerHTML = `
    <div class="card">
      <h3>Reports</h3>
      <p>Administrator reports are ready for PDF and Excel export workflows.</p>
      <div class="search-row" style="margin-top:12px;">
        <button class="btn btn-primary" id="export-pdf">Export PDF</button>
        <button class="btn btn-secondary" id="export-excel">Export Excel</button>
      </div>
      <div class="grid grid-3" style="margin-top:16px;">
        <div class="card"><h4>Monthly Collection</h4><p>${formatCurrency(state.payments.reduce((sum, p) => sum + p.amount, 0))}</p></div>
        <div class="card"><h4>Due Customers</h4><p>${state.customers.filter(c => c.status === 'red' || c.status === 'yellow').length}</p></div>
        <div class="card"><h4>Pending Requests</h4><p>${state.feeRequests.filter(r => r.status === 'Pending').length}</p></div>
      </div>
    </div>
  `;

  document.getElementById('export-pdf')?.addEventListener('click', () => showToast('PDF export prepared', 'info'));
  document.getElementById('export-excel')?.addEventListener('click', () => showToast('Excel export prepared', 'info'));
}

function renderFeeRequests() {
  const content = document.getElementById('fee-requests-content');
  if (state.currentUser.role === 'staff') {
    content.innerHTML = `
      <div class="card">
        <h3>Submit Fee Decrease Request</h3>
        <form id="fee-request-form" class="form-grid">
          <div class="field"><label>Customer Name</label><select name="customerId">${state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></div>
          <div class="field"><label>Requested New Fee</label><input name="requestedFee" type="number" required /></div>
          <div class="field full"><label>Reason</label><textarea name="reason" required></textarea></div>
          <div class="field full"><button class="btn btn-primary">Submit Request</button></div>
        </form>
      </div>
    `;

    document.getElementById('fee-request-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const selectedCustomer = state.customers.find(c => c.id === formData.get('customerId'));
      state.feeRequests.unshift({
        id: Date.now(),
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        oldFee: selectedCustomer.monthlyFee,
        requestedFee: Number(formData.get('requestedFee')),
        reason: formData.get('reason'),
        requestedBy: state.currentUser.name,
        requestDate: new Date().toISOString().slice(0, 10),
        status: 'Pending'
      });
      showToast('Fee decrease request submitted', 'success');
      renderFeeRequests();
    });
    return;
  }

  content.innerHTML = `
    <div class="card">
      <h3>Fee Decrease Requests</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>Old Fee</th><th>Requested Fee</th><th>Status</th><th>Reason</th><th>Action</th></tr></thead>
          <tbody>
            ${state.feeRequests.map(request => `
              <tr>
                <td>${request.customerName}</td>
                <td>${request.oldFee}</td>
                <td>${request.requestedFee}</td>
                <td>${request.status}</td>
                <td>${request.reason}</td>
                <td>
                  <button class="btn btn-primary" data-action="approve" data-id="${request.id}">Approve</button>
                  <button class="btn btn-ghost" data-action="reject" data-id="${request.id}">Reject</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  content.querySelectorAll('[data-action="approve"]').forEach(btn => btn.addEventListener('click', async () => {
    const request = state.feeRequests.find(r => r.id === Number(btn.getAttribute('data-id')));
    if (!request) return;
    const customer = state.customers.find(c => c.id === request.customerId);
    if (customer) {
      customer.monthlyFee = request.requestedFee;
      request.status = 'Approved';
      request.approvedBy = state.currentUser.name;
      request.approvalDate = new Date().toISOString().slice(0, 10);
      state.feeRequests = state.feeRequests.filter(item => item.id !== request.id);
      await saveState();
      showToast('Fee decrease approved', 'success');
      renderFeeRequests();
    }
  }));

  content.querySelectorAll('[data-action="reject"]').forEach(btn => btn.addEventListener('click', async () => {
    const request = state.feeRequests.find(r => r.id === Number(btn.getAttribute('data-id')));
    if (!request) return;
    request.status = 'Rejected';
    request.rejectionReason = 'Rejected by administrator';
    state.feeRequests = state.feeRequests.filter(item => item.id !== request.id);
    await saveState();
    showToast('Fee decrease rejected', 'info');
    renderFeeRequests();
  }));
}

function renderNotifications() {
  const content = document.getElementById('notifications-content');
  content.innerHTML = `
    <div class="card">
      <h3>Notifications</h3>
      <div class="grid grid-3">
        ${state.notifications.map(n => `
          <div class="card">
            <h4>${n.title}</h4>
            <p>${n.message}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderUsers() {
  ensureUsers();
  const content = document.getElementById('users-content');
  content.innerHTML = `
    <div class="card">
      <h3>User Management</h3>
      <form id="staff-user-form" class="form-grid">
        <div class="field"><label>Staff Name</label><input name="name" required /></div>
        <div class="field"><label>Username</label><input name="username" required /></div>
        <div class="field"><label>Password</label><input name="password" type="password" required /></div>
        <div class="field full"><button class="btn btn-primary" type="submit">Create Staff Account</button></div>
      </form>
      <div class="table-wrap" style="margin-top:16px;">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Action</th></tr></thead>
          <tbody>
            ${state.users.filter(user => user.role === 'staff').map(user => `<tr><td>${user.name}</td><td>${user.username}</td><td>${user.role}</td><td><button class="btn btn-ghost" data-remove-staff="${user.id}" type="button">Remove</button></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('staff-user-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '').trim();
    const name = String(formData.get('name') || '').trim() || username;

    if (!username || !password) {
      showToast('Username and password are required', 'error');
      return;
    }

    const exists = state.users.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      showToast('Username already exists', 'error');
      return;
    }

    state.users.push({ id: `staff-${Date.now()}`, name, username, password, role: 'staff' });
    await saveState();
    showToast('Staff account created', 'success');
    renderUsers();
  });

  content.querySelectorAll('[data-remove-staff]').forEach(button => {
    button.addEventListener('click', async () => {
      const staffId = button.getAttribute('data-remove-staff');
      state.users = state.users.filter(user => user.id !== staffId);
      await saveState();
      showToast('Staff account removed', 'success');
      renderUsers();
    });
  });
}

function renderSettings() {
  const content = document.getElementById('settings-content');
  content.innerHTML = `
    <div class="card">
      <h3>System Settings</h3>
      <form id="settings-form" class="form-grid">
        <div class="field"><label>Company Name</label><input name="companyName" value="${state.company.name}" /></div>
        <div class="field"><label>Phone</label><input name="companyPhone" value="${state.company.phone}" /></div>
        <div class="field full"><label>Address</label><input name="companyAddress" value="${state.company.address}" /></div>
        <div class="field full">
          <label>QR Code Upload</label>
          <input id="qr-upload" type="file" accept="image/*" />
          <div class="card" style="margin-top:10px;">
            ${state.company.qrImage ? `<img src="${state.company.qrImage}" alt="Company QR" style="max-width:220px;max-height:220px;object-fit:contain;" />` : '<p>No QR uploaded yet.</p>'}
          </div>
        </div>
        <div class="field full"><button class="btn btn-primary" type="submit">Save Settings</button></div>
      </form>
    </div>
  `;

  document.getElementById('settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    state.company.name = formData.get('companyName') || DEFAULT_COMPANY.name;
    state.company.phone = formData.get('companyPhone') || DEFAULT_COMPANY.phone;
    state.company.address = formData.get('companyAddress') || DEFAULT_COMPANY.address;
    await saveState();
    applyBranding();
    showToast('Company settings updated', 'success');
    renderSettings();
  });

  document.getElementById('qr-upload')?.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      state.company.qrImage = reader.result;
      await saveState();
      applyBranding();
      showToast('QR code uploaded', 'success');
      renderSettings();
    };
    reader.readAsDataURL(file);
  });
}

function setRoleVisibility() {
  document.querySelectorAll('.admin-only').forEach(item => {
    item.classList.toggle('hidden', state.currentUser?.role !== 'admin');
  });
}

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.getAttribute('data-view') === viewName));
  Object.entries(viewMap).forEach(([name, view]) => view.classList.toggle('active', name === viewName));
  document.getElementById('page-title').textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1).replace('-', ' ');

  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'customers') renderCustomerList();
  if (viewName === 'registration') renderRegistration();
  if (viewName === 'billing') {
    const selectedCustomer = state.customers.find(customer => customer.id === state.selectedCustomerId) || state.customers[0];
    if (selectedCustomer) {
      document.getElementById('billing-content').innerHTML = `
        <div class="card">
          <h3>Billing Workspace</h3>
          <p>Selected customer: ${selectedCustomer.name}</p>
          <p>Use the customer list to open billing details for a specific account.</p>
        </div>
        <div class="grid grid-2" style="margin-top:18px;">
          <div class="card">
            <h3>Recent Payments</h3>
            <ul>
              ${state.payments.length ? state.payments.slice(0, 5).map(payment => `<li>${payment.customerName} • ${formatCurrency(payment.amount)} • ${payment.method}</li>`).join('') : '<li>No recent payments yet.</li>'}
            </ul>
          </div>
          <div class="card">
            <h3>Recent Customers</h3>
            <ul>
              ${state.customers.length ? state.customers.slice(0, 5).map(customer => `<li>${customer.name} • ${customer.area}</li>`).join('') : '<li>No recent customers yet.</li>'}
            </ul>
          </div>
        </div>
      `;
    }
  }
  if (viewName === 'payments') renderPayments();
  if (viewName === 'areas') renderAreas();
  if (viewName === 'reports') renderReports();
  if (viewName === 'fee-requests') renderFeeRequests();
  if (viewName === 'notifications') renderNotifications();
  if (viewName === 'users') renderUsers();
  if (viewName === 'settings') renderSettings();
}

function authenticate(username, password) {
  ensureUsers();
  const normalizedUsername = (username || '').trim().toLowerCase();
  const user = state.users.find(entry => entry.username.toLowerCase() === normalizedUsername && entry.password === password);
  if (!user) return null;
  return { name: user.name, role: user.role, username: user.username };
}

async function showApp(user) {
  state.currentUser = user;
  await saveState();
  applyBranding();
  loginScreen.classList.remove('active');
  appShell.classList.add('active');
  document.getElementById('profile-name').textContent = user.name;
  document.getElementById('profile-role').textContent = user.role === 'admin' ? 'Administrator' : 'Staff';
  document.getElementById('profile-avatar').textContent = user.role === 'admin' ? 'A' : 'S';
  setRoleVisibility();
  switchView('dashboard');
}

async function logout() {
  state.currentUser = null;
  await saveState();
  appShell.classList.remove('active');
  loginScreen.classList.add('active');
  loginForm.reset();
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const user = authenticate(username, password);
  if (!user) {
    showToast('Invalid username or password', 'error');
    return;
  }
  showToast(`Welcome ${user.name}`, 'success');
  await showApp(user);
});

logoutBtn.addEventListener('click', async () => {
  await logout();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  state.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
});

navItems.forEach(item => item.addEventListener('click', () => switchView(item.getAttribute('data-view'))));

(async () => {
  await seedData();
  applyBranding();
  renderDashboard();
})();
