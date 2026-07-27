// Configuration
// The user will replace this with their Google Apps Script Web App URL after deployment
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxrVrKoM3iFHVP4Cc0V9Gxrk3vevvCMu6rmQ9ouw4zjH94ohp0uXlHCYlGEqpgqxZmh/exec";

// State Management
let dbData = null;
let currentUser = null; // Stores { email, phc, block }
let submittedReportsList = []; // Blood Smear reports (Village-wise)
let submittedMedReportsList = []; // Medicine reports
let submittedSourceWiseList = []; // Source-wise reports (Subcenter level)
let submittedDengueList = []; // Dengue Positive reports
let isEditingSource = false;
let isEditingVillage = false;
let isEditingMedicine = false;
let isEditingDengue = false;

// DOM Elements
const views = {
  login: document.getElementById('view-login'),
  register: document.getElementById('view-register'),
  home: document.getElementById('view-home'),
  bsc: document.getElementById('view-bsc'),
  medicine: document.getElementById('view-medicine'),
  dengue: document.getElementById('view-dengue'),
  admin: document.getElementById('view-admin')
};

const navItems = {
  home: document.getElementById('nav-home'),
  bsc: document.getElementById('nav-bsc'),
  medicine: document.getElementById('nav-medicine'),
  dengue: document.getElementById('nav-dengue'),
  admin: document.getElementById('nav-admin')
};

const loader = {
  overlay: document.getElementById('loading-spinner'),
  text: document.getElementById('loading-text')
};

const toast = document.getElementById('toast');

