// Configuration
// The user will replace this with their Google Apps Script Web App URL after deployment
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxrVrKoM3iFHVP4Cc0V9Gxrk3vevvCMu6rmQ9ouw4zjH94ohp0uXlHCYlGEqpgqxZmh/exec";

// State Management
let dbData = null;
let currentUser = null; // Stores { email, phc, block }
let submittedReportsList = []; // Blood Smear reports (Village-wise)
let submittedMedReportsList = []; // Medicine reports
let submittedSourceWiseList = []; // Source-wise reports (Subcenter level)

// DOM Elements
const views = {
  login: document.getElementById('view-login'),
  register: document.getElementById('view-register'),
  home: document.getElementById('view-home'),
  bsc: document.getElementById('view-bsc'),
  medicine: document.getElementById('view-medicine')
};

const navItems = {
  home: document.getElementById('nav-home'),
  bsc: document.getElementById('nav-bsc'),
  medicine: document.getElementById('nav-medicine')
};

const loader = {
  overlay: document.getElementById('loading-spinner'),
  text: document.getElementById('loading-text')
};

const toast = document.getElementById('toast');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  showLoader("Loading location databases...");
  try {
    const res = await fetch('./locations.json');
    dbData = await res.json();
    setupRegisterDropdowns();
  } catch (err) {
    console.error("Failed to load locations.json", err);
    showToast("Error loading location data. Please check connection.", "error");
  } finally {
    hideLoader();
  }

  // Restore session if available
  const savedUser = localStorage.getItem('sindhudurg_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    setupReportingForm();
    setupMedicineForm();
    showView('home');
  } else {
    showView('login');
  }

  setupEventListeners();
});

// View Routing & Layout Management
function showView(viewName) {
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.remove('hidden');
    } else {
      views[key].classList.add('hidden');
    }
  });

  const sidebar = document.getElementById('app-sidebar');

  if (currentUser && viewName !== 'login' && viewName !== 'register') {
    document.body.className = "logged-in";
    sidebar.classList.remove('hidden');
    
    document.getElementById('badge-email').textContent = currentUser.email;
    document.getElementById('badge-phc').textContent = `${currentUser.block} / ${currentUser.phc}`;

    Object.keys(navItems).forEach(key => {
      if (key === viewName || (viewName === 'bsc' && key === 'bsc') || (viewName === 'medicine' && key === 'medicine')) {
        navItems[key].classList.add('active');
      } else {
        navItems[key].classList.remove('active');
      }
    });

  } else {
    document.body.className = "logged-out";
    sidebar.classList.add('hidden');
  }
}

// Helpers
function showLoader(message = "Processing...") {
  loader.text.textContent = message;
  loader.overlay.classList.remove('hidden');
}

function hideLoader() {
  loader.overlay.classList.add('hidden');
}

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Form Populating & Cascading for Registration
function setupRegisterDropdowns() {
  const blockSelect = document.getElementById('reg-block');
  const phcSelect = document.getElementById('reg-phc');

  Object.keys(dbData).sort().forEach(blockName => {
    const opt = document.createElement('option');
    opt.value = blockName;
    opt.textContent = blockName;
    blockSelect.appendChild(opt);
  });

  blockSelect.addEventListener('change', () => {
    const selectedBlock = blockSelect.value;
    phcSelect.innerHTML = '<option value="">Choose PHC...</option>';
    phcSelect.disabled = !selectedBlock;

    if (selectedBlock && dbData[selectedBlock]) {
      Object.keys(dbData[selectedBlock]).sort().forEach(phcName => {
        const opt = document.createElement('option');
        opt.value = phcName;
        opt.textContent = phcName;
        phcSelect.appendChild(opt);
      });
    }
  });
}

