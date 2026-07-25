/**
 * Google Apps Script - Sindhudurg Reporting Portal Backend
 * 
 * Instructions:
 * 1. Open Google Sheets. Create a new spreadsheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Delete any default code and paste this code.
 * 4. Click Save, then click "Deploy" -> "New deployment".
 * 5. Choose "Web app" as the type.
 * 6. Set "Execute as" to "Me".
 * 7. Set "Who has access" to "Anyone" (this is REQUIRED for public reporting).
 * 8. Deploy and copy the Web App URL.
 * 9. Paste that URL into your frontend `app.js` file as the `BACKEND_URL`.
 */

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    let response = { success: false, message: "Unknown action" };

    if (action === "register") {
      response = handleRegister(postData);
    } else if (action === "login") {
      response = handleLogin(postData);
    } else if (action === "submitReport") {
      response = handleSubmitReport(postData);
    } else if (action === "getReports") {
      response = handleGetReports(postData);
    } else if (action === "submitMedicineReport") {
      response = handleSubmitMedicineReport(postData);
    } else if (action === "getMedicineReports") {
      response = handleGetMedicineReports(postData);
    } else if (action === "submitSourceWiseReport") {
      response = handleSubmitSourceWiseReport(postData);
    } else if (action === "getSourceWiseReports") {
      response = handleGetSourceWiseReports(postData);
    }

    return ContentService.createTextOutput(JSON.stringify(response))
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      message: "Internal server error: " + err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Enable CORS Preflight requests if needed (Apps Script handles OPTIONS natively but this is a good practice)
function doOptions(e) {
  return ContentService.createTextOutput("")
                       .setMimeType(ContentService.MimeType.TEXT);
}

// 1. Handles Registration requests
function handleRegister(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let usersSheet = ss.getSheetByName("users");
  
  // Create 'users' sheet if it doesn't exist
  if (!usersSheet) {
    usersSheet = ss.insertSheet("users");
    usersSheet.appendRow(["Email", "Password", "Block", "PHC", "Status", "Role", "Created At"]);
    // Freeze header row
    usersSheet.setFrozenRows(1);
  }

  const usersData = usersSheet.getDataRange().getValues();
  const emailLower = data.email.toLowerCase().trim();

  // Check if user already exists
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][0].toString().toLowerCase() === emailLower) {
      return { success: false, message: "Email is already registered" };
    }
  }

  // Append new user with default status "Pending" and role "User"
  usersSheet.appendRow([
    emailLower,
    data.password, // Store as plain text for simplicity in this free portal setup
    data.block,
    data.phc,
    "Pending", // Admin changes this to "Approved"
    "User",
    new Date()
  ]);

  return { success: true, message: "Registration successful" };
}

// 2. Handles Login requests
function handleLogin(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName("users");

  if (!usersSheet) {
    return { success: false, message: "No registered users found. Please register first." };
  }

  const usersData = usersSheet.getDataRange().getValues();
  const emailLower = data.email.toLowerCase().trim();
  const password = data.password;

  for (let i = 1; i < usersData.length; i++) {
    const sheetEmail = usersData[i][0].toString().toLowerCase().trim();
    const sheetPassword = usersData[i][1].toString();
    const sheetStatus = usersData[i][4].toString().trim();
    const sheetBlock = usersData[i][2].toString();
    const sheetPhc = usersData[i][3].toString();

    if (sheetEmail === emailLower && sheetPassword === password) {
      if (sheetStatus === "Approved") {
        return { 
          success: true, 
          email: sheetEmail, 
          block: sheetBlock, 
          phc: sheetPhc 
        };
      } else {
        return { 
          success: false, 
          message: "Your account is pending admin approval. Please contact the District Malaria Office." 
        };
      }
    }
  }

  return { success: false, message: "Incorrect email or password" };
}