const MEDICINE_ITEMS = [
  { category: "A) Anti Malaria Drugs", name: "Tab.Chloroquine 250 mg" },
  { category: "A) Anti Malaria Drugs", name: "Tab.Chloroquine 600 mg" },
  { category: "A) Anti Malaria Drugs", name: "Syp.Chloroquine 100 ml" },
  { category: "A) Anti Malaria Drugs", name: "Tab.Primaquine 15 mg" },
  { category: "A) Anti Malaria Drugs", name: "Tab.Primaquine 7.5 mg" },
  { category: "A) Anti Malaria Drugs", name: "Tab.Primaquine 2.5 mg" },
  { category: "A) Anti Malaria Drugs", name: "ACT (Adult)" },
  { category: "A) Anti Malaria Drugs", name: "ACT (9-14 yrs)" },
  { category: "A) Anti Malaria Drugs", name: "ACT (5-8 yrs)" },
  { category: "A) Anti Malaria Drugs", name: "ACT (1-4 yrs)" },
  { category: "A) Anti Malaria Drugs", name: "ACT (0-1 yrs)" },
  { category: "A) Anti Malaria Drugs", name: "Tab. DEC 100 mg" },
  { category: "A) Anti Malaria Drugs", name: "Tab.Quinine 300 mg" },
  { category: "A) Anti Malaria Drugs", name: "Inj.Quinine 2 ml (Ampules)" },
  { category: "A) Anti Malaria Drugs", name: "Artesunate Inj. 2 ml" },
  { category: "A) Anti Malaria Drugs", name: "Tab.Paracetamol 500 mg" },
  { category: "A) Anti Malaria Drugs", name: "Sy.Paracetamol (100 ml bottle)" },
  { category: "A) Anti Malaria Drugs", name: "Tab. Albendezole 400 mg" },
  { category: "A) Anti Malaria Drugs", name: "Cap.Doxycycline 100 mg" },

  { category: "B) Lab Materials", name: "Malaria Staining Kit (Stain A &B)" },
  { category: "B) Lab Materials", name: "Microslides (Nos)" },
  { category: "B) Lab Materials", name: "Pricking lancets (Nos)" },
  { category: "B) Lab Materials", name: "Cotton Swab" },
  { category: "B) Lab Materials", name: "Slide Box ( 25 slides)" },
  { category: "B) Lab Materials", name: "Slide Box (50 Slides)" },
  { category: "B) Lab Materials", name: "Microscope (Monocular)" },
  { category: "B) Lab Materials", name: "Microscope (Binocular)" },
  { category: "B) Lab Materials", name: "Digital Microscope" },
  { category: "B) Lab Materials", name: "Eye piece 10x" },
  { category: "B) Lab Materials", name: "Eye piece 5x" },
  { category: "B) Lab Materials", name: "Oil immersion lence 100x" },
  { category: "B) Lab Materials", name: "RDK" },
  { category: "B) Lab Materials", name: "Liquid Paraffin Bottel 500ml" },
  { category: "B) Lab Materials", name: "Cedar Wood Oil" },
  { category: "B) Lab Materials", name: "Microscope Halogen Bulb" },

  { category: "C) Insecticide/Larvacide", name: "Alpha Cypermethrin 5% W.P.(" },
  { category: "C) Insecticide/Larvacide", name: "Lambda Cy Halothrine 10% W.P" },
  { category: "C) Insecticide/Larvacide", name: "Pyrethrum Extract 2%" },
  { category: "C) Insecticide/Larvacide", name: "Temephos 50% EC" },
  { category: "C) Insecticide/Larvacide", name: "Cyphenothrin" },
  { category: "C) Insecticide/Larvacide", name: "Biolarvicide powder (Bti)" },
  { category: "C) Insecticide/Larvacide", name: "Deltamethrin 2.5% Flow" },
  { category: "C) Insecticide/Larvacide", name: "Malathion 5%" },

  { category: "D) Equipments", name: "Fogging Machines" },
  { category: "D) Equipments", name: "Knapsack Pump" },
  { category: "D) Equipments", name: "Stirrup Pump" },
  { category: "D) Equipments", name: "PVC Appron" },
  { category: "D) Equipments", name: "Safety Goggles" },
  { category: "D) Equipments", name: "Spraying Hand Gloves" },
  { category: "D) Equipments", name: "Wellnet" },
  { category: "D) Equipments", name: "Handnet" },
  { category: "D) Equipments", name: "Bednet" }
];

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

    // Show admin nav only for admin role
    const adminSection = document.getElementById('admin-nav-section');
    if (currentUser.role === 'Admin') {
      adminSection.style.display = '';
    } else {
      adminSection.style.display = 'none';
    }

    Object.keys(navItems).forEach(key => {
      if (navItems[key]) {
        if (key === viewName) {
          navItems[key].classList.add('active');
        } else {
          navItems[key].classList.remove('active');
        }
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

// ---- Month Select Helpers ----
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Populate year and month <select> elements for the given prefix (source, village, med)
function populateMonthSelects(prefix, defaultYYYYMM) {
  const yearSel = document.getElementById(`${prefix}-year`);
  const monthSel = document.getElementById(`${prefix}-month-select`);
  if (!yearSel || !monthSel) return;

  // Years: current year down to 5 years back
  yearSel.innerHTML = '';
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  }

  // Months: January to December
  monthSel.innerHTML = '';
  MONTH_NAMES.forEach((name, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx + 1).padStart(2, '0');
    opt.textContent = name;
    monthSel.appendChild(opt);
  });

  // Set default selection
  if (defaultYYYYMM) {
    const [y, m] = defaultYYYYMM.split('-');
    yearSel.value = y;
    monthSel.value = m;
  }
}

// Read combined YYYY-MM from a prefix's two selects
function getFormMonth(prefix) {
  const yearSel = document.getElementById(`${prefix}-year`);
  const monthSel = document.getElementById(`${prefix}-month-select`);
  if (!yearSel || !monthSel) return '';
  return `${yearSel.value}-${monthSel.value}`;
}

// Set two selects from a YYYY-MM string
function setFormMonth(prefix, yyyymm) {
  const yearSel = document.getElementById(`${prefix}-year`);
  const monthSel = document.getElementById(`${prefix}-month-select`);
  if (!yearSel || !monthSel || !yyyymm) return;
  const [y, m] = yyyymm.split('-');
  yearSel.value = y;
  monthSel.value = m;
}

// Set up Blood Smear Collection Form default months
function setupReportingForm() {
  if (!currentUser || !dbData) return;

  const d = new Date();
  // Default to previous month
  d.setMonth(d.getMonth() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const defaultMonth = `${yyyy}-${mm}`;

  const dashMonth = document.getElementById('dash-month');
  dashMonth.value = defaultMonth;

  // Populate the year+month dropdowns for all forms
  populateMonthSelects('source', defaultMonth);
  populateMonthSelects('village', defaultMonth);
  populateMonthSelects('med', defaultMonth);
  populateMonthSelects('dengue', defaultMonth);

  // Initial fetch of dashboard data
  fetchDashboardReports();
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

  navItems.medicine.addEventListener('click', (e) => {
    e.preventDefault();
    showView('medicine');
    renderMedicineTable();
  });

  navItems.dengue.addEventListener('click', (e) => {
    e.preventDefault();
    showView('dengue');
    renderDengueTable();
  });

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

  // Dashboard month changes: reset edit state + refetch dashboard only
  document.getElementById('dash-month').addEventListener('change', (e) => {
    isEditingSource = false;
    isEditingVillage = false;
    isEditingMedicine = false;
    isEditingDengue = false;
    fetchDashboardReports();
  });

  // BSC Source-wise: re-fetch when user changes year or month
  const onSourceMonthChange = () => {
    isEditingSource = false;
    fetchSourceWiseReport();
  };
  const srcYear = document.getElementById('source-year');
  const srcMonth = document.getElementById('source-month-select');
  if (srcYear) srcYear.addEventListener('change', onSourceMonthChange);
  if (srcMonth) srcMonth.addEventListener('change', onSourceMonthChange);

  // BSC Village-wise: re-fetch when user changes year or month
  const onVillageMonthChange = () => {
    isEditingVillage = false;
    fetchVillageWiseReport();
  };
  const vilYear = document.getElementById('village-year');
  const vilMonth = document.getElementById('village-month-select');
  if (vilYear) vilYear.addEventListener('change', onVillageMonthChange);
  if (vilMonth) vilMonth.addEventListener('change', onVillageMonthChange);

  // Medicine: re-fetch when user changes year or month
  const onMedMonthChange = () => {
    isEditingMedicine = false;
    fetchMedicineReport();
  };
  const medYear = document.getElementById('med-year');
  const medMonth = document.getElementById('med-month-select');
  if (medYear) medYear.addEventListener('change', onMedMonthChange);
  if (medMonth) medMonth.addEventListener('change', onMedMonthChange);

  // Dengue: re-fetch when user changes year or month
  const onDengueMonthChange = () => {
    isEditingDengue = false;
    fetchDengueReport();
  };
  const dengueYear = document.getElementById('dengue-year');
  const dengueMonth = document.getElementById('dengue-month-select');
  if (dengueYear) dengueYear.addEventListener('change', onDengueMonthChange);
  if (dengueMonth) dengueMonth.addEventListener('change', onDengueMonthChange);

  // Form Submissions
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('form-medicine').addEventListener('submit', handleMedicineSubmission);
  document.getElementById('form-source-wise').addEventListener('submit', handleSourceWiseSubmission);
  document.getElementById('form-village-wise').addEventListener('submit', handleVillageWiseSubmission);
  document.getElementById('form-dengue').addEventListener('submit', handleDengueSubmission);

  // Download Excel Buttons
  document.getElementById('btn-download-source').addEventListener('click', downloadSourceWiseExcel);
  document.getElementById('btn-download-village').addEventListener('click', downloadVillageWiseExcel);
  document.getElementById('btn-download-medicine').addEventListener('click', downloadMedicineExcel);
  document.getElementById('btn-download-dengue').addEventListener('click', downloadDengueExcel);

  // Admin nav
  if (navItems.admin) {
    navItems.admin.addEventListener('click', (e) => {
      e.preventDefault();
      showView('admin');
      fetchAdminOverview();
    });
  }

  // Admin month picker change
  const adminMonthInput = document.getElementById('admin-month');
  if (adminMonthInput) {
    adminMonthInput.addEventListener('change', () => {
      fetchAdminOverview();
    });
  }
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
  const activeBadge = document.getElementById('recon-active-status');
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

  if (matched) {
    warningDiv.classList.add('hidden');
  } else {
    warningDiv.classList.remove('hidden');
  }
}

// Submit Source-wise Report
async function handleSourceWiseSubmission(e) {
  e.preventDefault();

  const month = getFormMonth('source');

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

  const month = getFormMonth('village');

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
      currentUser = { email: result.email, phc: result.phc, block: result.block, role: result.role || 'User' };
      localStorage.setItem('sindhudurg_user', JSON.stringify(currentUser));

      if (currentUser.role === 'Admin') {
        // Admin goes directly to admin overview
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        document.getElementById('admin-month').value = `${yyyy}-${mm}`;
        showView('admin');
        fetchAdminOverview();
        showToast("Welcome, Admin!");
      } else {
        setupReportingForm();
        showView('home');
        showToast("Access Granted. Welcome back!");
      }
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

// 4. Fetch Submitted Reports (All types) from Backend
// Standalone: Fetch & render Source-wise report for the selected month in the form
async function fetchSourceWiseReport() {
  if (!currentUser || !dbData) return;
  const month = getFormMonth('source');
  if (!month) return;
  showLoader('Loading Source-wise report...');
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'getSourceWiseReports', block: currentUser.block, phc: currentUser.phc, month })
    });
    const result = await res.json();
    if (result.success) {
      submittedSourceWiseList = result.reports || [];
      const btn = document.getElementById('btn-submit-source');
      const dl = document.getElementById('btn-download-source');
      if (submittedSourceWiseList.length > 0) {
        btn.classList.replace('btn-pending', 'btn-submitted');
        btn.textContent = 'Update Source-wise Report';
        dl.classList.remove('hidden');
      } else {
        btn.classList.replace('btn-submitted', 'btn-pending');
        btn.textContent = 'Submit Source-wise Report';
        dl.classList.add('hidden');
      }
      renderSourceWiseTable();
    }
  } catch (err) {
    showToast('Error loading Source-wise report.', 'error');
  } finally { hideLoader(); }
}