// Set up Blood Smear Collection Form dropdowns
function setupReportingForm() {
  if (!currentUser || !dbData) return;

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;

  const scSelect = document.getElementById('report-subcenter');
  const vilSelect = document.getElementById('report-village');

  scSelect.innerHTML = '<option value="">Choose Subcenter...</option>';
  vilSelect.innerHTML = '<option value="">Choose Village...</option>';
  vilSelect.disabled = true;

  const phcData = dbData[userBlock]?.[userPhc];
  if (phcData) {
    Object.keys(phcData).sort().forEach(scName => {
      const opt = document.createElement('option');
      opt.value = scName;
      opt.textContent = scName;
      scSelect.appendChild(opt);
    });
  }

  // Cascading Villages
  scSelect.addEventListener('change', () => {
    const selectedSc = scSelect.value;
    vilSelect.innerHTML = '<option value="">Choose Village...</option>';
    vilSelect.disabled = !selectedSc;

    if (selectedSc && phcData[selectedSc]) {
      phcData[selectedSc].sort().forEach(vilName => {
        const opt = document.createElement('option');
        opt.value = vilName;
        opt.textContent = vilName;
        vilSelect.appendChild(opt);
      });
    }
  });

  // Sync default month
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  
  const dashMonth = document.getElementById('dash-month');
  dashMonth.value = `${yyyy}-${mm}`;
  document.getElementById('report-month').value = `${yyyy}-${mm}`;
  document.getElementById('source-month').value = `${yyyy}-${mm}`;
  document.getElementById('med-month').value = `${yyyy}-${mm}`;

  // Initial fetch of dashboard data
  fetchDashboardReports();
}

// Set up Medicine Form dropdowns
function setupMedicineForm() {
  if (!currentUser || !dbData) return;

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;

  const scSelect = document.getElementById('med-subcenter');
  const vilSelect = document.getElementById('med-village');

  scSelect.innerHTML = '<option value="">Choose Subcenter...</option>';
  vilSelect.innerHTML = '<option value="">Choose Village...</option>';
  vilSelect.disabled = true;

  const phcData = dbData[userBlock]?.[userPhc];
  if (phcData) {
    Object.keys(phcData).sort().forEach(scName => {
      const opt = document.createElement('option');
      opt.value = scName;
      opt.textContent = scName;
      scSelect.appendChild(opt);
    });
  }

  // Cascading Villages
  scSelect.addEventListener('change', () => {
    const selectedSc = scSelect.value;
    vilSelect.innerHTML = '<option value="">Choose Village...</option>';
    vilSelect.disabled = !selectedSc;

    if (selectedSc && phcData[selectedSc]) {
      phcData[selectedSc].sort().forEach(vilName => {
        const opt = document.createElement('option');
        opt.value = vilName;
        opt.textContent = vilName;
        vilSelect.appendChild(opt);
      });
    }
  });
}

// Math/Calculations for Blood Smear (Village)
function calculateTotalBsc() {
  const activeVal = parseInt(document.getElementById('metric-active').value) || 0;
  const passiveVal = parseInt(document.getElementById('metric-passive').value) || 0;
  document.getElementById('metric-total').value = activeVal + passiveVal;
}

function checkPositivesWarning() {
  const posVal = parseInt(document.getElementById('metric-positive').value) || 0;
  const pfVal = parseInt(document.getElementById('metric-pf').value) || 0;
  const pvVal = parseInt(document.getElementById('metric-pv').value) || 0;
  const warningDiv = document.getElementById('positives-mismatch-warning');

  if (pfVal + pvVal !== posVal) {
    warningDiv.classList.remove('hidden');
  } else {
    warningDiv.classList.add('hidden');
  }
}

