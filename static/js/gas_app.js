/* ==========================================================================
   【古哥挑戰獎學金】成績挑戰計畫 - 互動邏輯 (Apps Script JS)
   ========================================================================== */

// Global State
let currentUser = {
    name: '',
    birthday: '',
    nickname: '',
    school: '',
    department: '',
    grade: '',
    attempts: 0,
    approvedAttempts: 0,
    unlockedChallenges: [],
    pendingChallenges: []
};

let selectedChallengeTarget = null;

let activeSettings = {
    progressBase: 1500,
    progressConversionRate: 50,
    challengeAmounts: [7000, 8500, 10000, 12000, 15000, 18000, 20000, 25000],
    blueprintAmount: 30000
};

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
    // Initialize LINE LIFF Authentication
    initLiff();
    
    // Initialize Event Listeners
    initEventListeners();
    
    // Initialize Progress Calculator Auto-updater
    initProgressCalculator();

    // Recalculate milestone wrapping on window resize
    window.addEventListener('resize', adjustMilestones);
    
    // Initialize Scheme 1 Drag & Drop File Upload area
    initDragAndDropUpload();

    // Spawn background images from Google Drive settings
    spawnRandomPic();
});

// Debug Logger function
function logDebug(msg) {
    console.log(msg);
}

// Initialize LINE Login flow using server-injected details
function initLiff() {
    logDebug("[INFO] Starting LINE Verification...");
    logDebug("[INFO] Server-side OAuth Uid: " + window.lineUid);
    logDebug("[INFO] Server-side OAuth Name: " + window.lineDisplayName);
    
    const isMissingUid = (!window.lineUid || window.lineUid.indexOf("<" + "?=") === 0 || window.lineUid.trim() === "");
    
    // 設定全域載入畫面提示文字
    const loadingText = document.getElementById('global-loading-text');
    if (loadingText) {
        loadingText.innerText = "正在驗證 LINE 安全憑證...";
    }
    
    if (isMissingUid) {
        logDebug("[WARNING] LINE UID is missing. User needs to authorize LINE Login.");
        toggleLoading(false);
        
        // 隱藏全域載入畫面
        const loadingOverlay = document.getElementById('global-loading-screen');
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        
        // Hide main application and display the secure LINE Login redirect card
        const mainApp = document.getElementById('main-app-container');
        const loginRedirectCard = document.getElementById('app-login-redirect-card');
        const authorizeBtn = document.getElementById('lnk-line-authorize');
        
        if (mainApp) mainApp.style.display = 'none';
        if (loginRedirectCard) loginRedirectCard.style.display = 'flex';
        if (authorizeBtn) authorizeBtn.href = window.lineAuthorizeUrl || "#";
        
        showToast("請點選 LINE 驗證登入以進入計畫！", "fa-circle-exmark");
    } else {
        // 保持主畫面隱藏，更新全域載入文字，非同步與伺服器進行學籍比對
        const mainApp = document.getElementById('main-app-container');
        const loginRedirectCard = document.getElementById('app-login-redirect-card');
        
        if (mainApp) mainApp.style.display = 'none'; // 保持隱藏直至載入完成
        if (loginRedirectCard) loginRedirectCard.style.display = 'none';
        
        if (loadingText) {
            loadingText.innerText = "正在讀取您的學籍與挑戰進度...";
        }
        
        logDebug("[INFO] LINE UID verified! Calling studentLiffLogin on GAS server...");
        google.script.run
            .withSuccessHandler(onLiffLoginSuccess)
            .withFailureHandler(onLiffLoginFailure)
            .studentLiffLogin(window.lineUid);
    }
}

function showIframeLoginNotice() {
    const loginModal = document.getElementById('modal-login');
    if (loginModal) {
        loginModal.querySelector('.modal-header h2').innerHTML = '<i class="fa-brands fa-line" style="color: #06C755;"></i> 請使用 LINE 驗證登入';
        loginModal.querySelector('.modal-body').innerHTML = '\n            <div style="text-align: center; padding: 20px 10px;">\n                <i class="fa-brands fa-line" style="font-size: 4rem; color: #06C755; margin-bottom: 15px;"></i>\n                <p style="color: #fff; font-size: 1.05rem; font-weight: bold; margin-bottom: 10px;">歡迎加入古哥挑戰獎學金挑戰計畫</p>\n                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 25px;">\n                    由於瀏覽器安全限制，無法在 Google 框架內直接進行 LINE 登入。請點選下方按鈕跳出框架進行授權。\n                </p>\n                <a href="https://liff.line.me/2010560500-s1V0QyLa" target="_top" class="btn btn-primary btn-full" style="display: block; text-decoration: none; text-align: center; line-height: 24px;">\n                    <i class="fa-solid fa-right-to-bracket"></i> 經由 LINE 授權登入\n                </a>\n            </div>\n        ';
        const footer = loginModal.querySelector('.modal-footer');
        if (footer) footer.style.display = 'none';
        openModal('modal-login');
    }
}

// LIFF Login Success Handler
function onLiffLoginSuccess(data) {
    logDebug("[INFO] studentLiffLogin returned. Success: " + data.success);
    if (!data.success) {
        logDebug("[INFO] Error code: " + data.code + ", Message: " + data.message);
    }
    toggleLoading(false);
    
    // 取得全域載入中遮罩
    const loadingOverlay = document.getElementById('global-loading-screen');
    
    if (data.success) {
        currentUser.name = data.name;
        currentUser.birthday = data.birthday;
        currentUser.nickname = data.nickname;
        currentUser.school = data.school;
        currentUser.department = data.department;
        currentUser.grade = data.grade;
        currentUser.attempts = data.attempts;
        currentUser.approvedAttempts = data.approved_attempts;
        currentUser.unlockedChallenges = data.unlocked_challenges;
        currentUser.pendingChallenges = data.pending_challenges || [];
        currentUser.applications = data.applications || [];
        currentUser.bankCode = data.bankCode || '';
        currentUser.bankAccount = data.bankAccount || '';
        
        if (data.settings) {
            activeSettings.progressBase = data.settings.progress_base || 1500;
            activeSettings.progressConversionRate = data.settings.progress_conversion_rate || 50;
            activeSettings.challengeAmounts = data.settings.challenge_amounts || [7000, 8500, 10000, 12000, 15000, 18000, 20000, 25000];
            activeSettings.blueprintAmount = data.settings.blueprint_amount || 30000;
        }
        
        // Save to Session Storage
        sessionStorage.setItem('guge_student_name', data.name);
        sessionStorage.setItem('guge_student_birthday', data.birthday);
        
        // Save to Local Storage Cache
        localStorage.setItem('guge_line_uid', data.uid);
        localStorage.setItem('guge_line_name', data.name);
        
        // Close login modal if open
        closeModal('modal-login');
        
        // Check if consent has already been signed in Google Sheets database
        if (data.consent_signed === true) {
            logDebug("[INFO] Consent already signed previously in Sheets database. Bypassing consent modal.");
            closeModal('modal-consent');
        } else {
            openModal('modal-consent');
        }
        
        // Load data to UI
        updateStudentUI();
        
        // 顯示主程式畫面並隱藏全域載入遮罩！
        const mainApp = document.getElementById('main-app-container');
        if (mainApp) mainApp.style.display = 'block';
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        
        showToast('登入成功！歡迎進入計畫，' + (data.name) + '同學。', "fa-circle-check");
    } else if (data.code === 'NOT_REGISTERED') {
        // First time login: Open registration form and prefill nickname with LINE name
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        
        openModal('modal-login');
        document.getElementById('login-student-nickname').value = window.lineDisplayName || "";
        showToast("首次登入，請填寫真實資料以完成註冊！", "fa-user-plus");
    } else {
        // 身分驗證被拒絕或發生錯誤
        if (loadingOverlay) {
            loadingOverlay.innerHTML = '\n                <div class="global-loading-card" style="border-color: var(--neon-red);">\n                    <i class="fa-solid fa-circle-xmark" style="font-size: 3rem; color: var(--neon-red); margin-bottom: 20px;"></i>\n                    <h2 style="color: var(--neon-red);">身分驗證失敗</h2>\n                    <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 20px;">' + (data.message || "未知的系統錯誤") + '</p>\n                    <button onclick="window.location.reload();" class="btn btn-primary btn-full" style="background: var(--neon-red); border-color: var(--neon-red);">重新整理</button>\n                </div>\n            ';
        }
        showToast(data.message || "身分驗證失敗！", "fa-circle-xmark");
    }
}