// Standalone: Fetch & render Village-wise report for the selected month in the form
async function fetchVillageWiseReport() {
  if (!currentUser || !dbData) return;
  const month = getFormMonth('village');
  if (!month) return;
  showLoader('Loading Village-wise report...');
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'getReports', block: currentUser.block, phc: currentUser.phc, month })
    });
    const result = await res.json();
    if (result.success) {
      submittedReportsList = result.reports || [];
      const btn = document.getElementById('btn-submit-village');
      const dl = document.getElementById('btn-download-village');
      if (submittedReportsList.length > 0) {
        btn.classList.replace('btn-pending', 'btn-submitted');
        btn.textContent = 'Update Village-wise Report';
        dl.classList.remove('hidden');
      } else {
        btn.classList.replace('btn-submitted', 'btn-pending');
        btn.textContent = 'Submit Village-wise Report';
        dl.classList.add('hidden');
      }
      renderVillageWiseTable();
    }
  } catch (err) {
    showToast('Error loading Village-wise report.', 'error');
  } finally { hideLoader(); }
}

// Standalone: Fetch & render Medicine report for the selected month in the form
async function fetchMedicineReport() {
  if (!currentUser || !dbData) return;
  const month = getFormMonth('med');
  if (!month) return;
  showLoader('Loading Medicine report...');
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST', mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'getMedicineReports', block: currentUser.block, phc: currentUser.phc, month })
    });
    const result = await res.json();
    if (result.success) {
      submittedMedReportsList = result.reports || [];
      const btn = document.getElementById('btn-submit-medicine');
      const dl = document.getElementById('btn-download-medicine');
      if (submittedMedReportsList.length > 0) {
        btn.classList.replace('btn-pending', 'btn-submitted');
        btn.textContent = 'Update Medicine Report';
        dl.classList.remove('hidden');
      } else {
        btn.classList.replace('btn-submitted', 'btn-pending');
        btn.textContent = 'Submit Medicine Report';
        dl.classList.add('hidden');
      }
      renderMedicineTable();
    }
  } catch (err) {
    showToast('Error loading Medicine report.', 'error');
  } finally { hideLoader(); }
}

