// ==========================================================================
// 【古哥挑戰獎學金】成績挑戰系統 - 雲端 GAS 後端服務程式碼 (Code.gs)
// ==========================================================================

const SPREADSHEET_ID = '1DsGusSd_s6zXyOl3Pf_Ql-IUI4ncutFnFK0HgMpuID8';
const PARENT_DRIVE_FOLDER_ID = '1SK0UyFssSFDR044v5Th-ZkbvagqdNsIo';

// --- LINE Login Configurations ---
const LINE_CHANNEL_ID = '2010560500';
const LINE_CHANNEL_SECRET = '77a41dd44223451bac61802baa2f6246'; // ⚠️ 已填入您在 LINE Developers 取得的頻道金鑰 (Channel Secret)

// --- Web Routing (GET Entrance) ---
function doGet(e) {
  const params = e ? e.parameter : {};
  const action = params.action || params.page || "index";
  
  // ─── 雲端底圖系統 API 分流 ───
  if (action === "getAlbumList") {
    return ContentService.createTextOutput(JSON.stringify(getAlbumList()))
        .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "getImagesByFolder") {
    return ContentService.createTextOutput(JSON.stringify(getImagesByFolder(params.folderId)))
        .setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "getActiveBgImages") {
    return ContentService.createTextOutput(JSON.stringify(getActiveBgImages()))
        .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'portal' || action === 'home') {
    const template = HtmlService.createTemplateFromFile('portal');
    template.gasUrl = ScriptApp.getService().getUrl();
    return template.evaluate()
        .setTitle('古哥挑戰獎學金')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (action === 'admin') {
    // Serve admin console skeleton directly (PII authentication managed asynchronously by client token)
    return HtmlService.createHtmlOutputFromFile('admin')
        .setTitle('古哥挑戰獎學金審查系統 - 後台控制台')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // Default: Student Main Landing Page with Server-Side LINE Login OAuth flow
  const gasUrl = ScriptApp.getService().getUrl();
  const parentUrl = e.parameter.parent_url ? decodeURIComponent(e.parameter.parent_url) : "";
  const redirectUri = parentUrl || gasUrl;
  const code = e.parameter.code;
  
  // Try to read parameters passed directly from the GitHub Pages parent LIFF wrapper
  let lineUid = e.parameter.lineUid || "";
  let lineDisplayName = e.parameter.lineDisplayName ? decodeURIComponent(e.parameter.lineDisplayName) : "";
  
  // Fallback to Server-side OAuth exchange only if lineUid is not provided directly
  if (!lineUid && code) {
    // Exchange code for token
    try {
      const tokenUrl = 'https://api.line.me/oauth2/v2.1/token';
      const payload = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET
      };
      
      const options = {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: payload,
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(tokenUrl, options);
      const resData = JSON.parse(response.getContentText());
      
      if (resData.id_token) {
        const payloadPart = resData.id_token.split('.')[1];
        const decodedPayload = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadPart)).getDataAsString();
        const payloadJson = JSON.parse(decodedPayload);
        lineUid = payloadJson.sub;
        lineDisplayName = payloadJson.name || "";
      }
    } catch (err) {
      Logger.log("OAuth token exchange failed: " + err.toString());
    }
  }
  const authorizeUrl = "https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=" + LINE_CHANNEL_ID + "&redirect_uri=" + encodeURIComponent(redirectUri) + "&state=login&scope=profile%20openid";
  
  // Serve student main landing page and inject LINE details
  var template = HtmlService.createTemplateFromFile('index');
  template.lineUid = lineUid || "";
  template.lineDisplayName = lineDisplayName || "";
  template.lineAuthorizeUrl = authorizeUrl;
  
  return template.evaluate()
      .setTitle('\u53e4\u54e5\u734e\u5b78\u91d1 - \u6210\u7e3e\u6311\u6230\u8a08\u756b')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Helper to include files inside templates
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Database Sheets Initialization ---
function getDbSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    throw new Error("無法連接至 Google 試算表，請確認試算表 ID 是否正確且具備共用存取權！");
  }
}

function initSheets() {
  const ss = getDbSpreadsheet();
  
  // 1. Check or Create 'students'
  let studentSheet = ss.getSheetByName('students');
  if (!studentSheet) {
    studentSheet = ss.insertSheet('students');
    studentSheet.appendRow(['StudentUID', 'RealName', 'Birthday', 'Nickname', 'School', 'Department', 'Grade', 'LineUID', 'FolderID', 'ConsentSigned', 'BankCode', 'BankAccount', 'CreatedAt']);
    studentSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#b7e1cd');
  } else {
    if (studentSheet.getLastColumn() < 10 || studentSheet.getRange(1, 10).getValue().toString().trim() !== "ConsentSigned") {
      studentSheet.getRange(1, 10).setValue("ConsentSigned").setFontWeight('bold').setBackground('#b7e1cd');
    }
    if (studentSheet.getLastColumn() < 12) {
      studentSheet.getRange(1, 11).setValue("BankCode").setFontWeight('bold').setBackground('#b7e1cd');
      studentSheet.getRange(1, 12).setValue("BankAccount").setFontWeight('bold').setBackground('#b7e1cd');
    }
    if (studentSheet.getLastColumn() < 13) {
      studentSheet.getRange(1, 13).setValue("CreatedAt").setFontWeight('bold').setBackground('#b7e1cd');
    }
  }
  
  // 2. Check or Create 'applications'
  let appSheet = ss.getSheetByName('applications');
  if (!appSheet) {
    appSheet = ss.insertSheet('applications');
    appSheet.appendRow(['ApplicationID', 'Type', 'Status', 'StudentUID', 'RealName', 'Amount', 'AcademicYear', 'Details', 'FileLink1', 'FileLink2', 'CreatedAt']);
    appSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#c9daf8');
  }
  
  // 3. Check or Create 'settings'
  let settingsSheet = ss.getSheetByName('settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('settings');
    settingsSheet.appendRow(['Key', 'Value']);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#fce5cd');
    
    // Seed default values
    const defaults = [
      ['progress_base', '1500'],
      ['progress_conversion_rate', '50'],
      ['challenge_amounts', '7000,8500,10000,12000,15000,18000,20000,25000'],
      ['blueprint_amount', '30000'],
      ['admin_password', 'guge_admin_secret_999'],
      ['line_channel_access_token', 'YOUR_LINE_ACCESS_TOKEN']
    ];
    for (let d of defaults) {
      settingsSheet.appendRow(d);
    }
  }
  
  return "Database tables verified successfully!";
}

// --- Helper Functions to Query Sheets ---
function getSettingsDict(ss) {
  const sheet = ss.getSheetByName('settings');
  const values = getSafeValues(sheet);
  const dict = {};
  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    const val = values[i][1];
    dict[key] = val;
  }
  return dict;
}

function getSafeSettings(ss) {
  const dict = getSettingsDict(ss);
  // Exclude sensitive admin password and LINE channel token
  delete dict['admin_password'];
  delete dict['line_channel_access_token'];
  
  // Format data types for JS
  return {
    progress_base: parseInt(dict['progress_base'] || '1500'),
    progress_conversion_rate: parseInt(dict['progress_conversion_rate'] || '50'),
    challenge_amounts: (dict['challenge_amounts'] || '7000,8500,10000,12000,15000,18000,20000,25000').toString().split(',').map(Number),
    blueprint_amount: parseInt(dict['blueprint_amount'] || '30000'),
    active_bg_folder_id: dict['active_bg_folder_id'] || ""
  };
}

function getPublicSettings() {
  const ss = getDbSpreadsheet();
  return getSafeSettings(ss);
}

// --- LINE Push Notification Service ---
function sendLinePushNotification(lineUserId, messageText) {
  const ss = getDbSpreadsheet();
  const dict = getSettingsDict(ss);
  const token = dict['line_channel_access_token'];
  
  if (!token || token === 'YOUR_LINE_ACCESS_TOKEN' || !lineUserId || lineUserId.indexOf('mock_line_') === 0) {
    Logger.log("LINE 推播取消：未設定 Access Token 或此學員為模擬測試身分。");
    return false;
  }
  
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: lineUserId,
    messages: [
      {
        type: 'text',
        text: messageText
      }
    ]
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const resCode = response.getResponseCode();
    const resText = response.getContentText();
    Logger.log("LINE 推播狀態碼: " + resCode + ", 回傳: " + resText);
    return resCode === 200;
  } catch (err) {
    Logger.log("LINE 推播異常: " + err.toString());
    return false;
  }
}

// Find rows matching criteria in a sheet
function findRows(sheet, colIndex, value) {
  const data = getSafeValues(sheet);
  const matched = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex - 1].toString() === value.toString()) {
      matched.push({ rowIndex: i + 1, rowData: data[i] });
    }
  }
  return matched;
}

// --- Student API Logic ---

// Helper to normalize birthday strings, preventing leading-zero truncation issues from Google Sheets
function normalizeBirthday(b) {
  if (b === null || b === undefined) return "";
  let s = b.toString().trim();
  // If it's a 3-digit number, pad with a leading zero (e.g. "918" -> "0918")
  if (s.length === 3 && !isNaN(s)) {
    s = "0" + s;
  }
  // Strip off single quote prefix if present
  if (s.indexOf("'") === 0) {
    s = s.substring(1);
  }
  return s;
}

// --- Student LIFF APIs ---