// LIFF Login Failure Handler
function onLiffLoginFailure(err) {
    toggleLoading(false);
    logDebug("❌ studentLiffLogin backend failed: " + (err ? err.toString() : "Unknown Error"));
    console.error("LIFF Login backend error:", err);
    
    // 展示伺服器連線失敗畫面，提供重新整理按鈕
    const loadingOverlay = document.getElementById('global-loading-screen');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = '\n            <div class="global-loading-card" style="border-color: var(--neon-red);">\n                <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--neon-red); margin-bottom: 20px;"></i>\n                <h2 style="color: var(--neon-red);">系統連線失敗</h2>\n                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">無法與伺服器取得同步，請確認網路連線狀態。</p>\n                <button onclick="window.location.reload();" class="btn btn-primary btn-full" style="background: var(--neon-red); border-color: var(--neon-red);">重新整理</button>\n            </div>\n        ';
    }
    showToast("伺服器連線失敗，請稍後重試！", "fa-circle-xmark");
}

// Refresh User Status by LIFF (Attempts and unlocked challenges count)
function refreshUserStatusLiff() {
    google.script.run
        .withSuccessHandler(function(data) {
            if (data.success) {
                currentUser.attempts = data.attempts;
                currentUser.approvedAttempts = data.approved_attempts;
                currentUser.unlockedChallenges = data.unlocked_challenges;
                currentUser.pendingChallenges = data.pending_challenges || [];
                currentUser.applications = data.applications || [];
                updateStudentUI();
            }
        })
        .studentLiffLogin(window.lineUid);
}

// Update the entire UI based on logged-in student state
function updateStudentUI() {
    // Update top student profile panel
    const infoPanel = document.getElementById('student-info-panel');
    if (infoPanel) {
        infoPanel.style.display = 'block';
        document.getElementById('student-display-name').innerText = (currentUser.nickname || currentUser.name) + " 同學";
        
        const schoolText = currentUser.school + " " + currentUser.department + " (" + currentUser.grade + ")";
        document.getElementById('student-display-meta').innerHTML = '<i class="fa-solid fa-graduation-cap"></i> ' + (schoolText);
        document.getElementById('student-display-attempts').innerText = currentUser.approvedAttempts || 0;
    }
    
    // Prefill Bank Code and Account inputs across all three application forms
    if (currentUser.bankCode) {
        const challengeBank = document.getElementById('challenge-bank-code');
        if (challengeBank) challengeBank.value = currentUser.bankCode;
        const progressBank = document.getElementById('progress-bank-code');
        if (progressBank) progressBank.value = currentUser.bankCode;
        const blueprintBank = document.getElementById('blueprint-bank-code');
        if (blueprintBank) blueprintBank.value = currentUser.bankCode;
    }
    if (currentUser.bankAccount) {
        const challengeAcct = document.getElementById('challenge-bank-account');
        if (challengeAcct) challengeAcct.value = currentUser.bankAccount;
        const progressAcct = document.getElementById('progress-bank-account');
        if (progressAcct) progressAcct.value = currentUser.bankAccount;
        const blueprintAcct = document.getElementById('blueprint-bank-account');
        if (blueprintAcct) blueprintAcct.value = currentUser.bankAccount;
    }
    if (currentUser.name) {
        const challengeName = document.getElementById('challenge-name');
        if (challengeName) challengeName.value = currentUser.name;
        const progressName = document.getElementById('progress-name');
        if (progressName) progressName.value = currentUser.name;
        const blueprintName = document.getElementById('blueprint-name');
        if (blueprintName) blueprintName.value = currentUser.name;
    }
    
    // Render History List
    renderHistoryList(currentUser.applications || []);
    
    // Show tab buttons
    document.getElementById('program-tabs').style.display = 'grid';

    // Update Progress Award card based on grade
    const cardProgress = document.getElementById('card-progress');
    const badgeProgress = cardProgress.querySelector('.status-badge');
    const descProgress = cardProgress.querySelector('.program-desc');
    const overlayProgress = cardProgress.querySelector('.locked-overlay-info');
    const titleCalc = cardProgress.querySelector('.calculator-widget h3');
    const btnApplyProgress = document.getElementById('btn-apply-progress-demo');

    if (currentUser.grade === '大一') {
        cardProgress.classList.add('locked');
        badgeProgress.className = "status-badge lock-badge";
        badgeProgress.innerHTML = '<i class="fa-solid fa-lock"></i> 鎖定中';
        descProgress.innerText = "在大一期間為鎖定預告狀態，大二上學期將會正式解鎖。此方案鼓勵挑戰自我極限，突破往期成績！";
        if (overlayProgress) overlayProgress.style.display = 'block';
        if (titleCalc) titleCalc.innerHTML = '<i class="fa-solid fa-calculator"></i> 獎金模擬試算器 (大一體驗版)';
        btnApplyProgress.innerHTML = '<i class="fa-solid fa-ban"></i> 大一學生暫無申請權限';
        btnApplyProgress.className = "btn btn-secondary btn-full btn-disabled";
    } else {
        cardProgress.classList.remove('locked');
        badgeProgress.className = "status-badge hot";
        badgeProgress.innerHTML = '<i class="fa-solid fa-unlock-keyhole"></i> 已解鎖可申請';
        descProgress.innerText = "學期進步獎已解鎖！只要本學期平均分數高於上一學期，即可申請高額進步獎金。";
        if (overlayProgress) overlayProgress.style.display = 'none';
        if (titleCalc) titleCalc.innerHTML = '<i class="fa-solid fa-calculator"></i> 成績進步試算與申請';
        btnApplyProgress.innerHTML = '<i class="fa-solid fa-arrow-up-right-dots"></i> 填寫匯款資料，送出申請';
        btnApplyProgress.className = "btn btn-secondary btn-full";
    }

    // Fill names in forms
    document.getElementById('challenge-name').value = currentUser.name;
    document.getElementById('progress-name').value = currentUser.name;
    document.getElementById('blueprint-name').value = currentUser.name;

    // Toggle Scheme 1 Apply Button based on pending status
    const hasPendingChallenge = (currentUser.applications || []).some(app => app.type === 'challenge' && app.status === 'pending');
    const challengeBtn = document.getElementById('btn-apply-challenge-modal');
    const challengeNotice = document.getElementById('challenge-pending-notice');
    if (challengeBtn && challengeNotice) {
        if (hasPendingChallenge) {
            challengeBtn.style.display = 'none';
            challengeNotice.style.display = 'block';
        } else {
            challengeBtn.style.display = 'block';
            challengeNotice.style.display = 'none';
        }
    }

    // Apply active settings values to UI text
    const formulaDesc = document.getElementById('calc-formula-desc');
    if (formulaDesc && activeSettings) {
        formulaDesc.innerText = '試算公式：' + (activeSettings.progressBase) + ' (底金) + 學分級距加給 + [ (進步分數 × 難度係數 × 學分權重) × ' + (activeSettings.progressConversionRate) + '元 ]';
    }
    const blueprintBtn = document.getElementById('btn-apply-blueprint-modal');
    if (blueprintBtn && activeSettings && activeSettings.blueprintAmount) {
        blueprintBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> 上傳圓夢企劃書 ➔ 啟動募資 (最高 NT$ ' + (activeSettings.blueprintAmount.toLocaleString()) + ')';
    }
    const modalBlueprintAmount = document.querySelector('#modal-apply-blueprint .target-left strong');
    if (modalBlueprintAmount && activeSettings && activeSettings.blueprintAmount) {
        modalBlueprintAmount.innerText = '最高 NT$ ' + (activeSettings.blueprintAmount.toLocaleString());
    }

    // Render Shields
    renderShields();
    
    // Render Progress Ladder Steps
    renderLadder();

    // Trigger tab restore
    const activeTab = sessionStorage.getItem('guge_active_tab') || 'challenge';
    switchTab(activeTab);
}