async function fetchDashboardReports() {
  if (!currentUser || !dbData) return;

  const month = document.getElementById('dash-month').value;
  showLoader("Fetching monthly reports...");

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

    // 2. Fetch Medicine reports (PHC wide)
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

    // 4. Fetch Dengue Positive reports
    const denguePayload = { action: 'getDengueReports', block: currentUser.block, phc: currentUser.phc, month };
    const dengueRes = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(denguePayload)
    });
    const dengueResult = await dengueRes.json();
    if (dengueResult.success) {
      submittedDengueList = dengueResult.reports || [];
    }

    // Render combining everything
    renderDashboard(submittedReportsList, submittedMedReportsList, submittedDengueList);

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

    const btnSubmitMedicine = document.getElementById('btn-submit-medicine');
    const btnDownloadMedicine = document.getElementById('btn-download-medicine');
    const statMedBadge = document.getElementById('stat-med-status-badge');
    if (submittedMedReportsList && submittedMedReportsList.length > 0) {
      btnSubmitMedicine.classList.remove('btn-pending');
      btnSubmitMedicine.classList.add('btn-submitted');
      btnSubmitMedicine.textContent = "Update Medicine Report";
      btnDownloadMedicine.classList.remove('hidden');
      statMedBadge.textContent = "Submitted";
      statMedBadge.className = "status-badge submitted";
    } else {
      btnSubmitMedicine.classList.add('btn-pending');
      btnSubmitMedicine.classList.remove('btn-submitted');
      btnSubmitMedicine.textContent = "Submit Medicine Report";
      btnDownloadMedicine.classList.add('hidden');
      statMedBadge.textContent = "Pending";
      statMedBadge.className = "status-badge pending";
    }

    const btnSubmitDengue = document.getElementById('btn-submit-dengue');
    const btnDownloadDengue = document.getElementById('btn-download-dengue');
    if (submittedDengueList && submittedDengueList.length > 0) {
      btnSubmitDengue.classList.remove('btn-pending');
      btnSubmitDengue.classList.add('btn-submitted');
      btnSubmitDengue.textContent = "Update Dengue Report";
      btnDownloadDengue.classList.remove('hidden');
    } else {
      btnSubmitDengue.classList.add('btn-pending');
      btnSubmitDengue.classList.remove('btn-submitted');
      btnSubmitDengue.textContent = "Submit Dengue Report";
      btnDownloadDengue.classList.add('hidden');
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

    // If currently on Medicine View, re-render the table
    if (!views.medicine.classList.contains('hidden')) {
      renderMedicineTable();
    }

    // If currently on Dengue View, re-render the table
    if (!views.dengue.classList.contains('hidden')) {
      renderDengueTable();
    }

  } catch (err) {
    console.error("Fetch Dashboard Error", err);
  } finally {
    hideLoader();
  }
}