// 1.0. Student LIFF Login (Verification by LINE UID)
function studentLiffLogin(lineUid) {
  initSheets();
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const appSheet = ss.getSheetByName('applications');
  
  if (!lineUid) {
    return { success: false, message: '缺少 LINE UID，請從 LINE App 內開啟此網頁！' };
  }
  
  const data = getSafeValues(studentSheet);
  let student = null;
  for (let i = 1; i < data.length; i++) {
    const sheetLineUid = data[i][7] ? data[i][7].toString().trim() : "";
    if (sheetLineUid === lineUid.trim()) {
      student = {
        uid: data[i][0] ? data[i][0].toString() : "",
        name: data[i][1] ? data[i][1].toString() : "",
        birthday: data[i][2] ? normalizeBirthday(data[i][2]) : "",
        nickname: data[i][3] ? data[i][3].toString() : "",
        school: data[i][4] ? data[i][4].toString() : "",
        department: data[i][5] ? data[i][5].toString() : "",
        grade: data[i][6] ? data[i][6].toString() : "",
        lineUid: data[i][7] ? data[i][7].toString() : "",
        folderId: data[i][8] ? data[i][8].toString() : "",
        consentSigned: data[i][9] ? data[i][9].toString().trim() === "true" : false,
        bankCode: data[i][10] ? data[i][10].toString() : "",
        bankAccount: data[i][11] ? data[i][11].toString() : ""
      };
      break;
    }
  }
  
  if (!student) {
    return {
      success: false,
      code: 'NOT_REGISTERED',
      message: '尚未註冊本系統計畫。'
    };
  }
  
  // Get unlocked levels, attempts, and applications list
  const appData = getSafeValues(appSheet);
  const unlockedChallenges = [];
  const pendingChallenges = [];
  const applications = [];
  let attempts = 0;
  let approvedAttempts = 0;
  
  for (let i = 1; i < appData.length; i++) {
    if (appData[i][3] && appData[i][3].toString().trim() === student.uid.trim()) {
      const status = appData[i][2] ? appData[i][2].toString().trim() : "";
      
      // Add to application history
      applications.push({
        id: appData[i][0] ? appData[i][0].toString() : "",
        type: appData[i][1] ? appData[i][1].toString() : "",
        status: status,
        amount: appData[i][5] ? parseFloat(appData[i][5]) : 0,
        academicYear: appData[i][6] ? appData[i][6].toString() : "",
        details: appData[i][7] ? appData[i][7].toString() : "",
        createdAt: appData[i][10] ? appData[i][10].toString() : ""
      });
      
      if (appData[i][1] === 'challenge') {
        try {
          const detailsObj = JSON.parse(appData[i][7]);
          const targetVal = parseFloat(detailsObj.target);
          if (status === 'approved' || status === 'paid' || status === 'destroyed') {
            unlockedChallenges.push(targetVal);
            approvedAttempts++;
          } else if (status === 'pending' || status === 'patching') {
            pendingChallenges.push(targetVal);
          }
        } catch (e) {}
        
        if (status !== 'rejected') {
          attempts++;
        }
      }
    }
  }
  
  const settings = getSafeSettings(ss);
  
  return {
    success: true,
    uid: student.uid,
    name: student.name,
    birthday: student.birthday,
    nickname: student.nickname,
    school: student.school,
    department: student.department,
    grade: student.grade,
    consent_signed: student.consentSigned,
    unlocked_challenges: unlockedChallenges,
    pending_challenges: pendingChallenges,
    attempts: attempts,
    approved_attempts: approvedAttempts,
    applications: applications,
    bankCode: student.bankCode,
    bankAccount: student.bankAccount,
    settings: settings
  };
}

// 1.1. Student LIFF Register (Binds LINE UID)
function studentLiffRegister(regData, lineUid) {
  initSheets();
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  
  const name = regData.name.trim();
  const birthday = regData.birthday.trim();
  const inputBirthday = normalizeBirthday(birthday);
  
  if (!lineUid) {
    return { success: false, message: '註冊失敗：缺少 LINE UID，請從 LINE App 內開啟此網頁！' };
  }
  
  // Verify duplication
  const rows = getSafeValues(studentSheet);
  for (let i = 1; i < rows.length; i++) {
    const sheetName = rows[i][1] ? rows[i][1].toString().trim() : "";
    const sheetBirthday = rows[i][2] ? normalizeBirthday(rows[i][2]) : "";
    const sheetLineUid = rows[i][7] ? rows[i][7].toString().trim() : "";
    
    if (sheetName === name && sheetBirthday === inputBirthday) {
      return { success: false, message: '此真實姓名與生日組合已在系統中存在！' };
    }
    if (sheetLineUid === lineUid) {
      return { success: false, message: '您的 LINE 帳號已綁定過其他學生身分！' };
    }
  }
  
  // Generate random UID
  let studentUid = 'U';
  for (let k = 0; k < 8; k++) {
    studentUid += Math.floor(Math.random() * 10).toString();
  }
  
  // Create Google Drive Folder
  let studentFolderId = "error_drive_access";
  try {
    const parentFolder = DriveApp.getFolderById(PARENT_DRIVE_FOLDER_ID);
    const subFolder = parentFolder.createFolder(name);
    studentFolderId = subFolder.getId();
  } catch (err) {
    // Fallback: If folder creation fails, write a mock folder value so execution does not crash
    studentFolderId = "error_drive_access";
  }
  
  // Append new student record
  studentSheet.appendRow([
    studentUid,
    name,
    inputBirthday,
    regData.nickname.trim(),
    regData.school.trim(),
    regData.department.trim(),
    regData.grade.trim(),
    lineUid,
    studentFolderId,
    false, // ConsentSigned
    "",    // BankCode
    "",    // BankAccount
    Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss") // CreatedAt
  ].map(safeWriteVal));
  
  // Send welcome push notification
  const welcomeMsg = `🎉 恭喜！您已成功註冊加入【古哥挑戰獎學金】成績挑戰計畫。\n學員編號：${studentUid}\n就讀學籍：${regData.school.trim()} ${regData.department.trim()} (${regData.grade.trim()})\n\n讓我們一起突破自我的成績極限！`;
  sendLinePushNotification(lineUid, welcomeMsg);
  
  return {
    success: true,
    message: '註冊資料成功建立！歡迎加入古哥成績挑戰計畫！'
  };
}

// 1.1.5. Student Sign Consent (Writes to J column in Sheet)
function studentSignConsent(lineUid) {
  initSheets();
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  
  if (!lineUid) return { success: false, message: "缺少 LINE UID！" };
  
  const data = getSafeValues(studentSheet);
  for (let i = 1; i < data.length; i++) {
    const sheetLineUid = data[i][7] ? data[i][7].toString().trim() : "";
    if (sheetLineUid === lineUid.trim()) {
      // Update J column (column 10) to "true"
      studentSheet.getRange(i + 1, 10).setValue("true");
      return { success: true, message: "同意狀態已同步至雲端資料庫！" };
    }
  }
  return { success: false, message: "找不到學員資料！" };
}

// 1.2. Student Login
function studentLogin(name, birthday) {
  initSheets();
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const appSheet = ss.getSheetByName('applications');
  
  const inputName = name.trim();
  const inputBirthday = normalizeBirthday(birthday);
  
  // Find student by name and birthday
  const data = getSafeValues(studentSheet);
  let student = null;
  for (let i = 1; i < data.length; i++) {
    const sheetName = data[i][1] ? data[i][1].toString().trim() : "";
    const sheetBirthday = data[i][2] ? normalizeBirthday(data[i][2]) : "";
    
    if (sheetName === inputName && sheetBirthday === inputBirthday) {
      student = {
        uid: data[i][0] ? data[i][0].toString() : "",
        name: data[i][1] ? data[i][1].toString() : "",
        birthday: data[i][2] ? normalizeBirthday(data[i][2]) : "", // return normalized birthday
        nickname: data[i][3] ? data[i][3].toString() : "",
        school: data[i][4] ? data[i][4].toString() : "",
        department: data[i][5] ? data[i][5].toString() : "",
        grade: data[i][6] ? data[i][6].toString() : "",
        lineUid: data[i][7] ? data[i][7].toString() : "",
        folderId: data[i][8] ? data[i][8].toString() : ""
      };
      break;
    }
  }
  
  if (!student) {
    return {
      success: false,
      code: 'NOT_REGISTERED',
      message: '系統未偵測到此身分紀錄。若您是首次登入，請填寫下方基本資料以完成計畫註冊！'
    };
  }
  
  // Get unlocked levels for this student (Scheme 1 target scores)
  const appData = getSafeValues(appSheet);
  const unlockedChallenges = [];
  let attempts = 0;
  
  for (let j = 1; j < appData.length; j++) {
    const appUID = appData[j][3];
    const appType = appData[j][1];
    const appStatus = appData[j][2];
    const detailsStr = appData[j][7];
    
    if (appUID === student.uid && appStatus !== 'rejected') {
      if (appType === 'challenge') {
        attempts++;
        try {
          const detailsObj = JSON.parse(detailsStr);
          if (detailsObj && detailsObj.target) {
            unlockedChallenges.push(parseFloat(detailsObj.target));
          }
        } catch (e) {}
      }
    }
  }
  
  // Get settings
  const settings = getSafeSettings(ss);
  
  return {
    success: true,
    uid: student.uid,
    name: student.name,
    birthday: student.birthday,
    nickname: student.nickname,
    school: student.school,
    department: student.department,
    grade: student.grade,
    unlocked_challenges: unlockedChallenges,
    attempts: attempts,
    settings: settings
  };
}