// Math/Calculations for Medicine Stock
function calculateClosingStock() {
  const opening = parseInt(document.getElementById('med-opening').value) || 0;
  const received = parseInt(document.getElementById('med-received').value) || 0;
  const distributed = parseInt(document.getElementById('med-distributed').value) || 0;
  document.getElementById('med-closing').value = (opening + received) - distributed;
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  navItems.home.addEventListener('click', (e) => { e.preventDefault(); showView('home'); });
  
  navItems.bsc.addEventListener('click', (e) => { 
    e.preventDefault(); 
    showView('bsc'); 
    toggleBscSubView('source');
  });
  
  navItems.medicine.addEventListener('click', (e) => { e.preventDefault(); showView('medicine'); });

  // Sub-Tabs Navigation for BSC
  document.getElementById('btn-tab-source').addEventListener('click', () => toggleBscSubView('source'));
  document.getElementById('btn-tab-village').addEventListener('click', () => toggleBscSubView('village'));

  document.getElementById('link-go-register').addEventListener('click', (e) => { e.preventDefault(); showView('register'); });
  document.getElementById('link-go-login').addEventListener('click', (e) => { e.preventDefault(); showView('login'); });

  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('sindhudurg_user');
    currentUser = null;
    showView('login');
    showToast("Logged out successfully.");
  });

  // Month sync on dashboard change
  document.getElementById('dash-month').addEventListener('change', (e) => {
    const newMonth = e.target.value;
    document.getElementById('report-month').value = newMonth;
    document.getElementById('source-month').value = newMonth;
    document.getElementById('med-month').value = newMonth;
    fetchDashboardReports();
  });

  // BSC form calculations
  document.getElementById('metric-active').addEventListener('input', calculateTotalBsc);
  document.getElementById('metric-passive').addEventListener('input', calculateTotalBsc);
  document.getElementById('metric-positive').addEventListener('input', checkPositivesWarning);
  document.getElementById('metric-pf').addEventListener('input', checkPositivesWarning);
  document.getElementById('metric-pv').addEventListener('input', checkPositivesWarning);

  // Medicine form calculations
  document.getElementById('med-opening').addEventListener('input', calculateClosingStock);
  document.getElementById('med-received').addEventListener('input', calculateClosingStock);
  document.getElementById('med-distributed').addEventListener('input', calculateClosingStock);

  // Form Submissions
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('form-report').addEventListener('submit', handleReportSubmission);
  document.getElementById('form-medicine').addEventListener('submit', handleMedicineSubmission);
  document.getElementById('form-source-wise').addEventListener('submit', handleSourceWiseSubmission);
}

// Toggle sub-views inside BSC View
function toggleBscSubView(subview) {
  const btnSource = document.getElementById('btn-tab-source');
  const btnVillage = document.getElementById('btn-tab-village');
  const viewSource = document.getElementById('bsc-subview-source');
  const viewVillage = document.getElementById('bsc-subview-village');

  if (subview === 'source') {
    btnSource.classList.add('active');
    btnVillage.classList.remove('active');
    viewSource.classList.remove('hidden');
    viewVillage.classList.add('hidden');
    renderSourceWiseTable();
  } else {
    btnSource.classList.remove('active');
    btnVillage.classList.add('active');
    viewSource.classList.add('hidden');
    viewVillage.classList.remove('hidden');
  }
}