// Render Shields Grid
function renderShields() {
    const shieldItems = document.querySelectorAll('.shield-item');
    shieldItems.forEach(item => {
        const targetVal = parseFloat(item.getAttribute('data-target'));
        
        // Reset states
        item.classList.remove('unlocked', 'selected', 'pending');
        
        const lockIcon = item.querySelector('.unlocked-icon');
        if (lockIcon) {
            lockIcon.className = "fa-solid fa-lock-open unlocked-icon";
        }
        
        // If already unlocked (approved)
        if (currentUser.unlockedChallenges.includes(targetVal)) {
            item.classList.add('unlocked');
            if (lockIcon) {
                lockIcon.className = "fa-solid fa-circle-check unlocked-icon";
            }
        }
        // If pending review
        else if (currentUser.pendingChallenges.includes(targetVal)) {
            item.classList.add('pending');
            if (lockIcon) {
                lockIcon.className = "fa-solid fa-hourglass-half unlocked-icon";
            }
        }
    });
}

// Render Ladder Steps (LV 1 - LV 8)
function renderLadder() {
    const steps = document.querySelectorAll('.ladder-step');
    const currentLevel = Math.min(currentUser.attempts + 1, 8);
    
    steps.forEach(step => {
        const level = parseInt(step.getAttribute('data-level'));
        step.classList.remove('cleared', 'active-step');
        
        // Update level amount dynamically from settings
        const amountSpan = step.querySelector('.level-amount');
        if (amountSpan && activeSettings && activeSettings.challengeAmounts) {
            const amt = activeSettings.challengeAmounts[level - 1];
            if (amt !== undefined) {
                amountSpan.innerText = 'NT$ ' + (amt.toLocaleString());
            }
        }
        
        // Remove current arrow
        const arrow = step.querySelector('.current-arrow');
        if (arrow) arrow.remove();
        
        if (level < currentLevel) {
            // Already cleared
            step.classList.add('cleared');
        } else if (level === currentLevel) {
            // Active current level
            step.classList.add('active-step');
            // Insert current arrow icon
            const detailSpan = step.querySelector('.level-detail');
            const arrowIcon = document.createElement('i');
            arrowIcon.className = "fa-solid fa-circle-chevron-right current-arrow";
            step.appendChild(arrowIcon);
        }
    });
}