// Helper to format YYYY-MM into a readable month label
function formatMonthLabel(monthStr) {
  if (!monthStr) return "";
  const parts = monthStr.split('-');
  const date = new Date(parts[0], parts[1] - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// 5. Render Dashboard Summary Status Cards
function renderDashboard(bscSubmitted, medSubmitted, dengueSubmitted) {
  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;
  const phcData = dbData[userBlock]?.[userPhc];

  if (!phcData) return;

  let totalVillagesCount = 0;
  let bscSubmittedCount = 0;
  let bscPendingCount = 0;

  // Gather all villages under this PHC and count them
  Object.keys(phcData).forEach(scName => {
    phcData[scName].forEach(vilName => {
      totalVillagesCount++;
      const bscReport = bscSubmitted.find(r =>
        r.subcenter.toLowerCase().trim() === scName.toLowerCase().trim() &&
        r.village.toLowerCase().trim() === vilName.toLowerCase().trim()
      );
      if (bscReport) {
        bscSubmittedCount++;
      } else {
        bscPendingCount++;
      }
    });
  });

  // Update top metrics counts
  document.getElementById('stat-total-villages').textContent = totalVillagesCount;
  document.getElementById('stat-total-subcenters').textContent = Object.keys(phcData).length;
  document.getElementById('stat-bsc-submitted').textContent = bscSubmittedCount;
  document.getElementById('stat-bsc-pending').textContent = bscPendingCount;

  // Update Status Cards
  // Card 1: Source-wise BS
  const badgeSource = document.getElementById('dash-status-source');
  const btnSource = document.getElementById('dash-btn-source');
  if (submittedSourceWiseList && submittedSourceWiseList.length > 0) {
    badgeSource.textContent = "Submitted";
    badgeSource.className = "status-badge submitted";
    btnSource.textContent = "Edit Report";
  } else {
    badgeSource.textContent = "Pending";
    badgeSource.className = "status-badge pending";
    btnSource.textContent = "Fill Report";
  }
  btnSource.onclick = () => {
    showView('bsc');
    toggleBscSubView('source');
  };

  // Card 2: Village-wise BS
  const badgeVillage = document.getElementById('dash-status-village');
  const btnVillage = document.getElementById('dash-btn-village');
  if (submittedReportsList && submittedReportsList.length > 0) {
    badgeVillage.textContent = "Submitted";
    badgeVillage.className = "status-badge submitted";
    btnVillage.textContent = "Edit Report";
  } else {
    badgeVillage.textContent = "Pending";
    badgeVillage.className = "status-badge pending";
    btnVillage.textContent = "Fill Report";
  }
  btnVillage.onclick = () => {
    showView('bsc');
    toggleBscSubView('village');
  };

  // Card 3: Medicine
  const badgeMedicine = document.getElementById('dash-status-medicine');
  const btnMedicine = document.getElementById('dash-btn-medicine');
  if (submittedMedReportsList && submittedMedReportsList.length > 0) {
    badgeMedicine.textContent = "Submitted";
    badgeMedicine.className = "status-badge submitted";
    btnMedicine.textContent = "Edit Report";
  } else {
    badgeMedicine.textContent = "Pending";
    badgeMedicine.className = "status-badge pending";
    btnMedicine.textContent = "Fill Report";
  }
  btnMedicine.onclick = () => {
    showView('medicine');
    renderMedicineTable();
  };

  // Card 4: Dengue Positive Report
  const badgeDengue = document.getElementById('dash-status-dengue');
  const btnDengue = document.getElementById('dash-btn-dengue');
  const dashBadgeDengueTop = document.getElementById('stat-dengue-status-badge');
  if (submittedDengueList && submittedDengueList.length > 0) {
    badgeDengue.textContent = "Submitted";
    badgeDengue.className = "status-badge submitted";
    btnDengue.textContent = "Edit Report";
    dashBadgeDengueTop.textContent = "Submitted";
    dashBadgeDengueTop.className = "status-badge submitted";
  } else {
    badgeDengue.textContent = "Pending";
    badgeDengue.className = "status-badge pending";
    btnDengue.textContent = "Fill Report";
    dashBadgeDengueTop.textContent = "Pending";
    dashBadgeDengueTop.className = "status-badge pending";
  }
  btnDengue.onclick = () => {
    showView('dengue');
    renderDengueTable();
  };
}

// Render dynamic Medicine batch sheet
function renderMedicineTable() {
  const tbody = document.getElementById('medicine-table-body');
  tbody.innerHTML = "";

  if (!currentUser || !dbData) return;

  const isSubmitted = submittedMedReportsList.length > 0;
  const statusBanner = document.getElementById('medicine-status-banner');
  const btnSubmit = document.getElementById('btn-submit-medicine');

  // Handle Edit/Read-only States
  if (isSubmitted && !isEditingMedicine) {
    statusBanner.innerHTML = `<span>🟢 Medicine stock report submitted for this month.</span>
      <button type="button" id="btn-edit-medicine-mode">✏️ Edit Report</button>`;
    statusBanner.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  } else {
    statusBanner.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  }

  let srNo = 1;
  let currentCategory = "";

  MEDICINE_ITEMS.forEach((item, idx) => {
    // Render visual Category Divider row if Category changes
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      const trCat = document.createElement('tr');
      trCat.style.background = "rgba(255, 255, 255, 0.03)";
      const tdCat = document.createElement('td');
      tdCat.colSpan = 6;
      tdCat.style.fontWeight = "700";
      tdCat.style.color = "var(--primary-color)";
      tdCat.style.padding = "12px 16px";
      tdCat.style.textAlign = "left";
      tdCat.textContent = currentCategory;
      trCat.appendChild(tdCat);
      tbody.appendChild(trCat);
    }

    // Find saved data
    const saved = submittedMedReportsList.find(m => m.itemName.toLowerCase().trim() === item.name.toLowerCase().trim());

    const tr = document.createElement('tr');
    tr.dataset.name = item.name;

    // Sr No
    const tdSr = document.createElement('td');
    tdSr.textContent = srNo++;
    tr.appendChild(tdSr);

    // Item Name
    const tdName = document.createElement('td');
    tdName.style.textAlign = "left";
    tdName.textContent = item.name;
    tr.appendChild(tdName);

    // Inputs: Opening, Received, Consumption
    const fields = ['opening', 'received', 'consumption'];
    fields.forEach(field => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = "number";
      input.min = "0";
      input.className = "input-sm";
      input.value = saved ? (saved[field] !== undefined ? saved[field] : "0") : "";
      input.placeholder = "0";
      input.style.width = "100%";

      if (isSubmitted && !isEditingMedicine) {
        input.disabled = true;
      }

      input.addEventListener('input', () => {
        calculateMedicineRowClosing(tr);
      });

      td.appendChild(input);
      tr.appendChild(td);
    });

    // Read-only Closing Balance
    const tdClosing = document.createElement('td');
    const inputClosing = document.createElement('input');
    inputClosing.type = "number";
    inputClosing.className = "input-sm input-readonly";
    inputClosing.readOnly = true;
    inputClosing.value = "0";
    inputClosing.style.width = "100%";
    tdClosing.appendChild(inputClosing);
    tr.appendChild(tdClosing);

    tbody.appendChild(tr);
    calculateMedicineRowClosing(tr);
  });

  // Bind Edit trigger
  if (isSubmitted && !isEditingMedicine) {
    document.getElementById('btn-edit-medicine-mode').addEventListener('click', () => {
      isEditingMedicine = true;
      renderMedicineTable();
    });
  }
}

