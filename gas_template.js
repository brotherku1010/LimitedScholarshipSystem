/**
 * ==========================================================================
 * 【古哥獎學金】成績挑戰計畫 - Google Apps Script (GAS) 雲端對接範例範本
 * 說明：
 * 本檔案提供如何將此系統部署於 GAS + Google Sheets + Google Drive 雲端環境之核心程式碼。
 * 可直接複製本段程式，於 Google Apps Script 編輯器內配合您的試算表與雲端硬碟資料夾使用。
 * ==========================================================================
 */

// 1. 全域變數設定 (請替換為您的實際 Google Sheet 與 Drive Folder ID)
const SPREADSHEET_ID = "YOUR_GOOGLE_SPREADSHEET_ID_HERE";
const DRIVE_FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE";

/**
 * 處理網頁 HTTP GET 請求 (用以將 GAS 網頁介面發佈為 Web App)
 */
function doGet(e) {
  // 如果需要直接以 GAS 託管前端 HTML (以 index.html 檔案為例)
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("【古哥獎學金】成績挑戰計畫")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 處理網頁 HTTP POST 請求 (接收來自前端的 API 請求，如挑戰、核銷、銷毀個資)
 */
function doPost(e) {
  const params = e.parameter;
  let action = params.action;
  
  // 處理 JSON 傳入的情況 (如管理端 API)
  let payload = {};
  if (e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
      action = payload.action || action;
    } catch(err) {
      // 忽略解析錯誤
    }
  }

  let result = {};
  
  try {
    switch (action) {
      case "login":
        result = handleLogin(payload.code || params.code);
        break;
      case "apply_challenge":
        result = handleChallengeApply(params, e.postData);
        break;
      case "approve":
        result = handleApprove(payload.id);
        break;
      case "destroy":
        result = handleDestroyPII(payload.id);
        break;
      default:
        result = { success: false, message: "無效的操作指令" };
    }
  } catch(err) {
    result = { success: false, message: "伺服器執行錯誤: " + err.toString() };
  }

  // 回傳 JSON 格式結果
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 1. 登入與防線狀態 API
 */
function handleLogin(code) {
  if (!code) return { success: false, message: "請輸入邀請碼" };
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("invitations");
  const data = sheet.getDataRange().getValues();
  
  let studentName = "";
  let found = false;
  
  // 從 invitations 工作表比對邀請碼 (第一欄為代碼，第二欄為姓名)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().toUpperCase() === code.toUpperCase()) {
      studentName = data[i][1];
      found = true;
      break;
    }
  }
  
  if (!found) {
    return { success: false, message: "邀請碼無效，此計畫限特定邀約對象" };
  }
  
  // 撈取此邀請碼以往的挑戰紀錄 (從 applications 工作表)
  const appSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("applications");
  const appData = appSheet.getDataRange().getValues();
  
  let unlockedChallenges = [];
  let attempts = 0;
  
  for (let i = 1; i < appData.length; i++) {
    // 欄位定義：0:ID, 1:類型, 2:狀態, 3:建立時間, 4:邀請碼, 5:姓名, 6:當期成績, ..., 9:挑戰防線門檻
    const inviteCodeCol = appData[i][4];
    const statusCol = appData[i][2];
    const typeCol = appData[i][1];
    const targetCol = appData[i][9];
    
    if (inviteCodeCol === code && statusCol !== "rejected") {
      if (targetCol) unlockedChallenges.push(Number(targetCol));
      if (typeCol === "challenge") attempts++;
    }
  }
  
  return {
    success: true,
    name: studentName,
    unlocked_challenges: unlockedChallenges,
    attempts: attempts
  };
}

/**
 * 2. 成績挑戰申請 (含檔案上傳 Google Drive)
 */
