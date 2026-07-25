// Configuration
// The user will replace this with their Google Apps Script Web App URL after deployment
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxrVrKoM3iFHVP4Cc0V9Gxrk3vevvCMu6rmQ9ouw4zjH94ohp0uXlHCYlGEqpgqxZmh/exec";

// State Management
let dbData = null;
let currentUser = null; // Stores { email, phc, block }
let submittedReportsList = []; // Blood Smear reports (Village-wise)
let submittedMedReportsList = []; // Medicine reports
let submittedSourceWiseList = []; // Source-wise reports (Subcenter level)
let isEditingSource = false;
let isEditingVillage = false;

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

// Set up Blood Smear Collection Form default months
function setupReportingForm() {
  if (!currentUser || !dbData) return;

  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  
  const dashMonth = document.getElementById('dash-month');
  dashMonth.value = `${yyyy}-${mm}`;
  document.getElementById('source-month').value = `${yyyy}-${mm}`;
  document.getElementById('village-month').value = `${yyyy}-${mm}`;
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
    isEditingSource = false;
    isEditingVillage = false;
    const newMonth = e.target.value;
    document.getElementById('source-month').value = newMonth;
    document.getElementById('village-month').value = newMonth;
    document.getElementById('med-month').value = newMonth;
    fetchDashboardReports();
  });

  // Medicine form calculations
  document.getElementById('med-opening').addEventListener('input', calculateClosingStock);
  document.getElementById('med-received').addEventListener('input', calculateClosingStock);
  document.getElementById('med-distributed').addEventListener('input', calculateClosingStock);

  // Form Submissions
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('form-medicine').addEventListener('submit', handleMedicineSubmission);
  document.getElementById('form-source-wise').addEventListener('submit', handleSourceWiseSubmission);
  document.getElementById('form-village-wise').addEventListener('submit', handleVillageWiseSubmission);

  // Download Excel Buttons
  document.getElementById('btn-download-source').addEventListener('click', downloadSourceWiseExcel);
  document.getElementById('btn-download-village').addEventListener('click', downloadVillageWiseExcel);
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
    renderVillageWiseTable();
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

  const locations = [`${userPhc} PHC (HQ)`, ...Object.keys(phcData).sort()];
  const isSubmitted = submittedSourceWiseList.length > 0;
  const statusBanner = document.getElementById('source-status-banner');
  const btnSubmit = document.getElementById('btn-submit-source');

  // Handle Edit/Read-only States
  if (isSubmitted && !isEditingSource) {
    statusBanner.innerHTML = `<span>🟢 Source-wise report submitted for this month.</span>
      <button type="button" id="btn-edit-source-mode">✏️ Edit Report</button>`;
    statusBanner.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  } else {
    statusBanner.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  }

  locations.forEach((loc, idx) => {
    // Robust comparison for saved data (handles "Nandgaon PHC" matching "Nandgaon PHC (HQ)")
    const saved = submittedSourceWiseList.find(s => {
      const sName = s.locationName.toLowerCase().replace(' phc', '').replace('(hq)', '').trim();
      const lName = loc.toLowerCase().replace(' phc', '').replace('(hq)', '').trim();
      return sName === lName;
    });

    const tr = document.createElement('tr');
    tr.dataset.location = loc;

    const tdName = document.createElement('td');
    tdName.innerHTML = `<strong>${loc}</strong>`;
    tr.appendChild(tdName);

    const fields = ['population', 'opd', 'opdBs', 'anmBs', 'mpwBs', 'anmNhmBs', 'ashaBs'];

    fields.forEach(field => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = "number";
      input.min = "0";
      input.className = "input-sm";
      input.value = saved ? (saved[field] !== undefined ? saved[field] : "0") : "";
      input.placeholder = "0";
      input.style.width = "100%";
      
      // Disable inputs if submitted and not in edit mode
      if (isSubmitted && !isEditingSource) {
        input.disabled = true;
      }

      input.addEventListener('input', () => {
        calculateRowTotal(tr);
        reconcileActivePassive();
      });

      td.appendChild(input);
      tr.appendChild(td);
    });

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

  // Bind Edit mode trigger
  if (isSubmitted && !isEditingSource) {
    document.getElementById('btn-edit-source-mode').addEventListener('click', () => {
      isEditingSource = true;
      renderSourceWiseTable();
    });
  }

  reconcileActivePassive();
}