// Render dynamic Source-wise input table
function renderSourceWiseTable() {
  const tbody = document.getElementById('source-wise-table-body');
  tbody.innerHTML = "";

  if (!currentUser || !dbData) return;

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;
  const phcData = dbData[userBlock]?.[userPhc];

  if (!phcData) return;

  // Create list of locations: First is the PHC itself, then all Subcenters
  const locations = [`${userPhc} PHC (HQ)`, ...Object.keys(phcData).sort()];

  locations.forEach((loc, idx) => {
    // Check if we have pre-existing saved report for this month/location
    const saved = submittedSourceWiseList.find(s => s.locationName.toLowerCase().trim() === loc.toLowerCase().trim());

    const tr = document.createElement('tr');
    tr.dataset.location = loc;

    // Location Name
    const tdName = document.createElement('td');
    tdName.innerHTML = `<strong>${loc}</strong>`;
    tr.appendChild(tdName);

    // Input fields columns
    const fields = ['population', 'opd', 'opdBs', 'anmBs', 'mpwBs', 'anmNhmBs', 'ashaBs'];
    const inputs = {};

    fields.forEach(field => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = "number";
      input.min = "0";
      input.className = "input-sm";
      input.value = saved ? (saved[field] || "") : "";
      input.placeholder = "0";
      input.style.width = "100%";
      
      // Calculate row total on input changes
      input.addEventListener('input', () => {
        calculateRowTotal(tr);
        reconcileActivePassive();
      });

      inputs[field] = input;
      td.appendChild(input);
      tr.appendChild(td);
    });

    // Row Total (Read-only)
    const tdTotal = document.createElement('td');
    const inputTotal = document.createElement('input');
    inputTotal.type = "number";
    inputTotal.className = "input-sm input-readonly";
    inputTotal.readOnly = true;
    inputTotal.value = "0";
    inputTotal.style.width = "100%";
    
    tdTotal.appendChild(inputTotal);
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
    calculateRowTotal(tr);
  });

  reconcileActivePassive();
}

// Calculate row total in the Source Table: Total BS = OPD BS + ANM BS + MPW BS + ANM NHM BS + ASHA BS
function calculateRowTotal(tr) {
  const inputs = tr.querySelectorAll('input');
  const opdBs = parseInt(inputs[2].value) || 0;
  const anmBs = parseInt(inputs[3].value) || 0;
  const mpwBs = parseInt(inputs[4].value) || 0;
  const anmNhmBs = parseInt(inputs[5].value) || 0;
  const ashaBs = parseInt(inputs[6].value) || 0;

  const total = opdBs + anmBs + mpwBs + anmNhmBs + ashaBs;
  inputs[7].value = total;
}

// Reconciliation check: compares Source-wise table totals against Village-wise submitted totals
function reconcileActivePassive() {
  const tbody = document.getElementById('source-wise-table-body');
  const rows = tbody.querySelectorAll('tr');

  let sourceActiveTotal = 0;
  let sourcePassiveTotal = 0;

  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length >= 8) {
      // Passive Source: OPD BS (inputs[2])
      sourcePassiveTotal += parseInt(inputs[2].value) || 0;

      // Active Sources: ANM BS (inputs[3]) + MPW BS (inputs[4]) + ANM NHM BS (inputs[5]) + ASHA BS (inputs[6])
      sourceActiveTotal += (parseInt(inputs[3].value) || 0) +
                           (parseInt(inputs[4].value) || 0) +
                           (parseInt(inputs[5].value) || 0) +
                           (parseInt(inputs[6].value) || 0);
    }
  });

  // Calculate Village-wise Totals
  let villageActiveTotal = 0;
  let villagePassiveTotal = 0;

  submittedReportsList.forEach(report => {
    villageActiveTotal += parseInt(report.active) || 0;
    villagePassiveTotal += parseInt(report.passive) || 0;
  });

  // Update Reconciliation UI
  document.getElementById('recon-active-source').textContent = sourceActiveTotal;
  document.getElementById('recon-active-village').textContent = villageActiveTotal;
  document.getElementById('recon-passive-source').textContent = sourcePassiveTotal;
  document.getElementById('recon-passive-village').textContent = villagePassiveTotal;

  const activeBadge = document.getElementById('recon-active-status');
  const passiveBadge = document.getElementById('recon-passive-status');
  const warningDiv = document.getElementById('recon-mismatch-warning');

  let matched = true;

  if (sourceActiveTotal === villageActiveTotal) {
    activeBadge.textContent = "Matched";
    activeBadge.className = "status-badge submitted";
  } else {
    activeBadge.textContent = "Mismatch";
    activeBadge.className = "status-badge pending";
    matched = false;
  }

  if (sourcePassiveTotal === villagePassiveTotal) {
    passiveBadge.textContent = "Matched";
    passiveBadge.className = "status-badge submitted";
  } else {
    passiveBadge.textContent = "Mismatch";
    passiveBadge.className = "status-badge pending";
    matched = false;
  }

  if (matched) {
    warningDiv.classList.add('hidden');
  } else {
    warningDiv.classList.remove('hidden');
  }
}

