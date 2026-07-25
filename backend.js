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

  // Append report row
  reportsSheet.appendRow([
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
  ]);

  return { success: true, message: "Report successfully saved" };
}