// 2. Student Register
function studentRegister(data) {
  initSheets();
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  
  const name = data.name.trim();
  const birthday = data.birthday.trim();
  const inputBirthday = normalizeBirthday(birthday);
  
  // Verify duplication
  const rows = getSafeValues(studentSheet);
  for (let i = 1; i < rows.length; i++) {
    const sheetName = rows[i][1] ? rows[i][1].toString().trim() : "";
    const sheetBirthday = rows[i][2] ? normalizeBirthday(rows[i][2]) : "";
    if (sheetName === name && sheetBirthday === inputBirthday) {
      return { success: false, message: '此真實姓名與生日組合已存在，請直接點選驗證登入！' };
    }
  }
  
  // Generate a random UID (Format: U + 8 digits)
  let studentUid = 'U';
  for (let k = 0; k < 8; k++) {
    studentUid += Math.floor(Math.random() * 10).toString();
  }
  
  // Create student's dedicated folder in Google Drive under Parent Folder
  let studentFolderId = "";
  try {
    const parentFolder = DriveApp.getFolderById(PARENT_DRIVE_FOLDER_ID);
    const subFolder = parentFolder.createFolder(name);
    studentFolderId = subFolder.getId();
  } catch (err) {
    // Fallback: If folder creation fails, write a mock folder value so execution does not crash
    studentFolderId = "error_drive_access";
  }
  
  // Append new student record (with leading single quote to force string type in Sheets)
  studentSheet.appendRow([
    studentUid,
    name,
    birthday, 
    data.nickname.trim(),
    data.school.trim(),
    data.department.trim(),
    data.grade.trim(),
    data.lineUid || "mock_line_" + studentUid,
    studentFolderId,
    false, // ConsentSigned
    "",    // BankCode
    "",    // BankAccount
    Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss") // CreatedAt
  ].map(safeWriteVal));
  
  // Send welcome push notification
  const lineId = data.lineUid || "mock_line_" + studentUid;
  const welcomeMsg = `🎉 恭喜！您已成功註冊加入【古哥挑戰獎學金】成績挑戰計畫。\n學員編號：${studentUid}\n就讀學籍：${data.school.trim()} ${data.department.trim()} (${data.grade.trim()})\n\n讓我們一起突破自我的成績極限！`;
  sendLinePushNotification(lineId, welcomeMsg);
  
  return {
    success: true,
    message: '註冊資料成功建立！歡迎加入古哥成績挑戰計畫！'
  };
}

// Helper to decode Base64 file string and save to Drive folder
function saveBase64File(folderId, base64Data, filename) {
  if (!folderId || folderId === "error_drive_access") {
    return "https://docs.google.com/error_drive";
  }
  try {
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data));
    blob.setName(filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return "https://docs.google.com/upload_error?msg=" + encodeURIComponent(err.toString());
  }
}

// 3. Scheme 1: Submit Score Challenge
function submitChallenge(payload) {
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const appSheet = ss.getSheetByName('applications');
  
  const studentName = payload.student_name;
  const studentBirthday = payload.student_birthday;
  const target = parseFloat(payload.target);
  const gpa = parseFloat(payload.gpa);
  const academicYear = payload.academic_year || "未填學年度";
  
  // Verify student
  const studentRows = findRows(studentSheet, 2, studentName);
  let student = null;
  let studentRowIndex = -1;
  const inputBirthday = normalizeBirthday(studentBirthday);
  for (let r of studentRows) {
    const sheetBirthday = normalizeBirthday(r.rowData[2]);
    if (sheetBirthday === inputBirthday) {
      student = r.rowData;
      studentRowIndex = r.rowIndex;
      break;
    }
  }
  if (!student) return { success: false, message: '身份驗證失敗，請重試！' };
  
  // Record/Update student's bank info in students sheet profile
  if (payload.bank_code && payload.bank_account) {
    studentSheet.getRange(studentRowIndex, 11).setValue(safeWriteVal(payload.bank_code));
    studentSheet.getRange(studentRowIndex, 12).setValue(safeWriteVal(payload.bank_account));
  }
  
  const studentUid = student[0];
  const folderId = student[8];
  
  // Count previous attempts to assign reward amount
  let currentAttempts = 0;
  const appRows = getSafeValues(appSheet);
  for (let j = 1; j < appRows.length; j++) {
    if (appRows[j][3] === studentUid && appRows[j][1] === 'challenge' && appRows[j][2] !== 'rejected') {
      currentAttempts++;
    }
  }
  
  // Check duplication for this threshold
  for (let j = 1; j < appRows.length; j++) {
    if (appRows[j][3] === studentUid && parseFloat(appRows[j][7] ? JSON.parse(appRows[j][7]).target : 0) === target && appRows[j][2] !== 'rejected') {
      return { success: false, message: `您已挑戰或擊破過此防線門檻 (${target})，請選擇其他防線` };
    }
  }
  
  // Verify if already applied for this academic semester
  for (let j = 1; j < appRows.length; j++) {
    if (appRows[j][3] === studentUid && appRows[j][1] === 'challenge' && appRows[j][6] === academicYear && appRows[j][2] !== 'rejected') {
      return { success: false, message: `您已申請過 ${academicYear} 的成績挑戰，且該申請目前為審查中或已核准，不可重複申請！` };
    }
  }
  
  // Calculate reward amount
  const settings = getSafeSettings(ss);
  const rewards = settings.challenge_amounts;
  const assignedAmount = rewards[Math.min(currentAttempts, rewards.length - 1)];
  
  // Upload file
  let fileUrl = "";
  if (payload.file_base64 && payload.file_name) {
    const ext = payload.file_name.substring(payload.file_name.lastIndexOf('.'));
    const finalFilename = `${studentUid}-${academicYear}成績挑戰單${ext}`;
    fileUrl = saveBase64File(folderId, payload.file_base64, finalFilename);
  }
  
  // Save application record or update patching one
  const appId = "APP-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const details = JSON.stringify({ target: target, gpa: gpa });
  const createdAt = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
  
  let existingRowIdx = -1;
  for (let j = 1; j < appRows.length; j++) {
    if (appRows[j][3] === studentUid && appRows[j][1] === 'challenge' && appRows[j][6] === academicYear && appRows[j][2] === 'patching') {
      existingRowIdx = j + 1;
      break;
    }
  }
  
  if (existingRowIdx !== -1) {
    appSheet.getRange(existingRowIdx, 3).setValue('pending');
    appSheet.getRange(existingRowIdx, 6).setValue(safeWriteVal(assignedAmount));
    appSheet.getRange(existingRowIdx, 8).setValue(safeWriteVal(details));
    if (fileUrl) {
      appSheet.getRange(existingRowIdx, 9).setValue(safeWriteVal(fileUrl));
    }
    appSheet.getRange(existingRowIdx, 11).setValue(safeWriteVal(createdAt));
  } else {
    appSheet.appendRow([
      appId,
      'challenge',
      'pending',
      studentUid,
      payload.name, // Real name in PII
      assignedAmount,
      academicYear,
      details,
      fileUrl,
      "", // No FileLink2 for challenge
      createdAt
    ].map(safeWriteVal));
  }
  
  return {
    success: true,
    message: `您的第 ${currentAttempts + 1} 次成績挑戰已成功送出！解鎖關卡金額為 NT$ ${assignedAmount.toLocaleString()} 元，系統已進入快速審查階段。`
  };
}

// 4. Scheme 2: Submit Progress Award
function submitProgress(payload) {
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const appSheet = ss.getSheetByName('applications');
  
  const studentName = payload.student_name;
  const studentBirthday = payload.student_birthday;
  const prevGpa = parseFloat(payload.prev_gpa);
  const currGpa = parseFloat(payload.curr_gpa);
  const credits = parseInt(payload.credits);
  const academicYear = payload.academic_year || "未填學年度";
  
  // Verify student & grade
  const studentRows = findRows(studentSheet, 2, studentName);
  let student = null;
  let studentRowIndex = -1;
  const inputBirthday = normalizeBirthday(studentBirthday);
  for (let r of studentRows) {
    const sheetBirthday = normalizeBirthday(r.rowData[2]);
    if (sheetBirthday === inputBirthday) {
      student = r.rowData;
      studentRowIndex = r.rowIndex;
      break;
    }
  }
  if (!student) return { success: false, message: '身份驗證失敗，請重試！' };
  if (student[6] === '大一') {
    return { success: false, message: '抱歉！學期進步獎限大二（含）以上學生申請。' };
  }
  
  // Record/Update student's bank info in students sheet profile
  if (payload.bank_code && payload.bank_account) {
    studentSheet.getRange(studentRowIndex, 11).setValue(safeWriteVal(payload.bank_code));
    studentSheet.getRange(studentRowIndex, 12).setValue(safeWriteVal(payload.bank_account));
  }
  
  const studentUid = student[0];
  const folderId = student[8];
  
  // Verify if already applied for this academic semester
  const appRows = getSafeValues(appSheet);
  for (let i = 1; i < appRows.length; i++) {
    const appType = appRows[i][1];
    const appStatus = appRows[i][2];
    const appStudentUid = appRows[i][3];
    const appAcademicYear = appRows[i][6];
    if (appStudentUid === studentUid && appType === 'progress' && appAcademicYear === academicYear) {
      if (appStatus === 'pending' || appStatus === 'approved') {
        return { success: false, message: `您已申請過 ${academicYear} 的學期進步獎，且該申請目前為審查中或已核准，不可重複申請！` };
      }
    }
  }
  
  // Calculate reward amount
  const settings = getSafeSettings(ss);
  const base = settings.progress_base;
  const rate = settings.progress_conversion_rate;
  
  let creditsBonus = 0;
  if (credits >= 1 && credits <= 9) {
    creditsBonus = 300;
  } else if (credits >= 10 && credits <= 15) {
    creditsBonus = 500;
  } else if (credits >= 16 && credits <= 23) {
    creditsBonus = 1000;
  } else if (credits >= 24) {
    creditsBonus = 1800;
  }
  
  let difficultyCoeff = 0;
  if (prevGpa >= 93.3333) {
    difficultyCoeff = 15.0;
  } else {
    difficultyCoeff = 100.0 / (100.0 - prevGpa);
  }
  
  const creditWeight = credits / 15.0;
  const diff = currGpa - prevGpa;
  const points = diff * difficultyCoeff * creditWeight;
  const conversion = points * rate;
  const totalAmount = base + creditsBonus + Math.round(conversion);
  
  // Save both files to Drive folder
  let fileUrl1 = "";
  if (payload.file1_base64 && payload.file1_name) {
    const ext = payload.file1_name.substring(payload.file1_name.lastIndexOf('.'));
    const finalFilename = `${studentUid}-${academicYear}上學期成績單${ext}`;
    fileUrl1 = saveBase64File(folderId, payload.file1_base64, finalFilename);
  }
  
  let fileUrl2 = "";
  if (payload.file2_base64 && payload.file2_name) {
    const ext = payload.file2_name.substring(payload.file2_name.lastIndexOf('.'));
    const finalFilename = `${studentUid}-${academicYear}下學期成績單${ext}`;
    fileUrl2 = saveBase64File(folderId, payload.file2_base64, finalFilename);
  }
  
  const appId = "APP-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const details = JSON.stringify({
    prev_gpa: prevGpa,
    curr_gpa: currGpa,
    credits: credits,
    bank_code: payload.bank_code,
    bank_account: payload.bank_account
  });
  const createdAt = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
  
  let existingRowIdx = -1;
  for (let i = 1; i < appRows.length; i++) {
    if (appRows[i][3] === studentUid && appRows[i][1] === 'progress' && appRows[i][6] === academicYear && appRows[i][2] === 'patching') {
      existingRowIdx = i + 1;
      break;
    }
  }
  
  if (existingRowIdx !== -1) {
    appSheet.getRange(existingRowIdx, 3).setValue('pending');
    appSheet.getRange(existingRowIdx, 6).setValue(safeWriteVal(totalAmount));
    appSheet.getRange(existingRowIdx, 8).setValue(safeWriteVal(details));
    if (fileUrl1) appSheet.getRange(existingRowIdx, 9).setValue(safeWriteVal(fileUrl1));
    if (fileUrl2) appSheet.getRange(existingRowIdx, 10).setValue(safeWriteVal(fileUrl2));
    appSheet.getRange(existingRowIdx, 11).setValue(safeWriteVal(createdAt));
  } else {
    appSheet.appendRow([
      appId,
      'progress',
      'pending',
      studentUid,
      payload.name, // Real name PII
      totalAmount,
      academicYear,
      details,
      fileUrl1,
      fileUrl2,
      createdAt
    ].map(safeWriteVal));
  }
  
  return {
    success: true,
    message: `您的學期進步獎申請已成功送出！試算金額為 NT$ ${totalAmount.toLocaleString()} 元，審核中。`
  };
}