// Calculate closing balance in medicine row: Closing = (Opening + Received) - Consumption
function calculateMedicineRowClosing(tr) {
  const inputs = tr.querySelectorAll('input');
  if (inputs.length >= 4) {
    const opening = parseInt(inputs[0].value) || 0;
    const received = parseInt(inputs[1].value) || 0;
    const consumption = parseInt(inputs[2].value) || 0;

    const closing = (opening + received) - consumption;
    inputs[3].value = closing;
  }
}

// Submit Medicine Report (Batch submission)
async function handleMedicineSubmission(e) {
  e.preventDefault();

  const month = getFormMonth('med');

  // Overwrite check prompt
  if (submittedMedReportsList && submittedMedReportsList.length > 0) {
    const proceed = confirm(`A Medicine stock report has already been submitted for ${formatMonthLabel(month)}. Do you want to edit and overwrite the existing report?`);
    if (!proceed) return;
  }

  const tbody = document.getElementById('medicine-table-body');
  const rows = tbody.querySelectorAll('tr[data-name]'); // Only query product rows, ignore category headers

  const rowsData = [];
  rows.forEach(tr => {
    const itemName = tr.dataset.name;
    const inputs = tr.querySelectorAll('input');

    rowsData.push({
      itemName: itemName,
      opening: parseInt(inputs[0].value) || 0,
      received: parseInt(inputs[1].value) || 0,
      consumption: parseInt(inputs[2].value) || 0,
      closing: parseInt(inputs[3].value) || 0
    });
  });

  showLoader("Submitting Medicine stock report...");
  try {
    const payload = {
      action: 'submitMedicineReport',
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
      isEditingMedicine = false;
      showToast(result.message || "Medicine report saved successfully!", "success");
      fetchDashboardReports(); // Reload and lock
      showView('home'); // Go back to Home
    } else {
      showToast(result.message || "Failed to submit.", "error");
    }
  } catch (err) {
    console.error("Medicine submission error", err);
    showToast("Server communication error.", "error");
  } finally {
    hideLoader();
  }
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
  const month = getFormMonth('source');
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
  const month = getFormMonth('village');
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

function downloadMedicineExcel() {
  const month = getFormMonth('med');
  const readableMonth = formatMonthLabel(month).replace(/\s+/g, '_');
  const filename = `Medicine_Stock_Report_${currentUser.phc}_${readableMonth}.csv`;

  const headers = ["Sr No", "Item Category", "Item Name", "Opening Balance", "Received During Month", "Consumption in Month", "Closing Balance"];
  const rows = [];

  const tbody = document.getElementById('medicine-table-body');
  const tableRows = tbody.querySelectorAll('tr');

  let srNo = 1;
  let currentCategory = "";

  tableRows.forEach(tr => {
    const name = tr.dataset.name;
    // Category divider row has colSpan = 6 and no dataset name
    if (!name) {
      currentCategory = tr.querySelector('td').textContent;
      return;
    }

    const inputs = tr.querySelectorAll('input');
    rows.push([
      srNo++,
      currentCategory,
      name,
      inputs[0].value || "0",
      inputs[1].value || "0",
      inputs[2].value || "0",
      inputs[3].value || "0"
    ]);
  });

  downloadCSV(headers, rows, filename);
}

// ==================== ADMIN OVERVIEW ====================

async function fetchAdminOverview() {
  const month = document.getElementById('admin-month').value;
  if (!month) return;

  showLoader("Loading admin overview...");
  try {
    const payload = { action: 'getAdminOverview', month };
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.success) {
      renderAdminOverview(result.overview || []);
    } else {
      showToast(result.message || 'Failed to load admin overview.', 'error');
    }
  } catch (err) {
    console.error('Admin Overview Error', err);
    showToast('Server communication error.', 'error');
  } finally {
    hideLoader();
  }
}