// Submit Source-wise Report
async function handleSourceWiseSubmission(e) {
  e.preventDefault();

  const month = document.getElementById('source-month').value;
  const tbody = document.getElementById('source-wise-table-body');
  const rows = tbody.querySelectorAll('tr');

  const rowsData = [];
  rows.forEach(tr => {
    const locName = tr.dataset.location;
    const inputs = tr.querySelectorAll('input');
    
    rowsData.push({
      locationName: locName,
      population: parseInt(inputs[0].value) || 0,
      opd: parseInt(inputs[1].value) || 0,
      opdBs: parseInt(inputs[2].value) || 0,
      anmBs: parseInt(inputs[3].value) || 0,
      mpwBs: parseInt(inputs[4].value) || 0,
      anmNhmBs: parseInt(inputs[5].value) || 0,
      ashaBs: parseInt(inputs[6].value) || 0
    });
  });

  showLoader("Submitting Source-wise report...");
  try {
    const payload = {
      action: 'submitSourceWiseReport',
      email: currentUser.email,
      block: currentUser.block,
      phc: currentUser.phc,
      month: month,
      rows: rowsData
    };

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast(result.message || "Source-wise report saved successfully!", "success");
      fetchDashboardReports(); // Reload data
    } else {
      showToast(result.message || "Failed to submit.", "error");
    }
  } catch (err) {
    console.error("Source submission error", err);
    showToast("Server communication error.", "error");
  } finally {
    hideLoader();
  }
}

// Actions
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (BACKEND_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showToast("Error: Portal Backend URL is not configured.", "error");
    return;
  }

  showLoader("Authenticating...");
  try {
    const payload = { action: 'login', email, password };
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      currentUser = { email: result.email, phc: result.phc, block: result.block };
      localStorage.setItem('sindhudurg_user', JSON.stringify(currentUser));
      setupReportingForm();
      setupMedicineForm();
      showView('home');
      showToast("Access Granted. Welcome back!");
    } else {
      showToast(result.message || "Invalid credentials or pending approval.", "error");
    }
  } catch (err) {
    console.error("Login Error", err);
    showToast("Server communication error.", "error");
  } finally {
    hideLoader();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const block = document.getElementById('reg-block').value;
  const phc = document.getElementById('reg-phc').value;

  showLoader("Submitting registration...");
  try {
    const payload = { action: 'register', email, password, block, phc };
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast("Registration submitted. Please wait for Admin approval.", "success");
      document.getElementById('form-register').reset();
      document.getElementById('reg-phc').disabled = true;
      showView('login');
    } else {
      showToast(result.message || "Registration failed.", "error");
    }
  } catch (err) {
    console.error("Registration Error", err);
    showToast("Server communication error.", "error");
  } finally {
    hideLoader();
  }
}