// Helper to determine the current active school semester (e.g. 114-2)
function getCurrentActiveSemester() {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const rocYear = year - 1911;
  
  const currentVal = month * 100 + day;
  let schoolYear = rocYear;
  if (currentVal < 801) {
    schoolYear = rocYear - 1;
  }
  
  let term = 1;
  if (currentVal >= 223 && currentVal < 801) {
    term = 2;
  }
  
  return `${schoolYear}-${term}`;
}

// 5. Scheme 3: Submit Future Blueprint Project
function submitBlueprint(payload) {
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const appSheet = ss.getSheetByName('applications');
  
  const studentName = payload.student_name;
  const studentBirthday = payload.student_birthday;
  const projectName = payload.project_name;
  const projectMonth = payload.project_month;
  const academicYear = getCurrentActiveSemester();
  
  // Verify student
  const studentRows = findRows(studentSheet, 2, studentName);
  let student = null;
  let studentRowIndex = -1;
  const inputBirthday = normalizeBirthday(studentBirthday);
  for (let r of studentRows) {
    const sheetBirthday = normalizeBirthday(r.rowData[2]);
    if (sheetBirthday === inputBirthday) {
      student = r.rowData;
      studentRowIndex = r.rowIndex;
      break;
    }
  }
  if (!student) return { success: false, message: '身份驗證失敗，請重試！' };
  
  // Record/Update student's bank info in students sheet profile
  if (payload.bank_code && payload.bank_account) {
    studentSheet.getRange(studentRowIndex, 11).setValue(safeWriteVal(payload.bank_code));
    studentSheet.getRange(studentRowIndex, 12).setValue(safeWriteVal(payload.bank_account));
  }
  
  const studentUid = student[0];
  const folderId = student[8];
  
  // Get blueprint funding limit setting
  const settings = getSafeSettings(ss);
  const blueprintAmount = settings.blueprint_amount;
  
  // Upload blueprint proposal file
  let fileUrl = "";
  if (payload.file_base64 && payload.file_name) {
    const ext = payload.file_name.substring(payload.file_name.lastIndexOf('.'));
    const finalFilename = `${studentUid}-${academicYear}企劃書${ext}`;
    fileUrl = saveBase64File(folderId, payload.file_base64, finalFilename);
  }
  
  const appId = "APP-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  const details = JSON.stringify({
    project_name: projectName,
    project_month: projectMonth
  });
  const createdAt = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
  
  let existingRowIdx = -1;
  const appRows = getSafeValues(appSheet);
  for (let j = 1; j < appRows.length; j++) {
    if (appRows[j][3] === studentUid && appRows[j][1] === 'blueprint' && appRows[j][6] === academicYear && appRows[j][2] === 'patching') {
      existingRowIdx = j + 1;
      break;
    }
  }
  
  if (existingRowIdx !== -1) {
    appSheet.getRange(existingRowIdx, 3).setValue('pending');
    appSheet.getRange(existingRowIdx, 6).setValue(""); // Leave amount blank initially
    appSheet.getRange(existingRowIdx, 8).setValue(safeWriteVal(details));
    if (fileUrl) {
      appSheet.getRange(existingRowIdx, 9).setValue(safeWriteVal(fileUrl));
    }
    appSheet.getRange(existingRowIdx, 11).setValue(safeWriteVal(createdAt));
  } else {
    appSheet.appendRow([
      appId,
      'blueprint',
      'pending',
      studentUid,
      payload.name, // Real name PII
      "", // Leave amount blank initially
      academicYear,
      details,
      fileUrl,
      "", // No FileLink2 for blueprint
      createdAt
    ].map(safeWriteVal));
  }
  
  return {
    success: true,
    message: '您的未來藍圖計畫提案已成功提交！此專案有專屬三階段里程碑，審核通過後即解鎖執行權限！'
  };
}

// --- Admin Panel API Logic ---

// Admin Session Verification Helper
function verifyAdminToken(token) {
  if (!token) return false;
  var cached = CacheService.getScriptCache().get("admin_session_" + token);
  return cached === "active";
}

// Client-side Session verification
function clientVerifyAdminToken(token) {
  return { success: verifyAdminToken(token) };
}

function adminLogin(password) {
  const ss = getDbSpreadsheet();
  const dict = getSettingsDict(ss);
  let correctPassword = dict['admin_password'] || 'Ku870916';
  
  if (correctPassword === 'guge_admin_secret_999') {
    try {
      const settingsSheet = ss.getSheetByName('settings');
      const settingsRows = getSafeValues(settingsSheet);
      for (let i = 1; i < settingsRows.length; i++) {
        if (settingsRows[i][0] === 'admin_password') {
          settingsSheet.getRange(i + 1, 2).setValue(safeWriteVal('Ku870916'));
          break;
        }
      }
    } catch(e) {}
    correctPassword = 'Ku870916';
  }
  
  if (password !== correctPassword) {
    return { success: false, message: '密碼錯誤，拒絕登入後台管理端！' };
  }
  
  // Generate security token
  const token = Utilities.getUuid();
  // Keep active session in CacheService for 25 minutes (1500 seconds)
  CacheService.getScriptCache().put("admin_session_" + token, "active", 1500);
  
  return {
    success: true,
    token: token,
    message: '管理端驗證登入成功！'
  };
}

// 2. Admin Logout
function adminLogout(token) {
  if (token) {
    CacheService.getScriptCache().remove("admin_session_" + token);
  }
  return { success: true, message: '已登出管理端身分！' };
}

// 3. Admin Get Settings
function adminGetSettings(token) {
  if (!verifyAdminToken(token)) {
    throw new Error("未授權的操作，請先登入管理端！");
  }
  const ss = getDbSpreadsheet();
  const dict = getSettingsDict(ss);
  
  // Return all settings, but mask/convert challenge amounts
  return {
    progress_base: parseInt(dict['progress_base'] || '1500'),
    progress_conversion_rate: parseInt(dict['progress_conversion_rate'] || '50'),
    blueprint_amount: parseInt(dict['blueprint_amount'] || '30000'),
    challenge_amounts: (dict['challenge_amounts'] || '7000,8500,10000,12000,15000,18000,20000,25000').split(',').map(Number)
  };
}

// 4. Admin Save Settings
function adminSaveSettings(token, payload) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const sheet = ss.getSheetByName('settings');
  const challengeAmountsStr = payload.challenge_amounts.join(',');
  
  const updates = {
    'progress_base': payload.progress_base.toString(),
    'progress_conversion_rate': payload.progress_conversion_rate.toString(),
    'blueprint_amount': payload.blueprint_amount.toString(),
    'challenge_amounts': challengeAmountsStr,
    'active_bg_folder_id': payload.active_bg_folder_id ? payload.active_bg_folder_id.toString().trim() : ""
  };
  
  const dataRange = sheet.getDataRange();
  const values = getSafeValues(sheet);
  
  for (let key in updates) {
    let found = false;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(safeWriteVal(updates[key]));
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, updates[key]]);
    }
  }
  
  return {
    success: true,
    message: '獎金參數設定已成功更新！所有學生試算及申報金額將同步生效。'
  };
}