// Helper to convert file input to Base64 promise
function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// Event Listeners Initialization
function initEventListeners() {
    // 1. Submit Registration
    document.getElementById('btn-submit-login').addEventListener('click', handleLoginSubmit);

    // 2. SIGN CONSENT
    const checkboxConsent = document.getElementById('consent-checkbox');
    const btnSubmitConsent = document.getElementById('btn-submit-consent');
    if (checkboxConsent && btnSubmitConsent) {
        checkboxConsent.addEventListener('change', (e) => {
            btnSubmitConsent.disabled = !e.target.checked;
        });
        btnSubmitConsent.addEventListener('click', () => {
            if (window.lineUid) {
                // Persist consent status to Google Sheets database
                google.script.run.studentSignConsent(window.lineUid);
            }
            closeModal('modal-consent');
            showToast("已簽署隱私保障同意書，申請權限已解鎖！", "fa-user-shield");
        });
    }

    // 3. Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // 3.5 Program Tabs Switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // 3.75 Edit Profile Dialog
    const btnEditProfile = document.getElementById('btn-edit-profile');
    if (btnEditProfile) {
        btnEditProfile.addEventListener('click', openEditProfileModal);
    }
    const btnSubmitEditProfile = document.getElementById('btn-submit-edit-profile');
    if (btnSubmitEditProfile) {
        btnSubmitEditProfile.addEventListener('click', handleEditProfileSubmit);
    }

    // 4. Shields Click event
    const shieldItems = document.querySelectorAll('.shield-item');
    shieldItems.forEach(item => {
        item.addEventListener('click', () => {
            // Check if already unlocked
            if (item.classList.contains('unlocked')) {
                showToast("此分數防線已在往期擊破，請選擇其他防線進行挑戰！", "fa-circle-xmark");
                return;
            }
            if (item.classList.contains('pending')) {
                showToast("此分數防線目前正在審核中，請耐心等候審核結果！", "fa-circle-exclamation");
                return;
            }
            
            // Remove selected class from all shields
            shieldItems.forEach(s => s.classList.remove('selected'));
            
            // Select this shield
            item.classList.add('selected');
            selectedChallengeTarget = parseFloat(item.getAttribute('data-target'));
            
            showToast('已選擇防線門檻：' + (selectedChallengeTarget) + '分，請點擊下方按鈕送出成績！', "fa-bullseye");
        });
    });

    // 5. Open Scheme 1 (Challenge Award) Modal
    document.getElementById('btn-apply-challenge-modal').addEventListener('click', () => {
        if (!selectedChallengeTarget) {
            showToast("請先點選上方的分數防線盾牌！", "fa-circle-exclamation");
            return;
        }
        
        // Populate threshold value in modal
        document.getElementById('form-challenge-target-score').innerText = selectedChallengeTarget.toFixed(2);
        
        // Populate level amount safely
        const currentLevel = Math.min((currentUser.attempts || 0) + 1, 8);
        let assignedAmt = 0;
        if (activeSettings && activeSettings.challengeAmounts && activeSettings.challengeAmounts[currentLevel - 1] !== undefined) {
            assignedAmt = activeSettings.challengeAmounts[currentLevel - 1];
        }
        document.getElementById('form-challenge-target-amount').innerText = 'NT$ ' + (assignedAmt.toLocaleString());
        
        openModal('modal-apply-challenge');
    });

    // 6. Form Submission: Scheme 1 (Challenge Award)
    document.getElementById('form-apply-challenge').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedYear = document.querySelector('#form-apply-challenge [name="academic_year"]').value;
        const alreadyApplied = (currentUser.applications || []).some(app => 
            app.type === 'challenge' && 
            app.academicYear === selectedYear && 
            app.status !== 'rejected'
        );
        if (alreadyApplied) {
            showToast("此學年度學期已申請過成績挑戰，不可重複申請！", "fa-circle-xmark");
            return;
        }
        
        const fileInput = document.getElementById('challenge-file');
        const file = fileInput.files[0];
        
        const payload = {
            student_name: currentUser.name,
            student_birthday: currentUser.birthday,
            name: document.getElementById('challenge-name').value.trim(),
            gpa: document.getElementById('challenge-gpa').value,
            target: selectedChallengeTarget,
            bank_code: document.getElementById('challenge-bank-code').value.trim(),
            bank_account: document.getElementById('challenge-bank-account').value.trim(),
            academic_year: document.querySelector('#form-apply-challenge [name="academic_year"]').value,
            file_base64: '',
            file_name: ''
        };
        
        toggleLoading(true, "正在安全傳輸與編碼成績單數據...");
        
        try {
            if (file) {
                payload.file_base64 = await getBase64(file);
                payload.file_name = file.name;
            }
            
            google.script.run
                .withSuccessHandler(function(data) {
                    toggleLoading(false);
                    if (data.success) {
                        closeModal('modal-apply-challenge');
                        e.target.reset();
                        document.getElementById('challenge-file-name-display').innerText = '';
                        document.querySelectorAll('.shield-item').forEach(s => s.classList.remove('selected'));
                        selectedChallengeTarget = null;
                        
                        showToast(data.message, "fa-circle-check");
                        refreshUserStatusLiff();
                    } else {
                        showToast(data.message, "fa-circle-xmark");
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，挑戰申請提交失敗！", "fa-triangle-exclamation");
                })
                .submitChallenge(payload);
                
        } catch(err) {
            toggleLoading(false);
            showToast("檔案讀取失敗！", "fa-triangle-exclamation");
        }
    });

    // File input visual feedback helper
    const setupFileFeedback = (inputId, displayId) => {
        const input = document.getElementById(inputId);
        const display = document.getElementById(displayId);
        if (input && display) {
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    display.innerText = '已選取: ' + (e.target.files[0].name) + ' (' + ((e.target.files[0].size/1024).toFixed(1)) + ' KB)';
                } else {
                    display.innerText = '';
                }
            });
        }
    };
    setupFileFeedback('challenge-file', 'challenge-file-name-display');
    setupFileFeedback('progress-prev-file', 'progress-prev-file-display');
    setupFileFeedback('progress-curr-file', 'progress-curr-file-display');
    setupFileFeedback('blueprint-file', 'blueprint-file-display');

    // 8. Open Scheme 2 (Progress Award) Application
    document.getElementById('btn-apply-progress-demo').addEventListener('click', () => {
        if (currentUser.grade === '大一') {
            showToast("學期進步獎限大二（含）以上學生申請，大一新生暫無申請權限！", "fa-ban");
            return;
        }

        // Pull calculator values to pre-populate form
        const prev = document.getElementById('calc-prev-gpa').value;
        const curr = document.getElementById('calc-curr-gpa').value;
        const credits = document.getElementById('calc-credits').value;
        
        if (!prev || !curr || !credits) {
            showToast("請先在下方「試算器」輸入完整數據後再點擊送出申請！", "fa-circle-exclamation");
            return;
        }
        
        const diff = parseFloat(curr) - parseFloat(prev);
        if (diff <= 0) {
            showToast("成績需要有進步，本學期分數必須大於上學期！", "fa-triangle-exclamation");
            return;
        }

        // Fill modal form inputs
        document.getElementById('progress-prev-gpa').value = prev;
        document.getElementById('progress-curr-gpa').value = curr;
        document.getElementById('progress-credits').value = credits;
        
        // Fill badge
        document.getElementById('form-progress-diff').innerText = '+' + (diff.toFixed(2)) + ' 分';
        
        // 1. Credits tier bonus
        let creditsBonus = 0;
        const creditsInt = parseInt(credits);
        if (creditsInt >= 1 && creditsInt <= 9) {
            creditsBonus = 300;
        } else if (creditsInt >= 10 && creditsInt <= 15) {
            creditsBonus = 500;
        } else if (creditsInt >= 16 && creditsInt <= 23) {
            creditsBonus = 1000;
        } else if (creditsInt >= 24) {
            creditsBonus = 1800;
        }
        
        // 2. Difficulty coefficient (capped at 15.0)
        const prevFloat = parseFloat(prev);
        let difficultyCoeff = 0;
        if (prevFloat >= 93.3333) {
            difficultyCoeff = 15.0;
        } else {
            difficultyCoeff = 100.0 / (100.0 - prevFloat);
        }
        
        // 3. Credit weight
        const creditWeight = creditsInt / 15.0;
        
        // 4. Progress points & cash conversion
        const points = diff * difficultyCoeff * creditWeight;
        const conversion = points * activeSettings.progressConversionRate;
        
        // 5. Total
        const total = activeSettings.progressBase + creditsBonus + Math.round(conversion);
        
        document.getElementById('form-progress-amount').innerText = 'NT$ ' + (total.toLocaleString());
        
        // Fill modal breakdown details
        document.getElementById('modal-breakdown-base').innerText = 'NT$ ' + (activeSettings.progressBase.toLocaleString());
        document.getElementById('modal-breakdown-tier').innerText = 'NT$ ' + (creditsBonus.toLocaleString());
        document.getElementById('modal-breakdown-coeff').innerText = difficultyCoeff.toFixed(2);
        document.getElementById('modal-breakdown-weight').innerText = creditWeight.toFixed(2);
        document.getElementById('modal-breakdown-points').innerText = (points.toFixed(2)) + ' 點';
        document.getElementById('modal-breakdown-cash').innerText = 'NT$ ' + (Math.round(conversion).toLocaleString());
        
        // Update modal title to official mode
        document.querySelector('#modal-apply-progress h2').innerHTML = '<i class="fa-solid fa-chart-line-up"></i> 送出學期進步獎申請';
        document.querySelector('#modal-apply-progress .target-left span').innerText = '進步幅度';
        document.querySelector('#modal-apply-progress .target-right span').innerText = '預計獎金';
        
        // Helper to calculate the latest eligible semester
        const getLatestEligibleSemester = (date = new Date()) => {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const rocYear = year - 1911;

            const currentVal = month * 100 + day;
            
            if (currentVal >= 223 && currentVal <= 731) {
                // Period 2/23 to 7/31 (Y-2, where Y = rocYear - 1). Latest eligible is Y-1.
                const Y = rocYear - 1;
                return `${Y}-1`;
            } else {
                // Period 8/1 to 2/22.
                let Y;
                if (currentVal < 223) {
                    Y = rocYear - 1;
                } else {
                    Y = rocYear;
                }
                // Latest eligible is (Y-1)-2.
                return `${Y - 1}-2`;
            }
        };

        // Helper to generate semesters from startSem to latestSem
        const generateSemesters = (startSem = '112-1', latestSem) => {
            const list = [];
            const [startYear, startTerm] = startSem.split('-').map(Number);
            const [endYear, endTerm] = latestSem.split('-').map(Number);

            let currYear = startYear;
            let currTerm = startTerm;

            while (currYear < endYear || (currYear === endYear && currTerm <= endTerm)) {
                list.push(`${currYear}-${currTerm}`);
                if (currTerm === 1) {
                    currTerm = 2;
                } else {
                    currYear++;
                    currTerm = 1;
                }
            }
            return list.reverse(); // Newest first
        };

        // Helper to format displaying text
        const getSemesterDisplayText = (semCode) => {
            const [year, term] = semCode.split('-');
            const termName = term === '1' ? '第一學期' : '第二學期';
            return `${year} 學年度 ${termName}`;
        };

        const latestSem = getLatestEligibleSemester();
        const semesterList = generateSemesters('112-1', latestSem);
        
        const progressApps = (currentUser.applications || []).filter(app => app.type === 'progress' && (app.status === 'pending' || app.status === 'approved'));
        const appliedYears = progressApps.map(app => app.academicYear);
        
        const semesterSelect = document.querySelector('#form-apply-progress [name="academic_year"]');
        if (semesterSelect) {
            semesterSelect.innerHTML = ''; // Clear existing options
            let firstEnabledIndex = -1;
            
            semesterList.forEach((semCode, index) => {
                const opt = document.createElement('option');
                opt.value = semCode;
                const baseText = getSemesterDisplayText(semCode);
                
                if (appliedYears.includes(semCode)) {
                    opt.disabled = true;
                    opt.style.color = 'rgba(255, 255, 255, 0.3)';
                    opt.text = baseText + ' (已申請)';
                } else {
                    opt.disabled = false;
                    opt.style.color = '#fff';
                    opt.text = baseText;
                    if (firstEnabledIndex === -1) {
                        firstEnabledIndex = index;
                    }
                }
                semesterSelect.appendChild(opt);
            });
            
            if (firstEnabledIndex !== -1) {
                // By default select the newest enabled option (which will be at the smallest index since it is reversed)
                semesterSelect.selectedIndex = firstEnabledIndex;
            } else {
                semesterSelect.selectedIndex = -1;
                showToast("您已申請過所有可選學期（審查中或已核准），無法重複申請！", "fa-ban");
                return;
            }
        }
        
        openModal('modal-apply-progress');
    });

    // 9. Form Submission: Scheme 2 (Progress Award)
    document.getElementById('form-apply-progress').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const prevFile = document.getElementById('progress-prev-file').files[0];
        const currFile = document.getElementById('progress-curr-file').files[0];
        
        if (!prevFile || !currFile) {
            showToast("請上傳前學期與本學期的成績單電子檔！", "fa-triangle-exclamation");
            return;
        }
        
        const payload = {
            student_name: currentUser.name,
            student_birthday: currentUser.birthday,
            name: document.getElementById('progress-name').value.trim(),
            prev_gpa: document.getElementById('progress-prev-gpa').value,
            curr_gpa: document.getElementById('progress-curr-gpa').value,
            credits: document.getElementById('progress-credits').value,
            bank_code: document.getElementById('progress-bank-code').value.trim(),
            bank_account: document.getElementById('progress-bank-account').value.trim(),
            academic_year: document.querySelector('#form-apply-progress [name="academic_year"]').value,
            file1_base64: '',
            file1_name: '',
            file2_base64: '',
            file2_name: ''
        };
        
        toggleLoading(true, "正在安全傳輸與編碼上期與本期成績單...");
        
        try {
            payload.file1_base64 = await getBase64(prevFile);
            payload.file1_name = prevFile.name;
            
            payload.file2_base64 = await getBase64(currFile);
            payload.file2_name = currFile.name;
            
            google.script.run
                .withSuccessHandler(function(data) {
                    toggleLoading(false);
                    if (data.success) {
                        closeModal('modal-apply-progress');
                        e.target.reset();
                        const elPrev = document.getElementById('progress-prev-file-display');
                        const elCurr = document.getElementById('progress-curr-file-display');
                        if (elPrev) elPrev.innerText = '';
                        if (elCurr) elCurr.innerText = '';
                        showToast(data.message, "fa-circle-check");
                        refreshUserStatusLiff();
                    } else {
                        showToast(data.message, "fa-circle-xmark");
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，進步獎申請提交失敗！", "fa-triangle-exclamation");
                })
                .submitProgress(payload);
                
        } catch(err) {
            toggleLoading(false);
            showToast("檔案編碼或傳輸失敗！", "fa-triangle-exclamation");
        }
    });

    // 10. Open Scheme 3 (Future Blueprint) Modal
    document.getElementById('btn-apply-blueprint-modal').addEventListener('click', () => {
        openModal('modal-apply-blueprint');
    });

    // 11. Form Submission: Scheme 3 (Future Blueprint Project)
    document.getElementById('form-apply-blueprint').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = document.getElementById('blueprint-file').files[0];
        if (!file) {
            showToast("請選擇上傳您的未來企劃書檔案！", "fa-triangle-exclamation");
            return;
        }
        
        const payload = {
            student_name: currentUser.name,
            student_birthday: currentUser.birthday,
            name: document.getElementById('blueprint-name').value.trim(),
            project_name: document.getElementById('blueprint-project-name').value.trim(),
            project_month: document.getElementById('blueprint-project-month').value.trim(),
            bank_code: document.getElementById('blueprint-bank-code').value.trim(),
            bank_account: document.getElementById('blueprint-bank-account').value.trim(),
            academic_year: document.querySelector('#form-apply-blueprint [name="academic_year"]').value,
            file_base64: '',
            file_name: ''
        };
        
        toggleLoading(true, "企劃書編碼並上傳至雲端中...");
        
        try {
            payload.file_base64 = await getBase64(file);
            payload.file_name = file.name;
            
            google.script.run
                .withSuccessHandler(function(data) {
                    toggleLoading(false);
                    if (data.success) {
                        closeModal('modal-apply-blueprint');
                        e.target.reset();
                        const elBlueprint = document.getElementById('blueprint-file-display');
                        if (elBlueprint) elBlueprint.innerText = '';
                        showToast(data.message, "fa-circle-check");
                        refreshUserStatusLiff();
                    } else {
                        showToast(data.message, "fa-circle-xmark");
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，企劃書提交失敗！", "fa-triangle-exclamation");
                })
                .submitBlueprint(payload);
                
        } catch(err) {
            toggleLoading(false);
            showToast("企劃書讀取錯誤！", "fa-triangle-exclamation");
        }
    });
}

