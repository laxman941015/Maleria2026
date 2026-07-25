// Configuration
// The user will replace this with their Google Apps Script Web App URL after deployment
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxrVrKoM3iFHVP4Cc0V9Gxrk3vevvCMu6rmQ9ouw4zjH94ohp0uXlHCYlGEqpgqxZmh/exec";

// State Management
let dbData = null;
let currentUser = null; // Stores { email, phc, block }

// DOM Elements
const views = {
  login: document.getElementById('view-login'),
  register: document.getElementById('view-register'),
  reporting: document.getElementById('view-reporting')
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
    showView('reporting');
  }

  setupEventListeners();
});

// View Routing
function showView(viewName) {
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.remove('hidden');
    } else {
      views[key].classList.add('hidden');
    }
  });

  // Manage header user badge
  const userBadge = document.getElementById('user-badge');
  if (currentUser && viewName === 'reporting') {
    document.getElementById('badge-email').textContent = currentUser.email;
    document.getElementById('badge-phc').textContent = `${currentUser.block} / ${currentUser.phc}`;
    userBadge.classList.remove('hidden');
  } else {
    userBadge.classList.add('hidden');
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

// Form Populating & Cascading
function setupRegisterDropdowns() {
  const blockSelect = document.getElementById('reg-block');
  const phcSelect = document.getElementById('reg-phc');

  // Populate Blocks
  Object.keys(dbData).sort().forEach(blockName => {
    const opt = document.createElement('option');
    opt.value = blockName;
    opt.textContent = blockName;
    blockSelect.appendChild(opt);
  });

  // Cascading PHCs
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

function setupReportingForm() {
  if (!currentUser || !dbData) return;

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;

  const scSelect = document.getElementById('report-subcenter');
  const vilSelect = document.getElementById('report-village');

  // Clear previous options
  scSelect.innerHTML = '<option value="">Choose Subcenter...</option>';
  vilSelect.innerHTML = '<option value="">Choose Village...</option>';
  vilSelect.disabled = true;

  // Retrieve subcenters for the user's logged-in PHC
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

  // Default month input to the previous month
  const monthInput = document.getElementById('report-month');
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  monthInput.value = `${yyyy}-${mm}`;
}

// Math/Calculations for Metrics
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

// Event Listeners
function setupEventListeners() {
  // Navigation Links
  document.getElementById('link-go-register').addEventListener('click', (e) => {
    e.preventDefault();
    showView('register');
  });

  document.getElementById('link-go-login').addEventListener('click', (e) => {
    e.preventDefault();
    showView('login');
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('sindhudurg_user');
    currentUser = null;
    showView('login');
    showToast("Logged out successfully.");
  });

  // Automatic Calculation Hooks
  document.getElementById('metric-active').addEventListener('input', calculateTotalBsc);
  document.getElementById('metric-passive').addEventListener('input', calculateTotalBsc);

  document.getElementById('metric-positive').addEventListener('input', checkPositivesWarning);
  document.getElementById('metric-pf').addEventListener('input', checkPositivesWarning);
  document.getElementById('metric-pv').addEventListener('input', checkPositivesWarning);

  // Form Submissions
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('form-report').addEventListener('submit', handleReportSubmission);
}

// Authentication Actions
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (BACKEND_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showToast("Error: Portal Backend URL is not configured. Please contact the administrator.", "error");
    return;
  }

  showLoader("Authenticating...");
  try {
    const payload = { action: 'login', email, password };
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      currentUser = { email: result.email, phc: result.phc, block: result.block };
      localStorage.setItem('sindhudurg_user', JSON.stringify(currentUser));
      setupReportingForm();
      showView('reporting');
      showToast("Access Granted. Welcome back!");
    } else {
      showToast(result.message || "Invalid credentials or pending approval.", "error");
    }
  } catch (err) {
    console.error("Login Error", err);
    showToast("Server communication error. Please try again.", "error");
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

  if (BACKEND_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showToast("Error: Portal Backend URL is not configured.", "error");
    return;
  }

  showLoader("Submitting registration...");
  try {
    const payload = { action: 'register', email, password, block, phc };
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast("Registration submitted. Please wait for Admin approval before logging in.", "success");
      document.getElementById('form-register').reset();
      document.getElementById('reg-phc').disabled = true;
      showView('login');
    } else {
      showToast(result.message || "Registration failed.", "error");
    }
  } catch (err) {
    console.error("Registration Error", err);
    showToast("Server communication error. Please try again.", "error");
  } finally {
    hideLoader();
  }
}

// Report Submission Action
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

  if (BACKEND_URL === "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE") {
    showToast("Error: Backend URL is not configured.", "error");
    return;
  }

  showLoader("Submitting monthly report...");
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      showToast("Report submitted successfully!", "success");
      // Reset inputs under metrics sections
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
    } else {
      showToast(result.message || "Report submission failed.", "error");
    }
  } catch (err) {
    console.error("Report Submission Error", err);
    showToast("Server communication error. Please try again.", "error");
  } finally {
    hideLoader();
  }
}