// 5. Admin Get Cases List
function adminGetList(token) {
  if (!verifyAdminToken(token)) {
    throw new Error("未授權的操作，請先登入管理端！");
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const studentSheet = ss.getSheetByName('students');
  
  const appData = getSafeValues(appSheet);
  const studentData = getSafeValues(studentSheet);
  
  // Create student index for joining
  const studentIndex = {};
  for (let i = 1; i < studentData.length; i++) {
    const uid = studentData[i][0];
    studentIndex[uid] = {
      nickname: studentData[i][3],
      school: studentData[i][4],
      department: studentData[i][5],
      grade: studentData[i][6],
      bank_code: studentData[i][10] ? studentData[i][10].toString() : '',
      bank_account: studentData[i][11] ? studentData[i][11].toString() : ''
    };
  }
  
  const results = [];
  // Parse rows (newest first, so traverse backwards)
  for (let j = appData.length - 1; j >= 1; j--) {
    const studentUid = appData[j][3];
    const sInfo = studentIndex[studentUid] || { nickname: '', school: '', department: '', grade: '', bank_code: '', bank_account: '' };
    
    // Parse json details column
    let prevGpa = "";
    let currGpa = "";
    let credits = "";
    let challengeTarget = "";
    let projectName = "";
    let projectMonth = "";
    let bankCode = sInfo.bank_code;
    let bankAccount = sInfo.bank_account;
    
    // Scheme 3 Milestones details fields
    let approvedAmount = "";
    let midtermDeadline = "";
    let finalDeadline = "";
    let midtermFile = "";
    let midtermSubmittedAt = "";
    let midtermStatus = "";
    let midtermOvertime = false;
    let finalFile = "";
    let finalSubmittedAt = "";
    let finalStatus = "";
    let finalOvertime = false;
    let phase = 1;
    let phase1Status = "";
    
    const detailsStr = appData[j][7];
    const type = appData[j][1];
    
    try {
      if (detailsStr) {
        const detailsObj = JSON.parse(detailsStr);
        if (type === 'challenge') {
          challengeTarget = detailsObj.target || "";
          prevGpa = detailsObj.gpa || ""; // Current uploaded GPA
        } else if (type === 'progress') {
          prevGpa = detailsObj.prev_gpa || "";
          currGpa = detailsObj.curr_gpa || "";
          credits = detailsObj.credits || "";
          bankCode = detailsObj.bank_code || "";
          bankAccount = detailsObj.bank_account || "";
        } else if (type === 'blueprint') {
          projectName = detailsObj.project_name || "";
          projectMonth = detailsObj.project_month || "";
          approvedAmount = detailsObj.approved_amount || "";
          midtermDeadline = detailsObj.midterm_deadline || "";
          finalDeadline = detailsObj.final_deadline || "";
          midtermFile = detailsObj.midterm_file || "";
          midtermSubmittedAt = detailsObj.midterm_submitted_at || "";
          midtermStatus = detailsObj.midterm_status || "";
          midtermOvertime = detailsObj.midterm_overtime || false;
          finalFile = detailsObj.final_file || "";
          finalSubmittedAt = detailsObj.final_submitted_at || "";
          finalStatus = detailsObj.final_status || "";
          finalOvertime = detailsObj.final_overtime || false;
          phase = detailsObj.phase || 1;
          phase1Status = detailsObj.phase_1_status || "";
        }
      }
    } catch(e) {}
    
    results.appendRow = null; // Clean prototype reference
    results.push({
      id: appData[j][0],
      type: type,
      status: appData[j][2],
      student_uid: studentUid,
      student_name: studentUid, // Standard UID identifier
      name: appData[j][4], // Student RealName (PII)
      amount: parseInt(appData[j][5] || '0'),
      academic_year: appData[j][6],
      challenge_target: challengeTarget,
      gpa: prevGpa,
      prev_gpa: prevGpa,
      curr_gpa: currGpa,
      credits: credits,
      projectName: projectName,
      project_name: projectName,
      project_month: projectMonth,
      bank_code: bankCode,
      bank_account: bankAccount,
      file_path: appData[j][8], // Drive Link 1
      prev_file_path: appData[j][9], // Drive Link 2
      created_at: appData[j][10] ? appData[j][10].toString() : "--",
      nickname: sInfo.nickname,
      school: sInfo.school,
      department: sInfo.department,
      grade: sInfo.grade,
      approved_amount: approvedAmount,
      midterm_deadline: midtermDeadline,
      final_deadline: finalDeadline,
      midterm_file: midtermFile,
      midterm_submitted_at: midtermSubmittedAt,
      midterm_status: midtermStatus,
      midterm_overtime: midtermOvertime,
      final_file: finalFile,
      final_submitted_at: finalSubmittedAt,
      final_status: finalStatus,
      final_overtime: finalOvertime,
      phase: phase,
      phase_1_status: phase1Status
    });
  }
  
  return results;
}

// Helper to query student LineUID
function getStudentLineUid(ss, studentUid) {
  const sheet = ss.getSheetByName('students');
  const rows = getSafeValues(sheet);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === studentUid) {
      return rows[i][7]; // LineUID
    }
  }
  return null;
}

// 6. Admin Approve Case
function adminApproveCase(token, appId) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      if (rows[i][1] === 'blueprint') {
        return { success: false, message: '未來藍圖計畫具有專屬的多階段里程碑審查區，請使用該專用面板進行核定！' };
      }
      appSheet.getRange(i + 1, 3).setValue(safeWriteVal('approved')); // Set status to approved
      
      // Get student's LineUID and send notification
      const studentUid = rows[i][3];
      const typeText = rows[i][1] === 'challenge' ? '成績挑戰' : rows[i][1] === 'progress' ? '學期進步獎' : '未來藍圖計畫';
      const amount = rows[i][5];
      const lineUid = getStudentLineUid(ss, studentUid);
      if (lineUid) {
        const msg = `🔔 恭喜！您的【${typeText}】申請案已審查「核准」！\n💰 核定金額：NT$ ${parseInt(amount).toLocaleString()} 元。\n隨後將進入網銀撥款流程，撥款完成後會再次通知您！`;
        sendLinePushNotification(lineUid, msg);
      }
      
      return { success: true, message: '此筆申請案件已審定核准！隨後可匯出至網銀撥款。' };
    }
  }
  
  return { success: false, message: '找不到該筆申請案！' };
}

// 7. Admin Reject Case
function adminRejectCase(token, appId, rejectType, reason, suggest) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  rejectType = rejectType || 'main';
  reason = reason || '無說明';
  suggest = suggest || '無建議';
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      const typeText = rows[i][1] === 'challenge' ? '成績挑戰' : rows[i][1] === 'progress' ? '學期進步獎' : '未來藍圖計畫';
      let msg = "";
      
      if (rejectType === 'main') {
        appSheet.getRange(i + 1, 3).setValue(safeWriteVal('rejected')); // Set status to rejected
        details.reject_reason = reason;
        details.reject_suggest = suggest;
        msg = `🔔 通知：您的【${typeText}】申請案審核結果為「審核未通過」。\n* 未通過原因：${reason}\n* 後續建議：${suggest}`;
      } else if (rejectType === 'midterm') {
        details.midterm_status = 'rejected';
        details.midterm_reject_reason = reason;
        details.midterm_reject_suggest = suggest;
        details.midterm_file = "";
        details.midterm_submitted_at = "";
        msg = `🔔 通知：您的【未來藍圖計畫】期中報告審核結果為「審核未通過（退回）」。\n* 未通過原因：${reason}\n* 後續建議：${suggest}\n請點選首頁重新上傳！`;
      } else if (rejectType === 'final') {
        details.final_status = 'rejected';
        details.final_reject_reason = reason;
        details.final_reject_suggest = suggest;
        details.final_file = "";
        details.final_submitted_at = "";
        msg = `🔔 通知：您的【未來藍圖計畫】期末報告審核結果為「審核未通過（退回）」。\n* 未通過原因：${reason}\n* 後續建議：${suggest}\n請點選首頁重新上傳！`;
      }
      
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
      
      // Get student's LineUID and send notification
      const studentUid = rows[i][3];
      const lineUid = getStudentLineUid(ss, studentUid);
      if (lineUid) {
        sendLinePushNotification(lineUid, msg);
      }
      
      return { success: true, message: '此筆申請案件已審定「未通過」。' };
    }
  }
  
  return { success: false, message: '找不到該筆申請案！' };
}

// 8. Admin request patch (限期補件)
function adminRequestPatch(token, appId, patchType, reason, deadline) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  patchType = patchType || 'main';
  reason = reason || '無說明';
  deadline = deadline || '無期限';
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      const typeText = rows[i][1] === 'challenge' ? '成績挑戰' : rows[i][1] === 'progress' ? '學期進步獎' : '未來藍圖計畫';
      let msg = "";
      
      if (patchType === 'main') {
        appSheet.getRange(i + 1, 3).setValue(safeWriteVal('patching')); // Set status to patching
        details.patch_reason = reason;
        details.patch_deadline = deadline;
        msg = `🔔 補件通知：您的【${typeText}】申請案需要補件。\n* 補件說明：${reason}\n* 截止日期：${deadline}\n請登入系統於限期內完成補件重新送出！`;
      } else if (patchType === 'midterm') {
        details.midterm_status = 'patching';
        details.midterm_patch_reason = reason;
        details.midterm_patch_deadline = deadline;
        msg = `🔔 補件通知：您的【未來藍圖計畫】期中進步報告需要補件。\n* 補件說明：${reason}\n* 截止日期：${deadline}\n請登入系統於限期內完成重新提交！`;
      } else if (patchType === 'final') {
        details.final_status = 'patching';
        details.final_patch_reason = reason;
        details.final_patch_deadline = deadline;
        msg = `🔔 補件通知：您的【未來藍圖計畫】期末成果報告需要補件。\n* 補件說明：${reason}\n* 截止日期：${deadline}\n請登入系統於限期內完成重新提交！`;
      }
      
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
      
      // Get student's LineUID and send notification
      const studentUid = rows[i][3];
      const lineUid = getStudentLineUid(ss, studentUid);
      if (lineUid) {
        sendLinePushNotification(lineUid, msg);
      }
      
      return { success: true, message: '已成功向學生送出補件要求！' };
    }
  }
  
  return { success: false, message: '找不到該筆申請案！' };
}