// Handle LINE LIFF registration submission
function handleLoginSubmit() {
    const nameVal = document.getElementById('login-student-name').value.trim();
    const birthdayVal = document.getElementById('login-student-birthday').value.trim();
    const nicknameVal = document.getElementById('login-student-nickname').value.trim();
    const schoolVal = document.getElementById('login-student-school').value.trim();
    const departmentVal = document.getElementById('login-student-department').value.trim();
    const gradeVal = document.getElementById('login-student-grade').value;
    const errorDiv = document.getElementById('login-error-msg');
    
    if (!nameVal || !birthdayVal) {
        errorDiv.innerText = "請輸入中文姓名與生日 (MMDD，4碼數字)！";
        errorDiv.style.display = "block";
        return;
    }
    
    if (birthdayVal.length !== 4 || isNaN(birthdayVal)) {
        errorDiv.innerText = "生日格式不正確，應為 4 碼數字 (如 0918)！";
        errorDiv.style.display = "block";
        return;
    }
    
    if (!nicknameVal || !schoolVal || !departmentVal || !gradeVal) {
        errorDiv.innerText = "請填寫所有註冊基本資料 (暱稱、學校、科系、年級)！";
        errorDiv.style.display = "block";
        return;
    }
    
    errorDiv.style.display = "none";
    toggleLoading(true, "正在安全建立您的計畫註冊檔案...");
    
    // Call Register API
    google.script.run
        .withSuccessHandler(function(data) {
            toggleLoading(false);
            if (data.success) {
                // Clear inputs
                document.getElementById('login-student-nickname').value = '';
                document.getElementById('login-student-school').value = '';
                document.getElementById('login-student-department').value = '';
                
                // Close registration modal
                closeModal('modal-login');
                
                // Auto login after successful registration
                toggleLoading(true, "正在自動登入並載入頁面...");
                google.script.run
                    .withSuccessHandler(onLiffLoginSuccess)
                    .withFailureHandler(onLiffLoginFailure)
                    .studentLiffLogin(window.lineUid);
                    
                showToast("註冊成功！", "fa-circle-check");
            } else {
                errorDiv.innerText = data.message;
                errorDiv.style.display = "block";
            }
        })
        .withFailureHandler(function(err) {
            toggleLoading(false);
            errorDiv.innerText = "註冊傳輸失敗，請稍後重試！";
            errorDiv.style.display = "block";
        })
        .studentLiffRegister({
            name: nameVal, 
            birthday: birthdayVal, 
            nickname: nicknameVal,
            school: schoolVal,
            department: departmentVal,
            grade: gradeVal
        }, window.lineUid);
}

