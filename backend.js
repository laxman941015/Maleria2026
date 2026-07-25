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

// 3. Handles Report submissions
function handleSubmitReport(data) {
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

  const reportsData = reportsSheet.getDataRange().getValues();
  const block = data.block.trim().toLowerCase();
  const phc = data.phc.trim().toLowerCase();
  const month = data.month.trim().toLowerCase();
  const subcenter = data.subcenter.trim().toLowerCase();
  const village = data.village.trim().toLowerCase();

  let rowIndex = -1;
  // Check if a report for this specific month, subcenter, and village already exists
  for (let i = 1; i < reportsData.length; i++) {
    const sBlock = reportsData[i][2].toString().trim().toLowerCase();
    const sPhc = reportsData[i][3].toString().trim().toLowerCase();
    const sMonth = reportsData[i][4].toString().trim().toLowerCase();
    const sSubcenter = reportsData[i][5].toString().trim().toLowerCase();
    const sVillage = reportsData[i][6].toString().trim().toLowerCase();

    if (sBlock === block && sPhc === phc && sMonth === month && sSubcenter === subcenter && sVillage === village) {
      rowIndex = i + 1; // 1-indexed row number in Sheets
      break;
    }
  }

  const newRow = [
    new Date(),
    data.email,
    data.block,
    data.phc,
    data.month,
    data.subcenter,
    data.village,
    data.target,
    data.active,
    data.passive,
    data.total,
    data.positive,
    data.pf,
    data.pv,
    data.rt
  ];

  if (rowIndex !== -1) {
    // Overwrite the existing row
    const range = reportsSheet.getRange(rowIndex, 1, 1, newRow.length);
    range.setValues([newRow]);
    return { success: true, message: "Report successfully updated" };
  } else {
    // Append new row
    reportsSheet.appendRow(newRow);
    return { success: true, message: "Report successfully saved" };
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
    const sMonth = reportsData[i][4].toString().trim().toLowerCase();

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