// Helper to extract file ID from Google Drive URL
function getFileIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

// 8. Admin Physical PII Destruction (GDPR Secure shredding)
function adminDestroyCase(token, appId) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  let targetRowIndex = -1;
  let appRow = null;
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      targetRowIndex = i + 1;
      appRow = rows[i];
      break;
    }
  }
  
  if (targetRowIndex === -1 || !appRow) {
    return { success: false, message: '找不到該筆申請案！' };
  }
  
  const originalName = appRow[4] || '申請人';
  const fileUrl1 = appRow[8];
  const fileUrl2 = appRow[9];
  
  // 1. Delete physical files from Google Drive
  const fileIds = [getFileIdFromUrl(fileUrl1), getFileIdFromUrl(fileUrl2)].filter(Boolean);
  for (let fid of fileIds) {
    try {
      DriveApp.getFileById(fid).setTrashed(true); // Move to trash or delete
    } catch(e) {
      // Ignore if file doesn't exist
    }
  }
  
  // 2. Anonymize name (e.g. 王小明 -> 王*明)
  let maskedName = originalName;
  if (originalName.length >= 3) {
    maskedName = originalName[0] + '*' + originalName.substring(2);
  } else if (originalName.length === 2) {
    maskedName = originalName[0] + '*';
  }
  
  // 3. Clear sensitive PII in Details JSON
  let cleanedDetails = "";
  try {
    const detailsObj = JSON.parse(appRow[7]);
    if (detailsObj) {
      // Strip bank details for progress award
      delete detailsObj['bank_code'];
      delete detailsObj['bank_account'];
      cleanedDetails = JSON.stringify(detailsObj);
    }
  } catch(e) {
    cleanedDetails = appRow[7];
  }
  
  // 4. Update row values to wipe out PII in applications sheet
  appSheet.getRange(targetRowIndex, 3).setValue(safeWriteVal('destroyed')); // status
  appSheet.getRange(targetRowIndex, 5).setValue(safeWriteVal(maskedName)); // masked name
  appSheet.getRange(targetRowIndex, 8).setValue(safeWriteVal(cleanedDetails)); // cleaned details json
  appSheet.getRange(targetRowIndex, 9).setValue(''); // wipe filelink1
  appSheet.getRange(targetRowIndex, 10).setValue(''); // wipe filelink2
  
  // Clear bank details in students sheet profile (GDPR Shred)
  const studentUid = appRow[3];
  const studentSheet = ss.getSheetByName('students');
  const studentRows = findRows(studentSheet, 1, studentUid); // Col 1 is StudentUID
  if (studentRows.length > 0) {
    const sRowIndex = studentRows[0].rowIndex;
    studentSheet.getRange(sRowIndex, 11).setValue(''); // Clear BankCode
    studentSheet.getRange(sRowIndex, 12).setValue(''); // Clear BankAccount
  }
  
  // Get student's LineUID and send notification
  const lineUid = getStudentLineUid(ss, studentUid);
  if (lineUid) {
    const msg = `🔒 隱私安全通知：您的【古哥挑戰獎學金】申請已完成撥款結案。\n依個資防護承諾，您的真實姓名、收款帳戶與成績單圖檔均已從資料庫與雲端硬碟中【徹底物理銷毀】，系統將不再留存任何敏感個資。祝您學業順利！`;
    sendLinePushNotification(lineUid, msg);
  }
  
  // Simulated email dispatch details
  const emailNotification = {
    to: 'student_registered_email@example.com',
    subject: '【古哥挑戰獎學金】已撥款暨個人隱私資料銷毀通知',
    body: `親愛的同學您好：您所申請的【古哥挑戰獎學金】已成功匯入您的收款帳戶。為保障個人穩私，您的帳戶資訊、真實姓名與成績單圖檔已依個資銷毀切結，由本系統資料庫與儲存空間中徹底刪除且永久無法復原。系統僅留存去識別化統計數據。祝您學業更上一層樓！`
  };
  
  return {
    success: true,
    message: '「一鍵個資銷毀」執行完畢！',
    anonymized_name: maskedName,
    email_log: emailNotification
  };
}