async function handleReportSubmission(e) {
  e.preventDefault();

  const month = document.getElementById('report-month').value;
  const subcenter = document.getElementById('report-subcenter').value;
  const village = document.getElementById('report-village').value;
  
  const target = parseInt(document.getElementById('metric-target').value) || 0;
  const active = parseInt(document.getElementById('metric-active').value) || 0;
  const passive = parseInt(document.getElementById('metric-passive').value) || 0;
  const total = parseInt(document.getElementById('metric-total').value) || 0;
  
  const positive = parseInt(document.getElementById('metric-positive').value) || 0;
  const pf = parseInt(document.getElementById('metric-pf').value) || 0;
  const pv = parseInt(document.getElementById('metric-pv').value) || 0;
  const rt = parseInt(document.getElementById('metric-rt').value) || 0;

  showLoader("Submitting Blood Smear report...");
  try {
    const payload = {
      action: 'submitReport',
      email: currentUser.email,
      block: currentUser.block,
      phc: currentUser.phc,
      month,
      subcenter,
      village,
      target,
      active,
      passive,
      total,
      positive,
      pf,
      pv,
      rt
    };

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast(result.message || "Report submitted successfully!", "success");
      
      // Reset inputs
      document.getElementById('report-subcenter').value = "";
      document.getElementById('report-village').innerHTML = '<option value="">Choose Village...</option>';
      document.getElementById('report-village').disabled = true;
      document.getElementById('metric-target').value = "";
      document.getElementById('metric-active').value = "";
      document.getElementById('metric-passive').value = "";
      document.getElementById('metric-total').value = "0";
      document.getElementById('metric-positive').value = "";
      document.getElementById('metric-pf').value = "";
      document.getElementById('metric-pv').value = "";
      document.getElementById('metric-rt').value = "";
      document.getElementById('positives-mismatch-warning').classList.add('hidden');

      // Go back to Home and Refresh
      showView('home');
      fetchDashboardReports();
    } else {
      showToast(result.message || "Submission failed.", "error");
    }
  } catch (err) {
    console.error("BSC Submission Error", err);
    showToast("Server communication error.", "error");
  } finally {
    hideLoader();
  }
}

async function handleMedicineSubmission(e) {
  e.preventDefault();

  const month = document.getElementById('med-month').value;
  const subcenter = document.getElementById('med-subcenter').value;
  const village = document.getElementById('med-village').value;
  const medicineName = document.getElementById('med-name').value;
  
  const opening = parseInt(document.getElementById('med-opening').value) || 0;
  const received = parseInt(document.getElementById('med-received').value) || 0;
  const distributed = parseInt(document.getElementById('med-distributed').value) || 0;
  const closing = parseInt(document.getElementById('med-closing').value) || 0;
  const damaged = parseInt(document.getElementById('med-damaged').value) || 0;

  showLoader("Submitting Medicine report...");
  try {
    const payload = {
      action: 'submitMedicineReport',
      email: currentUser.email,
      block: currentUser.block,
      phc: currentUser.phc,
      month,
      subcenter,
      village,
      medicineName,
      opening,
      received,
      distributed,
      closing,
      damaged
    };

    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast(result.message || "Medicine report submitted successfully!", "success");
      
      // Reset inputs
      document.getElementById('med-subcenter').value = "";
      document.getElementById('med-village').innerHTML = '<option value="">Choose Village...</option>';
      document.getElementById('med-village').disabled = true;
      document.getElementById('med-name').value = "";
      document.getElementById('med-opening').value = "";
      document.getElementById('med-received').value = "";
      document.getElementById('med-distributed').value = "";
      document.getElementById('med-closing').value = "0";
      document.getElementById('med-damaged').value = "";

      // Go back to Home and Refresh
      showView('home');
      fetchDashboardReports();
    } else {
      showToast(result.message || "Submission failed.", "error");
    }
  } catch (err) {
    console.error("Med Submission Error", err);
    showToast("Server communication error.", "error");
  } finally {
    hideLoader();
  }
}

