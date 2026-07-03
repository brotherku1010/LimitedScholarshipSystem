// ==========================================================================
// 🎓 自動學年升級排程系統 & 觸發器設定 (promote_profile.gs)
// ==========================================================================

// 每年 8 月 1 日由系統自動排程執行的升級主程式（無需管理員 Token 驗證）
function scheduledAnnualGradePromotion() {
  Logger.log("系統排程：開始執行年度學員學籍自動升級校對作業...");
  const ss = getDbSpreadsheet();
  const studentSheet = ss.getSheetByName('students');
  const rows = getSafeValues(studentSheet);
  const now = new Date();
  let updatedCount = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const studentUid = rows[i][0];
    const name = rows[i][1];
    const originalGrade = rows[i][6];
    let createdAtStr = rows[i].length >= 13 ? rows[i][12] : "";
    
    // 智慧相容：若舊學員缺少 CreatedAt，則嘗試抓取該學員最早的申請案時間，或以預設值 (2025-11-01) 寫入
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
        createdAtStr = "2025-11-01 12:00:00";
      }
      studentSheet.getRange(i + 1, 13).setValue(safeWriteVal(createdAtStr));
    }
    
    // 計算學員當前應為之年級
    const newGrade = calculateCurrentGrade(originalGrade, createdAtStr, now);
    if (newGrade !== originalGrade) {
      studentSheet.getRange(i + 1, 7).setValue(safeWriteVal(newGrade));
      Logger.log(`學員年級已自動升級：${name} (${studentUid}) | ${originalGrade} ➔ ${newGrade}`);
      updatedCount++;
    }
  }
  
  Logger.log(`年度學籍自動升級作業完成！共更新 ${updatedCount} 位學員之學籍。`);
}

// 建立/校對每年 8 月 1 日的時間觸發器
function setupAnnualPromotionTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === 'scheduledAnnualGradePromotion') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // 建立每年 8 月 1 日執行 scheduledAnnualGradePromotion 函式之觸發器
  ScriptApp.newTrigger('scheduledAnnualGradePromotion')
    .timeBased()
    .onMonthDay(8, 1)
    .create();
  
  Logger.log("已設定每年 8/1 年級自動升級時間觸發器。");
  return { success: true, message: '已成功於後台註冊每年 8 月 1 日自動年級升級校對觸發器！' };
}

// 當專案安裝或開啟時，自動檢查並重新設定時間觸發器以防遺失
function onInstall(e) {
  setupAnnualPromotionTrigger();
}

function onOpen(e) {
  setupAnnualPromotionTrigger();
}