// Progress Calculator Engine
function initProgressCalculator() {
    const prevInput = document.getElementById('calc-prev-gpa');
    const currInput = document.getElementById('calc-curr-gpa');
    const creditsInput = document.getElementById('calc-credits');
    const resultBox = document.getElementById('calc-amount-result');
    const breakdownBox = document.getElementById('calc-breakdown');
    
    const updateCalculatedValue = () => {
        const prev = parseFloat(prevInput.value);
        const curr = parseFloat(currInput.value);
        const credits = parseInt(creditsInput.value);
        
        if (isNaN(prev) || isNaN(curr) || isNaN(credits) || curr <= prev || credits <= 0 || prev < 0 || prev >= 100 || curr > 100) {
            resultBox.innerText = "NT$ 0";
            if (breakdownBox) breakdownBox.style.display = 'none';
            return;
        }
        
        // 1. Credits tier bonus
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
        
        // 2. Difficulty coefficient (capped at 15.0)
        let difficultyCoeff = 0;
        if (prev >= 93.3333) {
            difficultyCoeff = 15.0;
        } else {
            difficultyCoeff = 100.0 / (100.0 - prev);
        }
        
        // 3. Credit weight
        const creditWeight = credits / 15.0;
        
        // 4. Progress points & cash conversion
        const diff = curr - prev;
        const points = diff * difficultyCoeff * creditWeight;
        const conversion = points * activeSettings.progressConversionRate;
        
        // 5. Total
        const total = activeSettings.progressBase + creditsBonus + Math.round(conversion);
        
        // Update UI result
        resultBox.innerText = 'NT$ ' + (total.toLocaleString());
        
        // Show breakdown
        if (breakdownBox) {
            document.getElementById('breakdown-base').innerText = 'NT$ ' + (activeSettings.progressBase.toLocaleString());
            document.getElementById('breakdown-tier').innerText = 'NT$ ' + (creditsBonus.toLocaleString());
            document.getElementById('breakdown-coeff').innerText = difficultyCoeff.toFixed(2);
            document.getElementById('breakdown-weight').innerText = creditWeight.toFixed(2);
            document.getElementById('breakdown-points').innerText = (points.toFixed(2)) + ' 點';
            document.getElementById('breakdown-cash').innerText = 'NT$ ' + (Math.round(conversion).toLocaleString());
            breakdownBox.style.display = 'block';
        }
    };
    
    prevInput.addEventListener('input', updateCalculatedValue);
    currInput.addEventListener('input', updateCalculatedValue);
    creditsInput.addEventListener('input', updateCalculatedValue);
}

// Session Logout (LINE LIFF Logout and Reload)
function logout() {
    sessionStorage.clear();
    localStorage.removeItem('guge_line_uid');
    localStorage.removeItem('guge_line_name');
    if (window.liff && liff.isLoggedIn()) {
        liff.logout();
    }
    window.location.reload();
}

// Modal Helpers
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('show');
        const content = m.querySelector('.modal-content');
        if (content) content.scrollTop = 0;
    }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('show');
}