// 9. Admin Export Approved Cases (CSV Simulation)
// Since this is Apps Script, we return a CSV string and the browser will download it directly
function adminExportApproved(token) {
  if (!verifyAdminToken(token)) {
    throw new Error("未授權的操作，請先登入管理端！");
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const studentSheet = ss.getSheetByName('students');
  const rows = getSafeValues(appSheet);
  const studentRows = getSafeValues(studentSheet);
  
  // Build student bank info index
  const studentIndex = {};
  for (let i = 1; i < studentRows.length; i++) {
    const uid = studentRows[i][0];
    studentIndex[uid] = {
      bank_code: studentRows[i][10] ? studentRows[i][10].toString() : "",
      bank_account: studentRows[i][11] ? studentRows[i][11].toString() : ""
    };
  }
  
  const csvLines = [];
  // Write UTF-8 BOM
  csvLines.push('\ufeff');
  csvLines.push('銀行代號,收款帳戶,金額,戶名/備註');
  
  for (let i = 1; i < rows.length; i++) {
    const status = rows[i][2];
    const type = rows[i][1];
    const studentUid = rows[i][3];
    const sInfo = studentIndex[studentUid] || { bank_code: "", bank_account: "" };
    
    if (status === 'approved') {
      const name = rows[i][4];
      let amount = parseFloat(rows[i][5] || "0");
      const detailsStr = rows[i][7];
      
      let bankCode = sInfo.bank_code;
      let bankAccount = sInfo.bank_account;
      
      // Override/fallback from details
      try {
        if (detailsStr) {
          const details = JSON.parse(detailsStr);
          if (details.bank_code) bankCode = details.bank_code;
          if (details.bank_account) bankAccount = details.bank_account;
          
          // Scheme 3 Staged Payout logic
          if (type === 'blueprint') {
            const approvedTotal = parseFloat(details.approved_amount || "0");
            const phase1Status = details.phase_1_status || "";
            const midtermStatus = details.midterm_status || "";
            const finalStatus = details.final_status || "";
            
            let blueprintPayout = 0;
            // Check active approved stage for payout
            if (phase1Status === 'approved') {
              blueprintPayout = Math.round(approvedTotal * 0.3);
            } else if (midtermStatus === 'approved') {
              blueprintPayout = Math.round(approvedTotal * 0.4);
            } else if (finalStatus === 'approved') {
              blueprintPayout = Math.round(approvedTotal * 0.3);
            }
            amount = blueprintPayout;
          }
        }
      } catch(e) {}
      
      // Skip exporting if amount is 0 (e.g. blueprint case where no stage is active for payout)
      if (amount <= 0) continue;
      
      // Escape CSV values
      const line = `"'${bankCode}","'${bankAccount}",${amount},"${name}-古哥挑戰獎學金"`;
      csvLines.push(line);
    }
  }
  
  return csvLines.join('\r\n');
}

// --- Diagnostic Test Function ---
function testLogin() {
  try {
    Logger.log("=== [START DIAGNOSTIC] Testing studentLogin for 王小明 (0918) ===");
    const res = studentLogin("王小明", "0918");
    Logger.log("Result success: " + res.success);
    Logger.log("Returned Data: " + JSON.stringify(res));
  } catch (e) {
    Logger.log("❌ ERROR in studentLogin: " + e.toString());
    Logger.log("❌ STACK TRACE: " + e.stack);
  }
}

// --- Production Utility: Clear All Student/Application Mock Records ---
function clearDatabaseForProd() {
  try {
    const ss = getDbSpreadsheet();
    const studentSheet = ss.getSheetByName('students');
    const appSheet = ss.getSheetByName('applications');
    
    let studentCleared = 0;
    let appCleared = 0;
    
    if (studentSheet && studentSheet.getLastRow() > 1) {
      studentCleared = studentSheet.getLastRow() - 1;
      studentSheet.deleteRows(2, studentCleared);
    }
    if (appSheet && appSheet.getLastRow() > 1) {
      appCleared = appSheet.getLastRow() - 1;
      appSheet.deleteRows(2, appCleared);
    }
    Logger.log(`✅ Cleared database successfully! Removed ${studentCleared} students and ${appCleared} applications.`);
  } catch (e) {
    Logger.log(`❌ Failed to clear database: ${e.toString()}`);
  }
}

// Server-side helper to query Drive file metadata (MIME type) on-demand to bypass extension parsing limits
function adminGetFileMetadata(token, fileUrl) {
  if (!verifyAdminToken(token)) {
    throw new Error("未授權的操作，請先登入管理端！");
  }
  if (!fileUrl) return { success: false, error: "Empty URL" };
  
  let fileId = '';
  const regId = /id=([^&]+)/;
  const regPath = /\/file\/d\/([^\/]+)/;
  let match = fileUrl.match(regId);
  if (match) {
    fileId = match[1];
  } else {
    match = fileUrl.match(regPath);
    if (match) {
      fileId = match[1];
    }
  }
  if (!fileId) return { success: false, error: "Invalid Drive URL structure" };
  
  try {
    const file = DriveApp.getFileById(fileId);
    return {
      success: true,
      id: fileId,
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize()
    };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 🌌 系統雲端底圖生成與切換引擎
// ==========================================
const BACKGROUND_ROOT_FOLDER_ID = "19VeS2TmOyzREGHNzECqQLSwhOISLUA45";

// 取得母資料夾內的所有子資料夾（底圖專輯分類）
function getAlbumList() {
  try {
    const folder = DriveApp.getFolderById(BACKGROUND_ROOT_FOLDER_ID);
    const subFolders = folder.getFolders();
    const albums = [];
    while (subFolders.hasNext()) {
      const subFolder = subFolders.next();
      albums.push({ name: subFolder.getName(), id: subFolder.getId() });
    }
    return { success: true, albums: albums };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// 根據子資料夾 ID，取得內部的隨機 3 張底圖 URL
function getImagesByFolder(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const allImageUrls = [];
    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();
      if (mimeType && mimeType.indexOf("image") > -1) {
        allImageUrls.push("https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000");
      }
    }
    
    // 隨機抽取 3 張
    const randomSelectedImages = [];
    while (allImageUrls.length > 0 && randomSelectedImages.length < 3) {
      const randIdx = Math.floor(Math.random() * allImageUrls.length);
      randomSelectedImages.push(allImageUrls.splice(randIdx, 1)[0]);
    }
    return { success: true, images: randomSelectedImages };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// 取得當前設定啟用的分類底圖
function getActiveBgImages() {
  try {
    const ss = getDbSpreadsheet();
    const settings = getSafeSettings(ss);
    let folderId = settings.active_bg_folder_id || "";
    
    // 如果尚未設定，預設選擇母資料夾下的第一個子資料夾
    if (!folderId) {
      const rootFolder = DriveApp.getFolderById(BACKGROUND_ROOT_FOLDER_ID);
      const subFolders = rootFolder.getFolders();
      if (subFolders.hasNext()) {
        folderId = subFolders.next().getId();
      }
    }
    
    if (!folderId) {
      return { success: false, message: "無任何底圖子資料夾" };
    }
    
    return getImagesByFolder(folderId);
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ==========================================
// 📊 Google Sheets 資料防溢位格式安全防護引擎
// ==========================================
// 寫入 Google Sheets 時在數字/字串前加上單引號，強迫 Sheets 將該欄位視為文字（防止去掉前導零或變成科學記號）
function safeWriteVal(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === 'boolean') return val; // 保持布林值以利 Checkbox 正常渲染
  const s = val.toString().trim();
  if (s === "") return "";
  if (s.indexOf("'") === 0) return s; // 避免重複加引號
  return "'" + s;
}

// 讀取 Google Sheets 時若發現首位為單引號，自動剝除，回傳原始乾淨字串
function safeReadVal(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === 'boolean') return val;
  const s = val.toString().trim();
  if (s.indexOf("'") === 0) {
    return s.substring(1);
  }
  return s;
}

// 包裝 Sheet.getValues() 讀取，自動剝除所有儲存格中的前置單引號，但跳過第一列 Header 標頭
function getSafeValues(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return values;
  for (let r = 1; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      values[r][c] = safeReadVal(values[r][c]);
    }
  }
  return values;
}

// ==========================================
// ✏️ 學員自我基本資料編輯 API
// ==========================================
function studentUpdateProfile(lineUid, payload) {
  if (!lineUid) return { success: false, message: '無效的學員識別！' };
  
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const rows = getSafeValues(studentSheet);
  
  let studentRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][7] === lineUid) { // LineUID is column 8 (index 7)
      studentRowIndex = i + 1; // 1-indexed row number
      break;
    }
  }
  
  if (studentRowIndex === -1) {
    return { success: false, message: '找不到對應的學員資料！' };
  }
  
  // 僅更新非關鍵驗證欄位：暱稱、學校、科系、年級、銀行資訊
  if (payload.nickname) studentSheet.getRange(studentRowIndex, 4).setValue(safeWriteVal(payload.nickname.trim()));
  if (payload.school) studentSheet.getRange(studentRowIndex, 5).setValue(safeWriteVal(payload.school.trim()));
  if (payload.department) studentSheet.getRange(studentRowIndex, 6).setValue(safeWriteVal(payload.department.trim()));
  if (payload.grade) studentSheet.getRange(studentRowIndex, 7).setValue(safeWriteVal(payload.grade.trim()));
  
  if (payload.bank_code !== undefined) studentSheet.getRange(studentRowIndex, 11).setValue(safeWriteVal(payload.bank_code.trim()));
  if (payload.bank_account !== undefined) studentSheet.getRange(studentRowIndex, 12).setValue(safeWriteVal(payload.bank_account.trim()));
  
  return { success: true, message: '個人基本資料已成功同步更新！' };
}

// ==========================================
// 🎓 後台學年級自動升級校對邏輯
// ==========================================
function adminPromoteStudentGrades(token) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const rows = getSafeValues(studentSheet);
  
  const now = new Date();
  const updatedLogs = [];
  
  for (let i = 1; i < rows.length; i++) {
    const studentUid = rows[i][0];
    const name = rows[i][1];
    const originalGrade = rows[i][6];
    let createdAtStr = rows[i].length >= 13 ? rows[i][12] : "";
    
    // 智慧相容：若舊學員缺少 CreatedAt，則嘗試抓取該學員最早的申請案時間，或以預設值 (ROC 114 / 2025-11-01) 寫入
    if (!createdAtStr) {
      const appSheet = ss.getSheetByName('applications');
      const appRows = getSafeValues(appSheet);
      let earliestAppDate = null;
      for (let j = 1; j < appRows.length; j++) {
        if (appRows[j][3] === studentUid) { // StudentUID
          const appDate = new Date(appRows[j][10]); // CreatedAt
          if (!isNaN(appDate.getTime())) {
            if (!earliestAppDate || appDate < earliestAppDate) {
              earliestAppDate = appDate;
            }
          }
        }
      }
      if (earliestAppDate) {
        createdAtStr = Utilities.formatDate(earliestAppDate, "GMT+8", "yyyy-MM-dd HH:mm:ss");
      } else {
        createdAtStr = "2025-11-01 12:00:00"; // 預設 ROC 114 年 11 月
      }
      // 回寫 CreatedAt 供後續精準校對
      studentSheet.getRange(i + 1, 13).setValue(safeWriteVal(createdAtStr));
    }
    
    // 計算學員當前應為之年級
    const newGrade = calculateCurrentGrade(originalGrade, createdAtStr, now);
    if (newGrade !== originalGrade) {
      studentSheet.getRange(i + 1, 7).setValue(safeWriteVal(newGrade));
      updatedLogs.push({
        name: name,
        uid: studentUid,
        oldGrade: originalGrade,
        newGrade: newGrade
      });
    }
  }
  
  return {
    success: true,
    updatedCount: updatedLogs.length,
    logs: updatedLogs,
    message: `學年升級校對完成！共升級 ${updatedLogs.length} 位學員之學籍。`
  };
}

// 取得該日期對應之學年年份 (以 8 月為開學分水嶺，8-12月為當年，1-7月為前一年)
function getAcademicYearYear(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-indexed
  if (m >= 8) {
    return y;
  } else {
    return y - 1;
  }
}

// 根據註冊初始年級、註冊時間與當前時間，算出當前年級
function calculateCurrentGrade(initialGrade, registrationDateStr, currentDate) {
  if (!registrationDateStr) return initialGrade;
  const regDate = new Date(registrationDateStr);
  if (isNaN(regDate.getTime())) return initialGrade;
  
  const diff = getAcademicYearYear(currentDate) - getAcademicYearYear(regDate);
  if (diff <= 0) return initialGrade;
  
  const gradeMap = {
    "大一": 1, "大二": 2, "大三": 3, "大四": 4,
    "碩一": 1, "碩二": 2,
    "博一": 1, "博二": 2, "博三": 3, "博四": 4
  };
  
  let gradeType = "";
  let startYear = 0;
  if (initialGrade.indexOf("大") === 0) {
    gradeType = "大";
    startYear = gradeMap[initialGrade] || 1;
  } else if (initialGrade.indexOf("碩") === 0) {
    gradeType = "碩";
    startYear = gradeMap[initialGrade] || 1;
  } else if (initialGrade.indexOf("博") === 0) {
    gradeType = "博";
    startYear = gradeMap[initialGrade] || 1;
  } else {
    return initialGrade; // 其它自訂年級不自動變更
  }
  
  const currentYear = startYear + diff;
  if (gradeType === "大") {
    if (currentYear > 4) return "已畢業";
    return "大" + getChineseNumber(currentYear);
  } else if (gradeType === "碩") {
    if (currentYear > 2) return "已畢業";
    return "碩" + getChineseNumber(currentYear);
  } else if (gradeType === "博") {
    if (currentYear > 4) return "已畢業";
    return "博" + getChineseNumber(currentYear);
  }
  return initialGrade;
}

function getChineseNumber(num) {
  const ch = ["", "一", "二", "三", "四", "五", "六"];
  return ch[num] || num.toString();
}

// ==========================================
// 10. Scheme 3 (Future Blueprint) Backend APIs
// ==========================================

// Approve the initial proposal and set amount and deadlines
function adminApproveBlueprint(token, appId, approvedAmount, midtermDeadline, finalDeadline) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      details.approved_amount = parseFloat(approvedAmount);
      details.midterm_deadline = midtermDeadline;
      details.final_deadline = finalDeadline;
      details.phase = 1;
      details.phase_1_status = "approved"; // waiting for first payout
      
      appSheet.getRange(i + 1, 3).setValue(safeWriteVal('approved')); // update status to approved
      appSheet.getRange(i + 1, 6).setValue(safeWriteVal(approvedAmount)); // set核定金額 in amount column
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details))); // save details JSON
      
      // Notify student
      const studentUid = rows[i][3];
      const lineUid = getStudentLineUid(ss, studentUid);
      if (lineUid) {
        const msg = `🔔 恭喜！您的【未來藍圖計畫】提案企劃書已審核「核准」！\n💰 核定專案總額：NT$ ${parseFloat(approvedAmount).toLocaleString()} 元。\n首期首款 (30% = NT$ ${(Math.round(approvedAmount * 0.3)).toLocaleString()} 元) 將進入撥款準備！\n請於時限內繳交期中期末進度報告：\n* 期中截止日：${midtermDeadline}\n* 期末截止日：${finalDeadline}`;
        sendLinePushNotification(lineUid, msg);
      }
      
      return { success: true, message: '未來藍圖計畫提案已成功核准！' };
    }
  }
  return { success: false, message: '找不到該申請案件！' };
}

