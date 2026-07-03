// --- Script Tag 1 ---

        window.lineUid = "<?= lineUid ?>";
        window.lineDisplayName = "<?= lineDisplayName ?>";
        window.lineAuthorizeUrl = "<?= lineAuthorizeUrl ?>";
    
// --- Script Tag 2 ---




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
    unlockedChallenges: []
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
});

// Debug Logger function
function logDebug(msg) {
    console.log(msg);
    const consoleDiv = document.getElementById('debug-console');
    const logArea = document.getElementById('debug-log-area');
    if (consoleDiv && logArea) {
        consoleDiv.style.display = 'block';
        const time = new Date().toLocaleTimeString();
        logArea.innerHTML += `[${time}] ${msg}<br>`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }
}

// Hook global errors
window.onerror = function(message, source, lineno, colno, error) {
    logDebug(`❌ JS ERROR: ${message} (Line: ${lineno}, Col: ${colno})`);
    return false;
};

// Initialize LINE Login flow using server-injected details
function initLiff() {
    logDebug("[INFO] Starting LINE Verification...");
    logDebug("[INFO] Server-side OAuth Uid: " + window.lineUid);
    logDebug("[INFO] Server-side OAuth Name: " + window.lineDisplayName);
    
    const isMissingUid = (!window.lineUid || window.lineUid.indexOf("<?=") === 0 || window.lineUid.trim() === "");
    
    if (isMissingUid) {
        logDebug("[WARNING] LINE UID is missing. User needs to authorize LINE Login.");
        toggleLoading(false);
        
        // Hide main application and display the secure LINE Login redirect card
        const mainApp = document.getElementById('main-app-container');
        const loginRedirectCard = document.getElementById('app-login-redirect-card');
        const authorizeBtn = document.getElementById('lnk-line-authorize');
        
        if (mainApp) mainApp.style.display = 'none';
        if (loginRedirectCard) loginRedirectCard.style.display = 'flex';
        if (authorizeBtn) authorizeBtn.href = window.lineAuthorizeUrl || "#";
        
        showToast("請點選 LINE 驗證登入以進入計畫！", "fa-circle-exmark");
    } else {
        // Hide redirect card and show main app
        const mainApp = document.getElementById('main-app-container');
        const loginRedirectCard = document.getElementById('app-login-redirect-card');
        
        if (mainApp) mainApp.style.display = 'block';
        if (loginRedirectCard) loginRedirectCard.style.display = 'none';
        
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
        loginModal.querySelector('.modal-header h2').innerHTML = `<i class="fa-brands fa-line" style="color: #06C755;"></i> 請使用 LINE 驗證登入`;
        loginModal.querySelector('.modal-body').innerHTML = `
            <div style="text-align: center; padding: 20px 10px;">
                <i class="fa-brands fa-line" style="font-size: 4rem; color: #06C755; margin-bottom: 15px;"></i>
                <p style="color: #fff; font-size: 1.05rem; font-weight: bold; margin-bottom: 10px;">歡迎加入古哥挑戰獎學金挑戰計畫</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin-bottom: 25px;">
                    由於瀏覽器安全限制，無法在 Google 框架內直接進行 LINE 登入。請點選下方按鈕跳出框架進行授權。
                </p>
                <a href="https://liff.line.me/2010560500-s1V0QyLa" target="_top" class="btn btn-primary btn-full" style="display: block; text-decoration: none; text-align: center; line-height: 24px;">
                    <i class="fa-solid fa-right-to-bracket"></i> 經由 LINE 授權登入
                </a>
            </div>
        `;
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
    if (data.success) {
        currentUser.name = data.name;
        currentUser.birthday = data.birthday;
        currentUser.nickname = data.nickname;
        currentUser.school = data.school;
        currentUser.department = data.department;
        currentUser.grade = data.grade;
        currentUser.attempts = data.attempts;
        currentUser.unlockedChallenges = data.unlocked_challenges;
        
        if (data.settings) {
            activeSettings.progressBase = data.settings.progress_base || 1500;
            activeSettings.progressConversionRate = data.settings.progress_conversion_rate || 50;
            activeSettings.challengeAmounts = data.settings.challenge_amounts || [7000, 8500, 10000, 12000, 15000, 18000, 20000, 25000];
            activeSettings.blueprintAmount = data.settings.blueprint_amount || 30000;
        }
        
        // Save to Session Storage
        sessionStorage.setItem('guge_student_name', data.name);
        sessionStorage.setItem('guge_student_birthday', data.birthday);
        
        // Close login modal if open
        closeModal('modal-login');
        
        // Open Consent Modal
        openModal('modal-consent');
        
        // Load data to UI
        updateStudentUI();
        showToast(`登入成功！歡迎進入計畫，${data.name}同學。`, "fa-circle-check");
    } else if (data.code === 'NOT_REGISTERED') {
        // First time login: Open registration form and prefill nickname with LINE name
        openModal('modal-login');
        document.getElementById('login-student-nickname').value = window.lineDisplayName || "";
        showToast("首次登入，請填寫真實資料以完成註冊！", "fa-user-plus");
    } else {
        showToast(data.message || "身分驗證失敗！", "fa-circle-xmark");
    }
}

// LIFF Login Failure Handler
function onLiffLoginFailure(err) {
    toggleLoading(false);
    logDebug("❌ studentLiffLogin backend failed: " + (err ? err.toString() : "Unknown Error"));
    console.error("LIFF Login backend error:", err);
    showToast("伺服器連線失敗，請稍後重試！", "fa-circle-xmark");
}

// Refresh User Status by LIFF (Attempts and unlocked challenges count)
function refreshUserStatusLiff() {
    google.script.run
        .withSuccessHandler(function(data) {
            if (data.success) {
                currentUser.attempts = data.attempts;
                currentUser.unlockedChallenges = data.unlocked_challenges;
                updateStudentUI();
            }
        })
        .studentLiffLogin(window.lineUid);
}

// Update the entire UI based on logged-in student state
function updateStudentUI() {
    // Update top status bar
    document.getElementById('logged-student-name').innerText = currentUser.name;
    document.getElementById('logged-student-attempts').innerText = currentUser.attempts;
    document.getElementById('student-status-bar').style.display = 'flex';
    
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
        badgeProgress.innerHTML = `<i class="fa-solid fa-lock"></i> 鎖定中`;
        descProgress.innerText = "在大一期間為鎖定預告狀態，大二上學期將會正式解鎖。此方案鼓勵挑戰自我極限，突破往期成績！";
        if (overlayProgress) overlayProgress.style.display = 'block';
        if (titleCalc) titleCalc.innerHTML = `<i class="fa-solid fa-calculator"></i> 獎金模擬試算器 (大一體驗版)`;
        btnApplyProgress.innerHTML = `<i class="fa-solid fa-ban"></i> 大一學生暫無申請權限`;
        btnApplyProgress.className = "btn btn-secondary btn-full btn-disabled";
    } else {
        cardProgress.classList.remove('locked');
        badgeProgress.className = "status-badge hot";
        badgeProgress.innerHTML = `<i class="fa-solid fa-unlock-keyhole"></i> 已解鎖可申請`;
        descProgress.innerText = "學期進步獎已解鎖！只要本學期平均分數高於上一學期，即可申請高額進步獎金。";
        if (overlayProgress) overlayProgress.style.display = 'none';
        if (titleCalc) titleCalc.innerHTML = `<i class="fa-solid fa-calculator"></i> 成績進步試算與申請`;
        btnApplyProgress.innerHTML = `<i class="fa-solid fa-arrow-up-right-dots"></i> 填寫匯款資料，送出申請`;
        btnApplyProgress.className = "btn btn-secondary btn-full";
    }

    // Fill names in forms
    document.getElementById('challenge-name').value = currentUser.name;
    document.getElementById('progress-name').value = currentUser.name;
    document.getElementById('blueprint-name').value = currentUser.name;

    // Apply active settings values to UI text
    const formulaDesc = document.getElementById('calc-formula-desc');
    if (formulaDesc && activeSettings) {
        formulaDesc.innerText = `試算公式：${activeSettings.progressBase} (底金) + 學分級距加給 + [ (進步分數 × 難度係數 × 學分權重) × ${activeSettings.progressConversionRate}元 ]`;
    }
    const blueprintBtn = document.getElementById('btn-apply-blueprint-modal');
    if (blueprintBtn && activeSettings && activeSettings.blueprintAmount) {
        blueprintBtn.innerHTML = `<i class="fa-solid fa-rocket"></i> 上傳圓夢企劃書 ➔ 啟動募資 (最高 NT$ ${activeSettings.blueprintAmount.toLocaleString()})`;
    }
    const modalBlueprintAmount = document.querySelector('#modal-apply-blueprint .target-left strong');
    if (modalBlueprintAmount && activeSettings && activeSettings.blueprintAmount) {
        modalBlueprintAmount.innerText = `最高 NT$ ${activeSettings.blueprintAmount.toLocaleString()}`;
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
        item.classList.remove('unlocked', 'selected');
        
        // If already unlocked
        if (currentUser.unlockedChallenges.includes(targetVal)) {
            item.classList.add('unlocked');
            // Change unlock icon
            const lockIcon = item.querySelector('.unlocked-icon');
            if (lockIcon) {
                lockIcon.className = "fa-solid fa-circle-check unlocked-icon";
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
                amountSpan.innerText = `NT$ ${amt.toLocaleString()}`;
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
            closeModal('modal-consent');
            showToast("已簽署隱私保障同意書，申請權限已解鎖！", "fa-user-shield");
        });
    }

    // 3. Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // 3.5 Program Tabs Switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // 4. Shields Click event
    const shieldItems = document.querySelectorAll('.shield-item');
    shieldItems.forEach(item => {
        item.addEventListener('click', () => {
            // Check if already unlocked
            if (item.classList.contains('unlocked')) {
                showToast("此分數防線已在往期擊破，請選擇其他防線進行挑戰！", "fa-circle-xmark");
                return;
            }
            
            // Remove selected class from all shields
            shieldItems.forEach(s => s.classList.remove('selected'));
            
            // Select this shield
            item.classList.add('selected');
            selectedChallengeTarget = parseFloat(item.getAttribute('data-target'));
            
            showToast(`已選擇防線門檻：${selectedChallengeTarget}分，請點擊下方按鈕送出成績！`, "fa-bullseye");
        });
    });

    // 5. Open Scheme 1 (Challenge Award) Modal
    document.getElementById('btn-apply-challenge-modal').addEventListener('click', () => {
        if (!selectedChallengeTarget) {
            showToast("請先點選上方的分數防線盾牌！", "fa-circle-exclamation");
            return;
        }
        
        // Populate threshold value in modal
        document.getElementById('form-challenge-target').innerText = selectedChallengeTarget.toFixed(2);
        
        // Populate level amount
        const currentLevel = Math.min(currentUser.attempts + 1, 8);
        const assignedAmt = activeSettings.challengeAmounts[currentLevel - 1];
        document.getElementById('form-challenge-amount').innerText = `NT$ ${assignedAmt.toLocaleString()}`;
        
        openModal('modal-apply-challenge');
    });

    // 6. Form Submission: Scheme 1 (Challenge Award)
    document.getElementById('form-apply-challenge').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('challenge-file');
        const file = fileInput.files[0];
        
        const payload = {
            student_name: currentUser.name,
            student_birthday: currentUser.birthday,
            name: document.getElementById('challenge-name').value.trim(),
            gpa: document.getElementById('challenge-gpa').value,
            target: selectedChallengeTarget,
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
                        document.getElementById('challenge-file-display').innerText = '';
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
                    display.innerText = `已選取: ${e.target.files[0].name} (${(e.target.files[0].size/1024).toFixed(1)} KB)`;
                } else {
                    display.innerText = '';
                }
            });
        }
    };
    setupFileFeedback('challenge-file', 'challenge-file-display');
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
        document.getElementById('form-progress-diff').innerText = `+${diff.toFixed(2)} 分`;
        
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
        
        document.getElementById('form-progress-amount').innerText = `NT$ ${total.toLocaleString()}`;
        
        // Fill modal breakdown details
        document.getElementById('modal-breakdown-base').innerText = `NT$ ${activeSettings.progressBase.toLocaleString()}`;
        document.getElementById('modal-breakdown-tier').innerText = `NT$ ${creditsBonus.toLocaleString()}`;
        document.getElementById('modal-breakdown-coeff').innerText = difficultyCoeff.toFixed(2);
        document.getElementById('modal-breakdown-weight').innerText = creditWeight.toFixed(2);
        document.getElementById('modal-breakdown-points').innerText = `${points.toFixed(2)} 點`;
        document.getElementById('modal-breakdown-cash').innerText = `NT$ ${Math.round(conversion).toLocaleString()}`;
        
        // Update modal title to official mode
        document.querySelector('#modal-apply-progress h2').innerHTML = `<i class="fa-solid fa-chart-line-up"></i> 送出學期進步獎申請`;
        document.querySelector('#modal-apply-progress .target-left span').innerText = '進步幅度';
        document.querySelector('#modal-apply-progress .target-right span').innerText = '預計獎金';
        
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
                        document.getElementById('progress-prev-file-display').innerText = '';
                        document.getElementById('progress-curr-file-display').innerText = '';
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
                        document.getElementById('blueprint-file-display').innerText = '';
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
        resultBox.innerText = `NT$ ${total.toLocaleString()}`;
        
        // Show breakdown
        if (breakdownBox) {
            document.getElementById('breakdown-base').innerText = `NT$ ${activeSettings.progressBase.toLocaleString()}`;
            document.getElementById('breakdown-tier').innerText = `NT$ ${creditsBonus.toLocaleString()}`;
            document.getElementById('breakdown-coeff').innerText = difficultyCoeff.toFixed(2);
            document.getElementById('breakdown-weight').innerText = creditWeight.toFixed(2);
            document.getElementById('breakdown-points').innerText = `${points.toFixed(2)} 點`;
            document.getElementById('breakdown-cash').innerText = `NT$ ${Math.round(conversion).toLocaleString()}`;
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
        toastIcon.className = `fa-solid ${iconClass} toast-icon`;
        
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
}