// Calculate row total in the Source Table
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

// Render dynamic Village-wise input table (Tab B)
function renderVillageWiseTable() {
  const tbody = document.getElementById('village-wise-table-body');
  tbody.innerHTML = "";

  if (!currentUser || !dbData) return;

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;
  const phcData = dbData[userBlock]?.[userPhc];

  if (!phcData) return;

  const isSubmitted = submittedReportsList.length > 0;
  const statusBanner = document.getElementById('village-status-banner');
  const btnSubmit = document.getElementById('btn-submit-village');

  // Handle Edit/Read-only States
  if (isSubmitted && !isEditingVillage) {
    statusBanner.innerHTML = `<span>🟢 Village-wise report submitted for this month.</span>
      <button type="button" id="btn-edit-village-mode">✏️ Edit Report</button>`;
    statusBanner.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  } else {
    statusBanner.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  }

  let srNo = 1;
  Object.keys(phcData).sort().forEach(scName => {
    phcData[scName].sort().forEach(vilName => {
      const saved = submittedReportsList.find(r => 
        r.subcenter.toLowerCase().trim() === scName.toLowerCase().trim() && 
        r.village.toLowerCase().trim() === vilName.toLowerCase().trim()
      );

      const tr = document.createElement('tr');
      tr.dataset.subcenter = scName;
      tr.dataset.village = vilName;

      // Sr No
      const tdSr = document.createElement('td');
      tdSr.textContent = srNo++;
      tr.appendChild(tdSr);

      // Subcenter Name
      const tdSc = document.createElement('td');
      tdSc.textContent = scName;
      tr.appendChild(tdSc);

      // Village Name
      const tdVil = document.createElement('td');
      tdVil.textContent = vilName;
      tr.appendChild(tdVil);

      // Population Input
      const tdPop = document.createElement('td');
      const inputPop = document.createElement('input');
      inputPop.type = "number";
      inputPop.min = "0";
      inputPop.className = "input-sm";
      inputPop.value = saved ? (saved.target !== undefined ? saved.target : "0") : "";
      inputPop.placeholder = "0";
      inputPop.style.width = "100%";
      if (isSubmitted && !isEditingVillage) {
        inputPop.disabled = true;
      }
      tdPop.appendChild(inputPop);
      tr.appendChild(tdPop);

      // Active BS Collected Input
      const tdActive = document.createElement('td');
      const inputActive = document.createElement('input');
      inputActive.type = "number";
      inputActive.min = "0";
      inputActive.className = "input-sm";
      inputActive.value = saved ? (saved.active !== undefined ? saved.active : "0") : "";
      inputActive.placeholder = "0";
      inputActive.style.width = "100%";
      if (isSubmitted && !isEditingVillage) {
        inputActive.disabled = true;
      }
      inputActive.addEventListener('input', () => {
        calculateVillageRowTotal(tr);
        reconcileActivePassive();
      });
      tdActive.appendChild(inputActive);
      tr.appendChild(tdActive);

      // Passive BS Collected Input
      const tdPassive = document.createElement('td');
      const inputPassive = document.createElement('input');
      inputPassive.type = "number";
      inputPassive.min = "0";
      inputPassive.className = "input-sm";
      inputPassive.value = saved ? (saved.passive !== undefined ? saved.passive : "0") : "";
      inputPassive.placeholder = "0";
      inputPassive.style.width = "100%";
      if (isSubmitted && !isEditingVillage) {
        inputPassive.disabled = true;
      }
      inputPassive.addEventListener('input', () => {
        calculateVillageRowTotal(tr);
        reconcileActivePassive();
      });
      tdPassive.appendChild(inputPassive);
      tr.appendChild(tdPassive);

      // Total BS Collected (Read-only)
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
      calculateVillageRowTotal(tr);
    });
  });

  // Bind Edit mode trigger
  if (isSubmitted && !isEditingVillage) {
    document.getElementById('btn-edit-village-mode').addEventListener('click', () => {
      isEditingVillage = true;
      renderVillageWiseTable();
    });
  }

  reconcileActivePassive();
}