// Toast Helper
let toastTimer = null;
function showToast(text, iconClass = "fa-circle-info") {
    const toast = document.getElementById('toast-message');
    const toastText = document.getElementById('toast-body-text');
    const toastIcon = document.getElementById('toast-icon');
    
    if (toast && toastText && toastIcon) {
        toastText.innerText = text;
        toastIcon.className = 'fa-solid ' + (iconClass) + ' toast-icon';
        
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
}

// Loading Toggle
function toggleLoading(show, text = "上傳載入中...") {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.querySelector('p').innerText = text;
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Switch scheme tabs
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const cardChallenge = document.getElementById('card-challenge');
    const cardProgress = document.getElementById('card-progress');
    const cardBlueprint = document.getElementById('card-blueprint');

    if (cardChallenge) cardChallenge.style.display = tabName === 'challenge' ? 'block' : 'none';
    if (cardProgress) cardProgress.style.display = tabName === 'progress' ? 'block' : 'none';
    if (cardBlueprint) cardBlueprint.style.display = tabName === 'blueprint' ? 'block' : 'none';
    
    sessionStorage.setItem('guge_active_tab', tabName);
    
    if (tabName === 'blueprint') {
        // Recalculate milestone wrapping when blueprint tab is displayed
        setTimeout(adjustMilestones, 50);
    }
}

// Adjust milestone tracker nodes wrapping style dynamically based on box width
function adjustMilestones() {
    const panel = document.querySelector('.blueprint-milestone-panel');
    if (!panel) return;
    
    const nodes = document.querySelectorAll('.milestone-node');
    const textContents = document.querySelectorAll('.node-text-content');
    
    // Reset force-wrap class first
    nodes.forEach(n => n.classList.remove('force-wrap'));
    
    // If the display of parent card is none, sizes will be 0. Avoid checking in this state.
    const cardBlueprint = document.getElementById('card-blueprint');
    if (cardBlueprint && cardBlueprint.style.display === 'none') {
        return;
    }
    
    const panelWidth = panel.getBoundingClientRect().width;
    let shouldWrapAll = (panelWidth < 450); // standard threshold where Phase 2 wraps in the inner box
    
    // Check if any node text wraps naturally by checking height of text containers
    if (!shouldWrapAll) {
        textContents.forEach(tc => {
            // If height of text container is greater than one line (e.g. > 24px)
            if (tc.clientHeight > 24) {
                shouldWrapAll = true;
            }
        });
    }
    
    // If any wraps or container is below width threshold, add force-wrap class to all nodes
    if (shouldWrapAll) {
        nodes.forEach(n => n.classList.add('force-wrap'));
    }
}

// Render Application History List grouped by type
function renderHistoryList(apps) {
    const panel = document.getElementById('student-history-panel');
    const container = document.getElementById('history-list');
    if (!panel || !container) return;
    
    if (!apps || apps.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'block';
    container.innerHTML = '';
    
    // Filter by type: challenge, progress, blueprint
    const challengeApps = apps.filter(a => a.type === 'challenge');
    const progressApps = apps.filter(a => a.type === 'progress');
    const blueprintApps = apps.filter(a => a.type === 'blueprint');
    
    // Unified order from top to bottom: Scheme 1 -> Scheme 2 -> Scheme 3
    const sortedApps = [...challengeApps, ...progressApps, ...blueprintApps];
    
    if (sortedApps.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    sortedApps.forEach(app => {
        let typeLabel = "";
        let iconClass = "";
        let badgeClass = "";
        let badgeText = "";
        
        if (app.type === 'challenge') {
            typeLabel = "方案一：成績挑戰獎";
            iconClass = "fa-shield-halved";
        } else if (app.type === 'progress') {
            typeLabel = "方案二：學期進步獎";
            iconClass = "fa-arrow-up-right-dots";
        } else {
            typeLabel = "方案三：未來藍圖計畫";
            iconClass = "fa-diagram-project";
        }
        
        // Status checks
        if (app.status === 'pending') {
            badgeClass = 'badge-pending';
            badgeText = '審查中';
        } else if (app.status === 'approved') {
            badgeClass = 'badge-approved';
            badgeText = '審核通過';
        } else if (app.status === 'rejected') {
            badgeClass = 'badge-rejected';
            badgeText = '退回修正';
        } else if (app.status === 'destroyed') {
            badgeClass = 'badge-destroyed';
            badgeText = '已撥款結案';
        } else {
            badgeClass = 'badge-pending';
            badgeText = app.status || '未定義';
        }
        
        const row = document.createElement('div');
        row.className = 'history-item';
        row.style.cssText = '\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            padding: 12px 15px;\n            background: rgba(255,255,255,0.03);\n            border: 1px solid rgba(255,255,255,0.06);\n            border-radius: 8px;\n            cursor: pointer;\n            transition: all 0.2s ease;\n        ';
        
        row.onmouseenter = () => {
            row.style.background = 'rgba(255,255,255,0.06)';
            row.style.borderColor = 'var(--neon-blue)';
        };
        row.onmouseleave = () => {
            row.style.background = 'rgba(255,255,255,0.03)';
            row.style.borderColor = 'rgba(255,255,255,0.06)';
        };
        
        row.onclick = () => showApplicationDetail(app);
        
        row.innerHTML = '\n            <div style="display: flex; align-items: center; gap: 10px; text-align: left;">\n                <i class="fa-solid ' + (iconClass) + '" style="color: var(--neon-blue); font-size: 1.1rem; width: 20px; text-align: center;"></i>\n                <div>\n                    <span style="font-weight: bold; font-size: 0.95rem; display: block; color: #fff;">' + (typeLabel) + '</span>\n                    <small style="color: var(--text-muted); font-size: 0.8rem;">' + (app.academicYear) + ' | NT$ ' + (parseInt(app.amount).toLocaleString()) + '</small>\n                </div>\n            </div>\n            <span class="status-badge ' + (badgeClass) + '" style="padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; min-width: 60px; text-align: center;">' + (badgeText) + '</span>\n        ';
        
        container.appendChild(row);
    });
}

// Show specific Application Detail Modal
function showApplicationDetail(app) {
    let typeLabel = "";
    if (app.type === 'challenge') typeLabel = "方案一：成績挑戰獎";
    else if (app.type === 'progress') typeLabel = "方案二：學期進步獎";
    else typeLabel = "方案三：未來藍圖計畫";
    
    let statusText = "";
    let badgeHtml = "";
    let feedbackText = "";
    
    if (app.status === 'pending') {
        statusText = "審查中";
        badgeHtml = '<span class="status-badge badge-pending" style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">' + (statusText) + '</span>';
        feedbackText = "資料已送出，後台管理團隊審核中。請耐心等待 LINE 通知。";
    } else if (app.status === 'approved') {
        statusText = "審核通過";
        badgeHtml = '<span class="status-badge badge-approved" style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">' + (statusText) + '</span>';
        feedbackText = "審核已通過！目前已送交網銀進行撥款流程。請於近日注意您的收款帳戶變動。";
    } else if (app.status === 'rejected') {
        statusText = "退回修正";
        badgeHtml = '<span class="status-badge badge-rejected" style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">' + (statusText) + '</span>';
        feedbackText = "審核未通過（已被退回）。請確認您的申請資料填寫是否正確，或者上傳之證明文件是否清晰。您可以隨時重新送出申請。";
    } else if (app.status === 'destroyed') {
        statusText = "已撥款結案";
        badgeHtml = '<span class="status-badge badge-destroyed" style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">' + (statusText) + '</span>';
        feedbackText = "已完成撥款！本申請案已正式結案。依照隱私安全承諾，您的真實姓名、收款銀行帳戶及成績單檔案均已【物理銷毀】並完成去識別化，感謝您的參與！";
    } else {
        statusText = app.status || "核定中";
        badgeHtml = '<span class="status-badge badge-pending" style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">' + (statusText) + '</span>';
        feedbackText = "本案正在審理中。";
    }
    
    document.getElementById('detail-app-id').innerText = app.id || "N/A";
    document.getElementById('detail-app-type').innerText = typeLabel;
    document.getElementById('detail-app-year').innerText = app.academicYear || "N/A";
    document.getElementById('detail-app-amount').innerText = "NT$ " + parseInt(app.amount).toLocaleString();
    document.getElementById('detail-app-date').innerText = app.createdAt ? app.createdAt.substring(0, 16) : "--";
    document.getElementById('detail-app-status-badge').innerHTML = badgeHtml;
    document.getElementById('detail-app-feedback').innerText = feedbackText;
    
    openModal('modal-history-detail');
}

// Initialize Drag & Drop and Click triggers for Scheme 1 file upload
function initDragAndDropUpload() {
    const dragArea = document.getElementById('drag-challenge-file');
    const fileInput = document.getElementById('challenge-file');
    const display = document.getElementById('challenge-file-name-display');
    
    if (!dragArea || !fileInput) return;
    
    // 1. Click on drag area triggers file input click
    dragArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Prevent event bubbling when file input is clicked to avoid infinite click loop!
    fileInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 2. Drag & Drop visual feedback and file placement
    ['dragenter', 'dragover'].forEach(eventName => {
        dragArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragArea.style.borderColor = 'var(--neon-blue)';
            dragArea.style.background = 'rgba(0, 187, 249, 0.08)';
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dragArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragArea.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            dragArea.style.background = 'rgba(255, 255, 255, 0.02)';
        }, false);
    });
    
    dragArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            // Update display text
            if (display) {
                display.innerText = '已選取: ' + (files[0].name) + ' (' + ((files[0].size/1024).toFixed(1)) + ' KB)';
            }
        }
    });
}