// 4. Fetch Submitted Reports (All types) from Backend
async function fetchDashboardReports() {
  if (!currentUser || !dbData) return;

  const month = document.getElementById('dash-month').value;

  try {
    // 1. Fetch BSC reports (Village-wise)
    const bscPayload = { action: 'getReports', block: currentUser.block, phc: currentUser.phc, month };
    const bscRes = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(bscPayload)
    });
    const bscResult = await bscRes.json();
    if (bscResult.success) {
      submittedReportsList = bscResult.reports || [];
    }

    // 2. Fetch Medicine reports
    const medPayload = { action: 'getMedicineReports', block: currentUser.block, phc: currentUser.phc, month };
    const medRes = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(medPayload)
    });
    const medResult = await medRes.json();
    if (medResult.success) {
      submittedMedReportsList = medResult.reports || [];
    }

    // 3. Fetch Source-wise reports (Subcenter level)
    const srcPayload = { action: 'getSourceWiseReports', block: currentUser.block, phc: currentUser.phc, month };
    const srcRes = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(srcPayload)
    });
    const srcResult = await srcRes.json();
    if (srcResult.success) {
      submittedSourceWiseList = srcResult.reports || [];
    }

    // Render combining everything
    renderDashboard(submittedReportsList, submittedMedReportsList);

    // If currently on BSC View, re-render the Source table to reflect loaded values
    if (!views.bsc.classList.contains('hidden')) {
      renderSourceWiseTable();
    }

  } catch (err) {
    console.error("Fetch Dashboard Error", err);
  }
}