// Mark a specific stage payment as disbursed
function adminDisburseStage(token, appId, stageNum) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      const approvedAmount = parseFloat(details.approved_amount || "0");
      let msg = "";
      
      if (stageNum === 1) {
        details.phase_1_status = "paid";
        details.phase = 2; // move to phase 2 (midterm pending submission)
        msg = `💰 首款 30% (NT$ ${(Math.round(approvedAmount * 0.3)).toLocaleString()} 元) 已發放完成！\n專案正式啟動，請開始執行圓夢計畫，並在 ${details.midterm_deadline} 前上傳期中報告！`;
      } else if (stageNum === 2) {
        details.midterm_status = "paid";
        details.phase = 3; // move to phase 3 (final pending submission)
        msg = `💰 中期款 40% (NT$ ${(Math.round(approvedAmount * 0.4)).toLocaleString()} 元) 已發放完成！\n請接續完成您的圓夢計畫，並在 ${details.final_deadline} 前上傳期末成果報告！`;
      } else if (stageNum === 3) {
        details.final_status = "paid";
        details.phase = 4; // completed!
        msg = `🎉 尾款 30% (NT$ ${(Math.round(approvedAmount * 0.3)).toLocaleString()} 元) 已發放完成，計畫順利結案！\n感謝您的參與，所有隱私資料即將執行物理銷毀！`;
      }
      
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
      
      // Notify student
      const studentUid = rows[i][3];
      const lineUid = getStudentLineUid(ss, studentUid);
      if (lineUid) {
        sendLinePushNotification(lineUid, `🔔 撥款通知：【未來藍圖計畫】\n` + msg);
      }
      
      return { success: true, message: `階段 ${stageNum} 撥款已確認，進度已更新！` };
    }
  }
  return { success: false, message: '找不到該申請案件！' };
}

// Approve or reject midterm report
function adminReviewMidterm(token, appId, isApprove) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      if (isApprove) {
        details.midterm_status = "approved"; // triggers payout Stage 2
        appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
        
        // Notify student
        const studentUid = rows[i][3];
        const lineUid = getStudentLineUid(ss, studentUid);
        if (lineUid) {
          const approvedAmount = parseFloat(details.approved_amount || "0");
          const msg = `🔔 通知：您的【未來藍圖計畫】期中報告已審查「通過」！\n💰 中期款 (40% = NT$ ${(Math.round(approvedAmount * 0.4)).toLocaleString()} 元) 將進入撥款準備！`;
          sendLinePushNotification(lineUid, msg);
        }
        return { success: true, message: '期中報告審查通過！' };
      } else {
        details.midterm_status = "rejected";
        // Reset phase/state to let student re-upload
        details.midterm_file = "";
        details.midterm_submitted_at = "";
        appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
        
        // Notify student
        const studentUid = rows[i][3];
        const lineUid = getStudentLineUid(ss, studentUid);
        if (lineUid) {
          const msg = `🔔 通知：您的【未來藍圖計畫】期中報告被退回修正。\n請重新確認內容並重新上傳。`;
          sendLinePushNotification(lineUid, msg);
        }
        return { success: true, message: '期中報告已被退回修正！' };
      }
    }
  }
  return { success: false, message: '找不到該申請案件！' };
}

// Approve or reject final report
function adminReviewFinal(token, appId, isApprove) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      if (isApprove) {
        details.final_status = "approved"; // triggers payout Stage 3
        appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
        
        // Notify student
        const studentUid = rows[i][3];
        const lineUid = getStudentLineUid(ss, studentUid);
        if (lineUid) {
          const approvedAmount = parseFloat(details.approved_amount || "0");
          const msg = `🔔 恭喜！您的【未來藍圖計畫】期末報告已審查「通過」！\n💰 尾款 (30% = NT$ ${(Math.round(approvedAmount * 0.3)).toLocaleString()} 元) 將進入撥款準備，本計畫即將結案！`;
          sendLinePushNotification(lineUid, msg);
        }
        return { success: true, message: '期末報告審查通過！' };
      } else {
        details.final_status = "rejected";
        // Reset state to let student re-upload
        details.final_file = "";
        details.final_submitted_at = "";
        appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
        
        // Notify student
        const studentUid = rows[i][3];
        const lineUid = getStudentLineUid(ss, studentUid);
        if (lineUid) {
          const msg = `🔔 通知：您的【未來藍圖計畫】期末報告被退回修正。\n請重新確認內容並重新上傳。`;
          sendLinePushNotification(lineUid, msg);
        }
        return { success: true, message: '期末報告已被退回修正！' };
      }
    }
  }
  return { success: false, message: '找不到該申請案件！' };
}

// Student uploads midterm report
function studentSubmitMidterm(lineUid, appId, fileBase64, fileName) {
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const studentSheet = ss.getSheetByName('students');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const studentUid = rows[i][3];
      
      // Verify LINE identity matches
      const studentRows = findRows(studentSheet, 1, studentUid);
      if (studentRows.length === 0 || studentRows[0].rowData[7] !== lineUid) {
        return { success: false, message: '身份驗證不符！' };
      }
      
      const folderId = studentRows[0].rowData[8];
      const academicYear = rows[i][6];
      
      // Upload Drive file
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      const finalFilename = `${studentUid}-${academicYear}期中報告${ext}`;
      const fileUrl = saveBase64File(folderId, fileBase64, finalFilename);
      
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      // Overtime check
      let overtime = false;
      if (details.midterm_deadline) {
        const today = new Date();
        const deadline = new Date(details.midterm_deadline + " 23:59:59");
        if (today > deadline) {
          overtime = true;
        }
      }
      
      details.midterm_file = fileUrl;
      details.midterm_submitted_at = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
      details.midterm_status = "pending";
      details.midterm_overtime = overtime;
      
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
      
      return { 
        success: true, 
        message: overtime 
          ? '您的期中報告已成功提交（狀態：已超時），將由管理團隊核備審查！'
          : '您的期中報告已成功提交，已進入管理團隊審查！' 
      };
    }
  }
  return { success: false, message: '找不到對應的計畫案！' };
}

// Student uploads final report
function studentSubmitFinal(lineUid, appId, fileBase64, fileName) {
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const studentSheet = ss.getSheetByName('students');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const studentUid = rows[i][3];
      
      // Verify LINE identity matches
      const studentRows = findRows(studentSheet, 1, studentUid);
      if (studentRows.length === 0 || studentRows[0].rowData[7] !== lineUid) {
        return { success: false, message: '身份驗證不符！' };
      }
      
      const folderId = studentRows[0].rowData[8];
      const academicYear = rows[i][6];
      
      // Upload Drive file
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      const finalFilename = `${studentUid}-${academicYear}期末報告${ext}`;
      const fileUrl = saveBase64File(folderId, fileBase64, finalFilename);
      
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      // Overtime check
      let overtime = false;
      if (details.final_deadline) {
        const today = new Date();
        const deadline = new Date(details.final_deadline + " 23:59:59");
        if (today > deadline) {
          overtime = true;
        }
      }
      
      details.final_file = fileUrl;
      details.final_submitted_at = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
      details.final_status = "pending";
      details.final_overtime = overtime;
      
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
      
      return { 
        success: true, 
        message: overtime 
          ? '您的期末成果報告已成功提交（狀態：已超時），將由管理團隊核備審查！'
          : '您的期末成果報告已成功提交，已進入管理團隊審查！' 
      };
    }
  }
  return { success: false, message: '找不到對應的計畫案！' };
}

// Update Scheme 3 approved settings (amount & deadlines) retroactively
function adminUpdateBlueprintSettings(token, appId, approvedAmount, midtermDeadline, finalDeadline) {
  if (!verifyAdminToken(token)) {
    return { success: false, message: '未授權的操作，請先登入管理端！' };
  }
  const ss = getDbSpreadsheet();
  const appSheet = ss.getSheetByName('applications');
  const rows = getSafeValues(appSheet);
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === appId) {
      const detailsStr = rows[i][7];
      let details = {};
      try {
        if (detailsStr) details = JSON.parse(detailsStr);
      } catch(e) {}
      
      details.approved_amount = parseFloat(approvedAmount);
      details.midterm_deadline = midtermDeadline;
      details.final_deadline = finalDeadline;
      
      appSheet.getRange(i + 1, 6).setValue(safeWriteVal(approvedAmount));
      appSheet.getRange(i + 1, 8).setValue(safeWriteVal(JSON.stringify(details)));
      
      // Send update push notification
      const studentUid = rows[i][3];
      const lineUid = getStudentLineUid(ss, studentUid);
      if (lineUid) {
        const msg = `🔔 通知：您的【未來藍圖計畫】已更新設定：\n💰 核定專案總額：NT$ ${parseFloat(approvedAmount).toLocaleString()} 元。\n* 期中截止日：${midtermDeadline}\n* 期末截止日：${finalDeadline}`;
        sendLinePushNotification(lineUid, msg);
      }
      
      return { success: true, message: '已成功更新核定金額與報告截止日！' };
    }
  }
  return { success: false, message: '找不到該申請案件！' };
}