// 3. Handles Report submissions (replaces existing for the month)
function handleSubmitReport(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, message: "Server is busy. Please try again in a few seconds." };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let reportsSheet = ss.getSheetByName("blood_collection_reports");

    // Create sheet if it doesn't exist
    if (!reportsSheet) {
      reportsSheet = ss.insertSheet("blood_collection_reports");
      reportsSheet.appendRow([
        "Submission Date",
        "User Email",
        "Block",
        "PHC",
        "Month & Year",
        "Subcenter",
        "Village",
        "Target",
        "Active BSC",
        "Passive BSC",
        "Total BSC",
        "Positive Cases",
        "Pf Cases",
        "Pv Cases",
        "RT Given"
      ]);
      reportsSheet.setFrozenRows(1);
    }

    const block = data.block.trim().toLowerCase();
    const phc = data.phc.trim().toLowerCase();
    const month = data.month.trim().toLowerCase();

    // Overwrite check: remove all rows for this Month + PHC first
    const rows = reportsSheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      const sBlock = rows[i][2].toString().trim().toLowerCase();
      const sPhc = rows[i][3].toString().trim().toLowerCase();
      const sMonth = formatSheetMonth(rows[i][4]).toLowerCase();
      if (sBlock === block && sPhc === phc && sMonth === month) {
        reportsSheet.deleteRow(i + 1);
      }
    }

    // Append new rows
    const rowsData = data.rows;
    rowsData.forEach(r => {
      reportsSheet.appendRow([
        new Date(),
        data.email,
        data.block,
        data.phc,
        data.month,
        r.subcenter,
        r.village,
        r.target || 0,
        r.active || 0,
        r.passive || 0,
        r.total || 0,
        r.positive || 0,
        r.pf || 0,
        r.pv || 0,
        r.rt || 0
      ]);
    });

    return { success: true, message: "Village-wise reports saved successfully" };
  } finally {
    lock.releaseLock();
  }
}

// 4. Fetches reports for a given month and PHC
function handleGetReports(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportsSheet = ss.getSheetByName("blood_collection_reports");

  if (!reportsSheet) {
    return { success: true, reports: [] };
  }

  const reportsData = reportsSheet.getDataRange().getValues();
  const block = data.block.trim().toLowerCase();
  const phc = data.phc.trim().toLowerCase();
  const month = data.month.trim().toLowerCase();

  const results = [];

  for (let i = 1; i < reportsData.length; i++) {
    const sBlock = reportsData[i][2].toString().trim().toLowerCase();
    const sPhc = reportsData[i][3].toString().trim().toLowerCase();
    const sMonth = formatSheetMonth(reportsData[i][4]).toLowerCase();

    if (sBlock === block && sPhc === phc && sMonth === month) {
      results.push({
        email: reportsData[i][1],
        subcenter: reportsData[i][5],
        village: reportsData[i][6],
        target: reportsData[i][7],
        active: reportsData[i][8],
        passive: reportsData[i][9],
        total: reportsData[i][10],
        positive: reportsData[i][11],
        pf: reportsData[i][12],
        pv: reportsData[i][13],
        rt: reportsData[i][14]
      });
    }
  }

  return { success: true, reports: results };
}

// 5. Handles Medicine Report submissions (batch, overwriting previous month + PHC entries)
function handleSubmitMedicineReport(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, message: "Server is busy. Please try again in a few seconds." };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let reportsSheet = ss.getSheetByName("medicine_reports");

    if (!reportsSheet) {
      reportsSheet = ss.insertSheet("medicine_reports");
      reportsSheet.appendRow([
        "Submission Date", "User Email", "Block", "PHC", "Month & Year", 
        "Item Name", "Opening Balance", "Received", "Consumption", "Closing Balance"
      ]);
      reportsSheet.setFrozenRows(1);
    }

    const block = data.block.trim().toLowerCase();
    const phc = data.phc.trim().toLowerCase();
    const month = data.month.trim().toLowerCase();

    // Overwrite cleanup
    const rows = reportsSheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      const sBlock = rows[i][2].toString().trim().toLowerCase();
      const sPhc = rows[i][3].toString().trim().toLowerCase();
      const sMonth = formatSheetMonth(rows[i][4]).toLowerCase();
      if (sBlock === block && sPhc === phc && sMonth === month) {
        reportsSheet.deleteRow(i + 1);
      }
    }

    // Insert batch rows
    const rowsData = data.rows;
    rowsData.forEach(r => {
      reportsSheet.appendRow([
        new Date(),
        data.email,
        data.block,
        data.phc,
        data.month,
        r.itemName,
        r.opening || 0,
        r.received || 0,
        r.consumption || 0,
        r.closing || 0
      ]);
    });

    return { success: true, message: "Medicine report saved successfully" };
  } finally {
    lock.releaseLock();
  }
}