function renderAdminOverview(overview) {
  const tbody = document.getElementById('admin-table-body');
  tbody.innerHTML = '';

  if (!dbData) return;

  // Build a lookup map: "block|||phc" -> registered user record
  const registeredMap = {};
  overview.forEach(item => {
    const key = item.block.trim().toLowerCase() + '|||' + item.phc.trim().toLowerCase();
    registeredMap[key] = item;
  });

  // Build full list from ALL PHCs in locations.json (the source of truth)
  const allRows = [];
  Object.keys(dbData).sort().forEach(blockName => {
    Object.keys(dbData[blockName]).sort().forEach(phcName => {
      const key = blockName.trim().toLowerCase() + '|||' + phcName.trim().toLowerCase();
      allRows.push({ block: blockName, phc: phcName, reg: registeredMap[key] || null });
    });
  });

  const total = allRows.length;
  let sourceSub = 0, villageSub = 0, medSub = 0, noLogin = 0, pendingApproval = 0;

  allRows.forEach((item, idx) => {
    const reg = item.reg;
    const isApproved = reg && reg.accountStatus === 'Approved';
    const isPending = reg && reg.accountStatus === 'Pending';
    const hasNoLogin = !reg;

    if (isApproved && reg.sourceSubmitted) sourceSub++;
    if (isApproved && reg.villageSubmitted) villageSub++;
    if (isApproved && reg.medicineSubmitted) medSub++;
    if (hasNoLogin) noLogin++;
    if (isPending) pendingApproval++;

    const tr = document.createElement('tr');

    // Highlight entire row in red if no login
    if (hasNoLogin) {
      tr.style.background = 'rgba(239, 68, 68, 0.06)';
    } else if (isPending) {
      tr.style.background = 'rgba(245, 158, 11, 0.06)';
    }

    // #
    const tdNo = document.createElement('td');
    tdNo.textContent = idx + 1;

    // Block
    const tdBlock = document.createElement('td');
    tdBlock.textContent = item.block;

    // PHC name
    const tdPhc = document.createElement('td');
    tdPhc.style.fontWeight = '600';
    tdPhc.textContent = item.phc;

    // Account Status / Email column
    const tdAccount = document.createElement('td');
    if (hasNoLogin) {
      tdAccount.innerHTML = '<span class="status-badge" style="background:rgba(239,68,68,0.18);color:#f87171;border:1px solid rgba(239,68,68,0.4);">⚠️ Login Not Created</span>';
    } else if (isPending) {
      tdAccount.innerHTML = `<span class="status-badge" style="background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.4);">⏳ Pending Approval</span><br><small style="color:var(--text-secondary);font-size:0.78rem;">${reg.email}</small>`;
    } else {
      tdAccount.innerHTML = `<span class="status-badge submitted">✅ Active</span><br><small style="color:var(--text-secondary);font-size:0.78rem;">${reg.email}</small>`;
    }

    // Report status cells — show dash for no/pending accounts
    const makeStatusCell = (submitted) => {
      const td = document.createElement('td');
      if (!isApproved) {
        const dash = document.createElement('span');
        dash.style.color = 'var(--text-secondary)';
        dash.style.fontSize = '0.85rem';
        dash.textContent = '—';
        td.appendChild(dash);
      } else {
        const badge = document.createElement('span');
        badge.className = submitted ? 'status-badge submitted' : 'status-badge pending';
        badge.textContent = submitted ? 'Submitted' : 'Pending';
        td.appendChild(badge);
      }
      return td;
    };

    tr.appendChild(tdNo);
    tr.appendChild(tdBlock);
    tr.appendChild(tdPhc);
    tr.appendChild(tdAccount);
    tr.appendChild(makeStatusCell(isApproved && reg.sourceSubmitted));
    tr.appendChild(makeStatusCell(isApproved && reg.villageSubmitted));
    tr.appendChild(makeStatusCell(isApproved && reg.medicineSubmitted));

    tbody.appendChild(tr);
  });

  // Update summary cards
  document.getElementById('admin-stat-total').textContent = total;
  document.getElementById('admin-stat-no-login').textContent = noLogin;
  document.getElementById('admin-stat-pending-approval').textContent = pendingApproval;
  document.getElementById('admin-stat-source-submitted').textContent = sourceSub;
  document.getElementById('admin-stat-source-pending').textContent = total - noLogin - pendingApproval - sourceSub;
  document.getElementById('admin-stat-village-submitted').textContent = villageSub;
  document.getElementById('admin-stat-village-pending').textContent = total - noLogin - pendingApproval - villageSub;
  document.getElementById('admin-stat-medicine-submitted').textContent = medSub;
  document.getElementById('admin-stat-medicine-pending').textContent = total - noLogin - pendingApproval - medSub;
}

// ==========================================
// DENGUE POSITIVE REPORT LOGIC
// ==========================================

async function fetchDengueReport() {
  if (!currentUser) return;
  const month = getFormMonth('dengue');
  if (!month) return;

  showLoader("Fetching Dengue Positive report...");
  try {
    const payload = { action: 'getDengueReports', block: currentUser.block, phc: currentUser.phc, month };
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      submittedDengueList = result.reports || [];
      renderDengueTable();
    }
  } catch (err) {
    showToast('Error loading Dengue Positive report.', 'error');
  } finally {
    hideLoader();
  }
}