// Helper to format YYYY-MM into a readable month label
function formatMonthLabel(monthStr) {
  if (!monthStr) return "";
  const parts = monthStr.split('-');
  const date = new Date(parts[0], parts[1] - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// 5. Render Dashboard Table Rows combining both Reports
function renderDashboard(bscSubmitted, medSubmitted) {
  const tableBody = document.getElementById('dash-table-body');
  tableBody.innerHTML = "";

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;
  const phcData = dbData[userBlock]?.[userPhc];

  if (!phcData) return;

  let totalVillagesCount = 0;
  let bscSubmittedCount = 0;
  let bscPendingCount = 0;
  let medSubmittedCount = 0;
  let medPendingCount = 0;

  // Gather all villages under this PHC and sort them
  const allVillages = [];
  Object.keys(phcData).sort().forEach(scName => {
    phcData[scName].sort().forEach(vilName => {
      allVillages.push({ subcenter: scName, village: vilName });
      totalVillagesCount++;
    });
  });

  allVillages.forEach(item => {
    const bscReport = bscSubmitted.find(r => 
      r.subcenter.toLowerCase().trim() === item.subcenter.toLowerCase().trim() && 
      r.village.toLowerCase().trim() === item.village.toLowerCase().trim()
    );

    const medReport = medSubmitted.find(r => 
      r.subcenter.toLowerCase().trim() === item.subcenter.toLowerCase().trim() && 
      r.village.toLowerCase().trim() === item.village.toLowerCase().trim()
    );

    const tr = document.createElement('tr');
    
    const tdSc = document.createElement('td');
    tdSc.textContent = item.subcenter;
    const tdVil = document.createElement('td');
    tdVil.textContent = item.village;

    // Blood Smear Status
    const tdBscStatus = document.createElement('td');
    const bscBadge = document.createElement('span');
    if (bscReport) {
      bscBadge.className = "status-badge submitted";
      bscBadge.textContent = "Submitted";
      bscSubmittedCount++;
    } else {
      bscBadge.className = "status-badge pending";
      bscBadge.textContent = "Pending";
      bscPendingCount++;
    }
    tdBscStatus.appendChild(bscBadge);

    // Medicine Status
    const tdMedStatus = document.createElement('td');
    const medBadge = document.createElement('span');
    if (medReport) {
      medBadge.className = "status-badge submitted";
      medBadge.textContent = "Submitted";
      medSubmittedCount++;
    } else {
      medBadge.className = "status-badge pending";
      medBadge.textContent = "Pending";
      medPendingCount++;
    }
    tdMedStatus.appendChild(medBadge);

    // Action Buttons
    const tdAction = document.createElement('td');
    tdAction.style.display = "flex";
    tdAction.style.gap = "8px";

    // BSC action
    const bscBtn = document.createElement('button');
    bscBtn.type = "button";
    if (bscReport) {
      bscBtn.className = "btn-table btn-table-edit";
      bscBtn.textContent = "Edit BSC";
      bscBtn.addEventListener('click', () => {
        showView('bsc');
        toggleBscSubView('village');
        populateBscFormForEdit(bscReport);
      });
    } else {
      bscBtn.className = "btn-table btn-table-fill";
      bscBtn.textContent = "Fill BSC";
      bscBtn.addEventListener('click', () => {
        showView('bsc');
        toggleBscSubView('village');
        startFillingBscReport(item.subcenter, item.village);
      });
    }
    tdAction.appendChild(bscBtn);

    // Med action
    const medBtn = document.createElement('button');
    medBtn.type = "button";
    if (medReport) {
      medBtn.className = "btn-table btn-table-edit";
      medBtn.textContent = "Edit Med";
      medBtn.addEventListener('click', () => {
        showView('medicine');
        populateMedFormForEdit(medReport);
      });
    } else {
      medBtn.className = "btn-table btn-table-fill";
      medBtn.textContent = "Fill Med";
      medBtn.addEventListener('click', () => {
        showView('medicine');
        startFillingMedReport(item.subcenter, item.village);
      });
    }
    tdAction.appendChild(medBtn);

    tr.appendChild(tdSc);
    tr.appendChild(tdVil);
    tr.appendChild(tdBscStatus);
    tr.appendChild(tdMedStatus);
    tdAction.appendChild(bscBtn);
    tdAction.appendChild(medBtn);
    tr.appendChild(tdAction);
    tableBody.appendChild(tr);
  });

  // Update counts
  document.getElementById('stat-total-villages').textContent = totalVillagesCount;
  document.getElementById('stat-bsc-submitted').textContent = bscSubmittedCount;
  document.getElementById('stat-bsc-pending').textContent = bscPendingCount;
  document.getElementById('stat-med-submitted').textContent = medSubmittedCount;
  document.getElementById('stat-med-pending').textContent = medPendingCount;
}

// 6. Action Handlers for Dashboard Form Toggling
function startFillingBscReport(subcenter, village) {
  const scSelect = document.getElementById('report-subcenter');
  scSelect.value = subcenter;
  const event = new Event('change');
  scSelect.dispatchEvent(event);
  document.getElementById('report-village').value = village;
}

function populateBscFormForEdit(report) {
  const scSelect = document.getElementById('report-subcenter');
  scSelect.value = report.subcenter;
  const event = new Event('change');
  scSelect.dispatchEvent(event);
  document.getElementById('report-village').value = report.village;

  document.getElementById('metric-target').value = report.target;
  document.getElementById('metric-active').value = report.active;
  document.getElementById('metric-passive').value = report.passive;
  document.getElementById('metric-total').value = report.total;
  document.getElementById('metric-positive').value = report.positive;
  document.getElementById('metric-pf').value = report.pf;
  document.getElementById('metric-pv').value = report.pv;
  document.getElementById('metric-rt').value = report.rt;

  checkPositivesWarning();
  showToast(`Editing Blood Smear report for ${report.village} Village`, "success");
}

function startFillingMedReport(subcenter, village) {
  const scSelect = document.getElementById('med-subcenter');
  scSelect.value = subcenter;
  const event = new Event('change');
  scSelect.dispatchEvent(event);
  document.getElementById('med-village').value = village;
}

function populateMedFormForEdit(report) {
  const scSelect = document.getElementById('med-subcenter');
  scSelect.value = report.subcenter;
  const event = new Event('change');
  scSelect.dispatchEvent(event);
  document.getElementById('med-village').value = report.village;

  document.getElementById('med-name').value = report.medicineName;
  document.getElementById('med-opening').value = report.opening;
  document.getElementById('med-received').value = report.received;
  document.getElementById('med-distributed').value = report.distributed;
  document.getElementById('med-closing').value = report.closing;
  document.getElementById('med-damaged').value = report.damaged;

  showToast(`Editing Medicine report for ${report.village} Village`, "success");
}