// 6. Fetches medicine reports for a given month and PHC
function handleGetMedicineReports(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportsSheet = ss.getSheetByName("medicine_reports");

  if (!reportsSheet) {
    return { success: true, reports: [] };
  }

  const reportsData = reportsSheet.getDataRange().getValues();
  const block = data.block.trim().toLowerCase();
  const phc = data.phc.trim().toLowerCase();
  const month = data.month.trim().toLowerCase();

  const results = [];

  for (let i = 1; i < reportsData.length; i++) {
    const sBlock = reportsData[i][2].toString().trim().toLowerCase();
    const sPhc = reportsData[i][3].toString().trim().toLowerCase();
    const sMonth = formatSheetMonth(reportsData[i][4]).toLowerCase();

    if (sBlock === block && sPhc === phc && sMonth === month) {
      results.push({
        itemName: reportsData[i][5],
        opening: reportsData[i][6],
        received: reportsData[i][7],
        consumption: reportsData[i][8],
        closing: reportsData[i][9]
      });
    }
  }

  return { success: true, reports: results };
}

// 7. Handles Source-wise Active/Passive report submissions (replaces existing for the month)
function handleSubmitSourceWiseReport(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, message: "Server is busy. Please try again in a few seconds." };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("source_wise_reports");
    
    if (!sheet) {
      sheet = ss.insertSheet("source_wise_reports");
      sheet.appendRow([
        "Submission Date", "User Email", "Block", "PHC", "Month & Year", 
        "Location Name", "Population", "OPD", "OPD BS", "ANM BS", "MPW BS", "ANM NHM BS", "ASHA BS"
      ]);
      sheet.setFrozenRows(1);
    }

    const block = data.block.trim().toLowerCase();
    const phc = data.phc.trim().toLowerCase();
    const month = data.month.trim().toLowerCase();

    // Overwrite check: remove all rows for this Month + PHC first
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      const sBlock = rows[i][2].toString().trim().toLowerCase();
      const sPhc = rows[i][3].toString().trim().toLowerCase();
      const sMonth = formatSheetMonth(rows[i][4]).toLowerCase();
      if (sBlock === block && sPhc === phc && sMonth === month) {
        sheet.deleteRow(i + 1);
      }
    }

    // Append new rows
    const rowsData = data.rows;
    rowsData.forEach(r => {
      sheet.appendRow([
        new Date(),
        data.email,
        data.block,
        data.phc,
        data.month,
        r.locationName,
        r.population,
        r.opd,
        r.opdBs,
        r.anmBs,
        r.mpwBs,
        r.anmNhmBs,
        r.ashaBs
      ]);
    });

    return { success: true, message: "Source-wise report saved successfully" };
  } finally {
    lock.releaseLock();
  }
}

// 8. Fetches Source-wise reports for a given month and PHC
function handleGetSourceWiseReports(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("source_wise_reports");
  if (!sheet) {
    return { success: true, reports: [] };
  }

  const rows = sheet.getDataRange().getValues();
  const block = data.block.trim().toLowerCase();
  const phc = data.phc.trim().toLowerCase();
  const month = data.month.trim().toLowerCase();

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const sBlock = rows[i][2].toString().trim().toLowerCase();
    const sPhc = rows[i][3].toString().trim().toLowerCase();
    const sMonth = formatSheetMonth(rows[i][4]).toLowerCase();

    if (sBlock === block && sPhc === phc && sMonth === month) {
      results.push({
        locationName: rows[i][5],
        population: rows[i][6],
        opd: rows[i][7],
        opdBs: rows[i][8],
        anmBs: rows[i][9],
        mpwBs: rows[i][10],
        anmNhmBs: rows[i][11],
        ashaBs: rows[i][12]
      });
    }
  }

  return { success: true, reports: results };
}

// Robust date/month formatting helper for sheet data
function formatSheetMonth(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM");
  }
  const str = val.toString().trim();
  if (str.includes("GMT") || str.includes("Standard Time") || (isNaN(str) && !isNaN(Date.parse(str)))) {
    try {
      const d = new Date(str);
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
    } catch (e) {}
  }
  return str;
}