// Calculate village row total
function calculateVillageRowTotal(tr) {
  const inputs = tr.querySelectorAll('input');
  const active = parseInt(inputs[1].value) || 0;
  const passive = parseInt(inputs[2].value) || 0;
  inputs[3].value = active + passive;
}

// Reconciliation check: compares Source-wise table totals against Village-wise table totals
function reconcileActivePassive() {
  const sourceBody = document.getElementById('source-wise-table-body');
  const sourceRows = sourceBody.querySelectorAll('tr');

  let sourceActiveTotal = 0;
  let sourcePassiveTotal = 0;

  sourceRows.forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length >= 8) {
      sourcePassiveTotal += parseInt(inputs[2].value) || 0;
      sourceActiveTotal += (parseInt(inputs[3].value) || 0) +
                           (parseInt(inputs[4].value) || 0) +
                           (parseInt(inputs[5].value) || 0) +
                           (parseInt(inputs[6].value) || 0);
    }
  });

  // Calculate Village-wise Totals from the Village table or from submittedReportsList
  let villageActiveTotal = 0;
  let villagePassiveTotal = 0;

  const villageBody = document.getElementById('village-wise-table-body');
  const villageRows = villageBody.querySelectorAll('tr');

  if (villageRows && villageRows.length > 0) {
    // If the village table is rendered, calculate from the active inputs
    villageRows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs.length >= 4) {
        villageActiveTotal += parseInt(inputs[1].value) || 0;
        villagePassiveTotal += parseInt(inputs[2].value) || 0;
      }
    });
  } else {
    // Otherwise calculate from loaded submitted list
    submittedReportsList.forEach(report => {
      villageActiveTotal += parseInt(report.active) || 0;
      villagePassiveTotal += parseInt(report.passive) || 0;
    });
  }

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

  // Overwrite Prompt if already submitted
  if (submittedSourceWiseList && submittedSourceWiseList.length > 0) {
    const proceed = confirm(`A Source-wise report has already been submitted for ${formatMonthLabel(month)}. Do you want to edit and overwrite the existing report?`);
    if (!proceed) return;
  }

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
      isEditingSource = false;
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