function renderDengueTable() {
  const tbody = document.getElementById('dengue-table-body');
  tbody.innerHTML = "";

  if (!currentUser || !dbData) return;

  const userBlock = currentUser.block;
  const userPhc = currentUser.phc;
  const phcData = dbData[userBlock]?.[userPhc];

  if (!phcData) return;

  const isSubmitted = submittedDengueList.length > 0;
  const statusBanner = document.getElementById('dengue-status-banner');
  const btnSubmit = document.getElementById('btn-submit-dengue');

  // Handle Edit/Read-only States
  if (isSubmitted && !isEditingDengue) {
    statusBanner.innerHTML = `<span>🟢 Dengue Positive report submitted for this month.</span>
      <button type="button" id="btn-edit-dengue-mode">✏️ Edit Report</button>`;
    statusBanner.classList.remove('hidden');
    btnSubmit.classList.add('hidden');
  } else {
    statusBanner.classList.add('hidden');
    btnSubmit.classList.remove('hidden');
  }

  let srNo = 1;
  Object.keys(phcData).sort().forEach(scName => {
    const villages = phcData[scName].sort();
    villages.forEach(vilName => {
      // Find if we have saved data
      let savedBs = '';
      let savedDenguePositive = '';
      let savedDengueSerum = '';
      let savedPositiveVe = '';
      let savedPopulation = '';

      if (isSubmitted) {
        const match = submittedDengueList.find(r => 
          r.subcenter.toLowerCase().trim() === scName.toLowerCase().trim() && 
          r.village.toLowerCase().trim() === vilName.toLowerCase().trim()
        );
        if (match) {
          savedBs = match.bs;
          savedDenguePositive = match.denguePositive;
          savedDengueSerum = match.dengueSerum;
          savedPositiveVe = match.positiveVe;
          savedPopulation = match.population;
        }
      }

      const isReadOnly = isSubmitted && !isEditingDengue ? 'readonly' : '';
      const inputClass = isSubmitted && !isEditingDengue ? 'form-input input-readonly' : 'form-input';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center">${srNo++}</td>
        <td>${scName}</td>
        <td>${vilName}</td>
        <td><input type="number" min="0" class="${inputClass}" data-field="population" value="${savedPopulation}" placeholder="Pop" ${isReadOnly}></td>
        <td><input type="number" min="0" class="${inputClass}" style="color: #60a5fa; font-weight: bold;" data-field="bs" value="${savedBs}" ${isReadOnly}></td>
        <td><input type="number" min="0" class="${inputClass}" style="color: #60a5fa; font-weight: bold;" data-field="denguePositive" value="${savedDenguePositive}" ${isReadOnly}></td>
        <td><input type="number" min="0" class="${inputClass}" style="color: #fb923c; font-weight: bold;" data-field="dengueSerum" value="${savedDengueSerum}" ${isReadOnly}></td>
        <td><input type="number" min="0" class="${inputClass}" style="color: #fb923c; font-weight: bold;" data-field="positiveVe" value="${savedPositiveVe}" ${isReadOnly}></td>
      `;
      tbody.appendChild(tr);
    });
  });

  if (isSubmitted && !isEditingDengue) {
    const editBtn = document.getElementById('btn-edit-dengue-mode');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        isEditingDengue = true;
        renderDengueTable();
      });
    }
  }
}

async function handleDengueSubmission(e) {
  e.preventDefault();
  if (!currentUser) return;

  const month = getFormMonth('dengue');
  if (!month) {
    showToast("Please select Year and Month", "error");
    return;
  }

  const tbody = document.getElementById('dengue-table-body');
  const rows = tbody.querySelectorAll('tr');
  const reports = [];

  rows.forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 8) return;

    reports.push({
      subcenter: cells[1].textContent.trim(),
      village: cells[2].textContent.trim(),
      population: cells[3].querySelector('input').value || 0,
      bs: cells[4].querySelector('input').value || 0,
      denguePositive: cells[5].querySelector('input').value || 0,
      dengueSerum: cells[6].querySelector('input').value || 0,
      positiveVe: cells[7].querySelector('input').value || 0
    });
  });

  const payload = {
    action: 'submitDengueReport',
    email: currentUser.email,
    block: currentUser.block,
    phc: currentUser.phc,
    month: month,
    reports: reports
  };

  showLoader("Submitting Dengue Positive report...");
  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast("Dengue Positive Report submitted successfully!");
      isEditingDengue = false;
      await fetchDengueReport(); 
      await fetchDashboardReports(); 
    } else {
      showToast(result.message || "Submission failed", "error");
    }
  } catch (err) {
    showToast("Network error. Could not submit.", "error");
  } finally {
    hideLoader();
  }
}

function downloadDengueExcel() {
  if (!submittedDengueList || submittedDengueList.length === 0) {
    showToast("No data to download", "error");
    return;
  }
  
  let csv = "Sr No,Subcenter,Village,Population,BS,Dengue Positive,Dengue Serum,+Ve'\n";
  
  submittedDengueList.forEach((row, idx) => {
    csv += `${idx + 1},"${row.subcenter}","${row.village}",${row.population},${row.bs},${row.denguePositive},${row.dengueSerum},${row.positiveVe}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const month = getFormMonth('dengue') || 'report';
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', `Dengue_Report_${currentUser.phc}_${month}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