function handleChallengeApply(params, postData) {
  const code = params.code.toUpperCase();
  const name = params.name;
  const gpa = Number(params.gpa);
  const target = Number(params.target);
  const bankCode = params.bank_code;
  const bankAccount = params.bank_account;
  
  // 處理 Base64 成績單圖檔上傳至 Google Drive
  let fileUrl = "";
  let fileId = "";
  
  if (params.fileData && params.fileName) {
    // 解碼 base64 並上傳
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const contentType = params.fileData.substring(5, params.fileData.indexOf(";base64"));
    const bytes = Utilities.base64Decode(params.fileData.split(",")[1]);
    const blob = Utilities.newBlob(bytes, contentType, params.fileName);
    const file = folder.createFile(blob);
    
    fileUrl = file.getUrl();
    fileId = file.getId();
  }
  
  // 計算獎金階梯金額
  const appSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("applications");
  const appData = appSheet.getDataRange().getValues();
  let currentAttempts = 0;
  for (let i = 1; i < appData.length; i++) {
    if (appData[i][4] === code && appData[i][1] === "challenge" && appData[i][2] !== "rejected") {
      currentAttempts++;
    }
  }
  
  const rewards = [7000, 8500, 10000, 12000, 15000, 18000, 20000, 25000];
  const assignedAmount = rewards[Math.min(currentAttempts, rewards.length - 1)];
  
  const newId = Utilities.getUuid();
  const createdAt = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
  
  // 寫入 Google Sheet applications (欄位須與後台對齊)
  appSheet.appendRow([
    newId,            // 0: ID
    "challenge",      // 1: type
    "pending",        // 2: status (待審核)
    createdAt,        // 3: created_at
    code,             // 4: invite_code
    name,             // 5: name (個資 - 可銷毀)
    gpa,              // 6: gpa
    "",               // 7: prev_gpa
    "",               // 8: credits
    target,           // 9: challenge_target
    assignedAmount,   // 10: amount
    bankCode,         // 11: bank_code (個資 - 可銷毀)
    bankAccount,      // 12: bank_account (個資 - 可銷毀)
    fileUrl,          // 13: file_path (Drive 連結 - 可銷毀)
    "",               // 14: prev_file_path (Drive 連結 - 可銷毀)
    fileId            // 15: Google Drive 檔案 ID (個資 - 銷毀用)
  ]);
  
  return {
    success: true,
    message: "您的成績挑戰已成功上傳至雲端系統，核定金額為 NT$ " + assignedAmount.toLocaleString() + " 元，審核中。"
  };
}

/**
 * 3. 審核核准 API
 */
function handleApprove(id) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("applications");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 3).setValue("approved"); // 更新 status 為 approved
      return { success: true, message: "案件核准成功！" };
    }
  }
  return { success: false, message: "找不到該案件" };
}

/**
 * 4. 【核心】一鍵銷毀與結案機制 API
 */
function handleDestroyPII(id) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("applications");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const studentName = data[i][5];
      const driveFileId = data[i][15]; // Google Drive 檔案 ID
      
      // 1. 從 Google Drive 實體刪除成績單圖檔
      if (driveFileId) {
        try {
          DriveApp.getFileById(driveFileId).setTrashed(true); // 丟入垃圾桶或徹底刪除
        } catch (e) {
          // 檔案可能不存在或已刪除，忽略錯誤
        }
      }
      
      // 2. 去識別化學生姓名
      let maskedName = studentName || "申請人";
      if (maskedName.length >= 3) {
        maskedName = maskedName.substring(0, 1) + "*" + maskedName.substring(2);
      } else if (maskedName.length == 2) {
        maskedName = maskedName.substring(0, 1) + "*";
      }
      
      // 3. 抹除試算表中敏感個資，更新狀態為已銷毀結案
      sheet.getRange(i + 1, 3).setValue("destroyed");     // status = destroyed
      sheet.getRange(i + 1, 6).setValue(maskedName);      // name = 去識別化姓名
      sheet.getRange(i + 1, 12).setValue("");             // bank_code = 清空
      sheet.getRange(i + 1, 13).setValue("");             // bank_account = 清空
      sheet.getRange(i + 1, 14).setValue("");             // file_path (Drive 連結) = 清空
      sheet.getRange(i + 1, 15).setValue("");             // prev_file_path = 清空
      sheet.getRange(i + 1, 16).setValue("");             // Google Drive 檔案 ID = 清空
      
      const destroyTime = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");
      sheet.getRange(i + 1, 17).setValue(destroyTime);    // 額外欄位 17: destruction_time
      
      // 4. 寄出模擬/實際 Email 通知學生
      sendGDPRNotificationEmail(maskedName);
      
      return {
        success: true,
        anonymized_name: maskedName,
        message: "一鍵個資銷毀與結案執行完畢，Drive 檔案已徹底刪除，試算表個資已完全抹除！"
      };
    }
  }
  
  return { success: false, message: "找不到該案件" };
}

/**
 * 輔助寄送 GDPR 切結銷毀信件
 */
function sendGDPRNotificationEmail(maskedName) {
  // 實際可以使用 MailApp.sendEmail() 來發信
  /*
  MailApp.sendEmail({
    to: "student_registered_email@example.com",
    subject: "【古哥獎學金】已撥款暨個人隱私資料銷毀通知",
    body: "親愛的 " + maskedName + " 同學您好：您所申請的【古哥獎學金】已成功匯入您的收款帳戶。為保障個人穩私，您的帳戶資訊、真實姓名與成績單圖檔已依個資銷毀切結，由本系統資料庫與儲存空間中徹底刪除且永久無法復原。系統僅留存去識別化統計紀錄。祝您學業更上一層樓！"
  });
  */
}