// Submit Village-wise Reports (Batch submission)
async function handleVillageWiseSubmission(e) {
  e.preventDefault();

  const month = document.getElementById('village-month').value;

  // Overwrite Prompt if already submitted
  if (submittedReportsList && submittedReportsList.length > 0) {
    const proceed = confirm(`A Village-wise report has already been submitted for ${formatMonthLabel(month)}. Do you want to edit and overwrite the existing report?`);
    if (!proceed) return;
  }

  const tbody = document.getElementById('village-wise-table-body');
  const rows = tbody.querySelectorAll('tr');

  const rowsData = [];
  rows.forEach(tr => {
    const subcenter = tr.dataset.subcenter;
    const village = tr.dataset.village;
    const inputs = tr.querySelectorAll('input');
    
    rowsData.push({
      subcenter: subcenter,
      village: village,
      target: parseInt(inputs[0].value) || 0, // population field
      active: parseInt(inputs[1].value) || 0,
      passive: parseInt(inputs[2].value) || 0,
      total: parseInt(inputs[3].value) || 0,
      positive: 0, // Defaults for batch slide collection
      pf: 0,
      pv: 0,
      rt: 0
    });
  });

  showLoader("Submitting Village-wise reports...");
  try {
    const payload = {
      action: 'submitReport',
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
      isEditingVillage = false;
      showToast(result.message || "Village-wise reports saved successfully!", "success");
      fetchDashboardReports(); // Reload data
    } else {
      showToast(result.message || "Failed to submit.", "error");
    }
  } catch (err) {
    console.error("Village submission error", err);
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

    // Update submit button colors based on month status
    const btnSubmitSource = document.getElementById('btn-submit-source');
    const btnDownloadSource = document.getElementById('btn-download-source');
    if (submittedSourceWiseList && submittedSourceWiseList.length > 0) {
      btnSubmitSource.classList.remove('btn-pending');
      btnSubmitSource.classList.add('btn-submitted');
      btnSubmitSource.textContent = "Update Source-wise Report";
      btnDownloadSource.classList.remove('hidden');
    } else {
      btnSubmitSource.classList.add('btn-pending');
      btnSubmitSource.classList.remove('btn-submitted');
      btnSubmitSource.textContent = "Submit Source-wise Report";
      btnDownloadSource.classList.add('hidden');
    }

    const btnSubmitVillage = document.getElementById('btn-submit-village');
    const btnDownloadVillage = document.getElementById('btn-download-village');
    if (submittedReportsList && submittedReportsList.length > 0) {
      btnSubmitVillage.classList.remove('btn-pending');
      btnSubmitVillage.classList.add('btn-submitted');
      btnSubmitVillage.textContent = "Update Village-wise Report";
      btnDownloadVillage.classList.remove('hidden');
    } else {
      btnSubmitVillage.classList.add('btn-pending');
      btnSubmitVillage.classList.remove('btn-submitted');
      btnSubmitVillage.textContent = "Submit Village-wise Report";
      btnDownloadVillage.classList.add('hidden');
    }

    // If currently on BSC View, re-render the active tab
    if (!views.bsc.classList.contains('hidden')) {
      const activeTab = document.getElementById('btn-tab-source').classList.contains('active') ? 'source' : 'village';
      if (activeTab === 'source') {
        renderSourceWiseTable();
      } else {
        renderVillageWiseTable();
      }
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
        // Wait, since we are using tabular format now, we just highlight the row or scroll to the table
        showToast(`Locate ${item.village} in the Village-wise table to edit`, "success");
      });
    } else {
      bscBtn.className = "btn-table btn-table-fill";
      bscBtn.textContent = "Fill BSC";
      bscBtn.addEventListener('click', () => {
        showView('bsc');
        toggleBscSubView('village');
        showToast(`Locate ${item.village} in the Village-wise table to fill`, "success");
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

// ==================== EXCEL/CSV EXPORT HELPERS ====================

function downloadCSV(headers, rows, filename) {
  let csvContent = "\uFEFF"; // CSV BOM for Excel auto-detection
  csvContent += headers.join(",") + "\n";
  
  rows.forEach(row => {
    const rowStr = row.map(val => {
      let cell = val === null || val === undefined ? "" : val.toString();
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        cell = `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",");
    csvContent += rowStr + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function downloadSourceWiseExcel() {
  const month = document.getElementById('source-month').value;
  const readableMonth = formatMonthLabel(month).replace(/\s+/g, '_');
  const filename = `Source_Wise_BS_Report_${currentUser.phc}_${readableMonth}.csv`;

  const headers = ["Location Name", "Population", "OPD", "OPD BS (Passive)", "ANM BS", "MPW BS", "ANM NHM BS", "ASHA BS", "Total BS"];
  const rows = [];

  const tbody = document.getElementById('source-wise-table-body');
  const tableRows = tbody.querySelectorAll('tr');

  tableRows.forEach(tr => {
    const locName = tr.dataset.location;
    const inputs = tr.querySelectorAll('input');
    
    rows.push([
      locName,
      inputs[0].value || "0",
      inputs[1].value || "0",
      inputs[2].value || "0",
      inputs[3].value || "0",
      inputs[4].value || "0",
      inputs[5].value || "0",
      inputs[6].value || "0",
      inputs[7].value || "0"
    ]);
  });

  downloadCSV(headers, rows, filename);
}

function downloadVillageWiseExcel() {
  const month = document.getElementById('village-month').value;
  const readableMonth = formatMonthLabel(month).replace(/\s+/g, '_');
  const filename = `Village_Wise_BS_Report_${currentUser.phc}_${readableMonth}.csv`;

  const headers = ["Sr No", "Subcenter", "Village", "Village Population", "Active BS Collected", "Passive BS Collected", "Total BS"];
  const rows = [];

  const tbody = document.getElementById('village-wise-table-body');
  const tableRows = tbody.querySelectorAll('tr');

  tableRows.forEach(tr => {
    const srNo = tr.querySelector('td:nth-child(1)').textContent;
    const subcenter = tr.dataset.subcenter;
    const village = tr.dataset.village;
    const inputs = tr.querySelectorAll('input');

    rows.push([
      srNo,
      subcenter,
      village,
      inputs[0].value || "0",
      inputs[1].value || "0",
      inputs[2].value || "0",
      inputs[3].value || "0"
    ]);
  });

  downloadCSV(headers, rows, filename);
}