// ==========================================
// 🌌 雲端底圖非同步載入引擎
// ==========================================
function spawnRandomPic() {
    google.script.run
        .withSuccessHandler(function(result) {
            if (result.success && Array.isArray(result.images)) {
                // 先清除舊圖
                document.querySelectorAll('.random-pic').forEach(el => el.remove());
                result.images.forEach((imgUrl, index) => {
                    renderSinglePic(imgUrl, index);
                });
            }
        })
        .getActiveBgImages();
}

function renderSinglePic(imgUrl, index) {
    const container = document.body;
    if (!container) return;

    const isMobile = window.innerWidth < 768;

    const picImg = document.createElement('img');
    picImg.src = imgUrl;
    picImg.className = 'random-pic';
    picImg.style.pointerEvents = 'none';
    picImg.style.position = 'fixed'; // 使用 fixed 以利滑動時固定在背景
    picImg.style.zIndex = '0';          // 確保圖片在最底層

    // 尺寸設定
    const baseSize = isMobile
        ? Math.floor(Math.random() * 60 + 160)
        : Math.floor(Math.random() * 80 + 200);
    picImg.style.width = baseSize + 'px';

    // 排版邏輯
    if (index === 0) {
        picImg.style.top = isMobile ? '8%' : '10%';
        picImg.style.left = '-15px';
    } else if (index === 1) {
        picImg.style.top = isMobile ? '38%' : '40%';
        picImg.style.right = '-15px';
        picImg.style.transform = 'scaleX(-1)';
    } else {
        picImg.style.bottom = isMobile ? '8%' : '10%';
        picImg.style.left = '-10px';
    }

    container.appendChild(picImg);
}

// ==========================================
// ✏️ 編輯個人基本資料處理引擎
// ==========================================
function openEditProfileModal() {
    // 預填當前使用者資料
    document.getElementById('edit-student-name').value = currentUser.name || '';
    document.getElementById('edit-student-birthday').value = currentUser.birthday || '';
    document.getElementById('edit-student-nickname').value = currentUser.nickname || '';
    document.getElementById('edit-student-school').value = currentUser.school || '';
    document.getElementById('edit-student-department').value = currentUser.department || '';
    
    const gradeSelect = document.getElementById('edit-student-grade');
    if (gradeSelect) {
        gradeSelect.value = currentUser.grade || '大一';
    }
    
    document.getElementById('edit-student-bankcode').value = currentUser.bankCode || '';
    document.getElementById('edit-student-bankaccount').value = currentUser.bankAccount || '';
    
    // 隱藏錯誤訊息
    const errorDiv = document.getElementById('edit-error-msg');
    if (errorDiv) errorDiv.style.display = 'none';
    
    openModal('modal-edit-profile');
}

function handleEditProfileSubmit() {
    const nicknameVal = document.getElementById('edit-student-nickname').value.trim();
    const schoolVal = document.getElementById('edit-student-school').value.trim();
    const departmentVal = document.getElementById('edit-student-department').value.trim();
    const gradeVal = document.getElementById('edit-student-grade').value;
    const bankcodeVal = document.getElementById('edit-student-bankcode').value.trim();
    const bankaccountVal = document.getElementById('edit-student-bankaccount').value.trim();
    const errorDiv = document.getElementById('edit-error-msg');
    
    if (!nicknameVal || !schoolVal || !departmentVal || !gradeVal) {
        if (errorDiv) {
            errorDiv.innerText = "暱稱、學校、科系、年級皆為必填項目！";
            errorDiv.style.display = "block";
        }
        return;
    }
    
    // 銀行代碼校驗
    if (bankcodeVal && (bankcodeVal.length !== 3 || isNaN(bankcodeVal))) {
        if (errorDiv) {
            errorDiv.innerText = "銀行代碼必須為 3 碼數字 (如 008)！";
            errorDiv.style.display = "block";
        }
        return;
    }
    
    // 銀行帳號校驗
    if (bankaccountVal && isNaN(bankaccountVal)) {
        if (errorDiv) {
            errorDiv.innerText = "銀行帳號必須為純數字，不可包含符號或空格！";
            errorDiv.style.display = "block";
        }
        return;
    }
    
    if (errorDiv) errorDiv.style.display = "none";
    toggleLoading(true, "正在儲存更新資料並與雲端同步...");
    
    const payload = {
        nickname: nicknameVal,
        school: schoolVal,
        department: departmentVal,
        grade: gradeVal,
        bank_code: bankcodeVal,
        bank_account: bankaccountVal
    };
    
    google.script.run
        .withSuccessHandler(function(res) {
            if (res.success) {
                closeModal('modal-edit-profile');
                showToast(res.message, "fa-circle-check");
                
                // 重新載入學生資料以刷新 UI 與快取
                toggleLoading(true, "正在重新載入最新學籍資料...");
                google.script.run
                    .withSuccessHandler(onLiffLoginSuccess)
                    .withFailureHandler(onLiffLoginFailure)
                    .studentLiffLogin(window.lineUid);
            } else {
                toggleLoading(false);
                if (errorDiv) {
                    errorDiv.innerText = res.message;
                    errorDiv.style.display = "block";
                }
            }
        })
        .withFailureHandler(function(err) {
            toggleLoading(false);
            if (errorDiv) {
                errorDiv.innerText = "儲存資料失敗，請確認連線狀態！";
                errorDiv.style.display = "block";
            }
        })
        .studentUpdateProfile(window.lineUid, payload);
}
