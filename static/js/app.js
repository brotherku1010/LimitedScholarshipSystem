/* ==========================================================================
   【古哥獎學金】成績挑戰計畫 - 互動邏輯 (Client-side JS)
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
    // Check if user is already logged in (session persistence)
    checkSessionLogin();
    
    // Initialize Event Listeners
    initEventListeners();
    
    // Initialize Progress Calculator Auto-updater
    initProgressCalculator();
});

// Check Session Storage
function checkSessionLogin() {
    const savedName = sessionStorage.getItem('guge_student_name');
    const savedBirthday = sessionStorage.getItem('guge_student_birthday');
    
    if (savedName && savedBirthday) {
        // Fetch fresh status from server
        refreshUserStatus(savedName, savedBirthday);
    } else {
        // Force pop up identity login
        openModal('modal-login');
    }
}

// Refresh User Status (Shields and attempts count)
function refreshUserStatus(name, birthday) {
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, birthday: birthday })
    })
    .then(res => res.json())
    .then(data => {
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
            
            // Update UI elements
            updateStudentUI();
        } else {
            // Invalid credentials, clear and logout
            logout();
        }
    })
    .catch(err => {
        console.error("Error refreshing status:", err);
        showToast("伺服器連線異常，將使用暫存模式", "fa-triangle-exclamation");
        updateStudentUI(); // Fallback to local
    });
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

// Event Listeners Initialization
function initEventListeners() {
    // 1. Submit Login
    document.getElementById('btn-submit-login').addEventListener('click', handleLoginSubmit);
    document.getElementById('login-student-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLoginSubmit();
    });
    document.getElementById('login-student-birthday').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLoginSubmit();
    });

    // 2. Consent Checkbox
    const checkboxConsent = document.getElementById('checkbox-consent');
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

    // 5. Open Challenge Application Modal
    document.getElementById('btn-apply-challenge-modal').addEventListener('click', () => {
        if (!selectedChallengeTarget) {
            showToast("請先點選上方的「古哥防線」分數盾牌作為本次挑戰目標！", "fa-circle-exclamation");
            // Scroll up to shields
            document.getElementById('shields-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        
        // Prepare target badge details
        document.getElementById('form-challenge-target-score').innerText = selectedChallengeTarget;
        
        const rewards = [7000, 8500, 10000, 12000, 15000, 18000, 20000, 25000];
        const nextReward = rewards[min(currentUser.attempts, rewards.length - 1)];
        document.getElementById('form-challenge-target-amount').innerText = `NT$ ${nextReward.toLocaleString()}`;
        
        openModal('modal-apply-challenge');
    });

    // 6. Drag & Drop Upload Handlers for Challenge form
    const dragZone = document.getElementById('drag-challenge-file');
    const fileInput = document.getElementById('challenge-file');
    const fileDisplay = document.getElementById('challenge-file-name-display');

    if (dragZone && fileInput) {
        dragZone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                fileDisplay.innerText = `已選擇檔案：${e.target.files[0].name}`;
            }
        });
        
        dragZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragZone.style.borderColor = "var(--neon-blue)";
        });
        
        dragZone.addEventListener('dragleave', () => {
            dragZone.style.borderColor = "var(--border-color)";
        });
        
        dragZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dragZone.style.borderColor = "var(--border-color)";
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileDisplay.innerText = `已選擇檔案：${e.dataTransfer.files[0].name}`;
            }
        });
    }

    // 7. Form Submission: Scheme 1 (Challenge Award)
    document.getElementById('form-apply-challenge').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const gpaInput = parseFloat(document.getElementById('challenge-gpa').value);
        if (gpaInput < selectedChallengeTarget) {
            showToast(`輸入平均分數 (${gpaInput}) 未達所挑戰的門檻 (${selectedChallengeTarget})！`, "fa-triangle-exclamation");
            return;
        }

        const formData = new FormData(e.target);
        formData.append('student_name', currentUser.name);
        formData.append('student_birthday', currentUser.birthday);
        formData.append('target', selectedChallengeTarget);
        
        toggleLoading(true, "正在安全加密上傳並登錄防線挑戰...");
        
        fetch('/api/apply/challenge', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            toggleLoading(false);
            if (data.success) {
                closeModal('modal-apply-challenge');
                // Reset form & target selection
                e.target.reset();
                fileDisplay.innerText = '';
                document.querySelectorAll('.shield-item').forEach(s => s.classList.remove('selected'));
                selectedChallengeTarget = null;
                
                // Show congratulations and refresh status
                showToast(data.message, "fa-circle-check");
                refreshUserStatus(currentUser.code);
            } else {
                showToast(data.message, "fa-circle-xmark");
            }
        })
        .catch(err => {
            toggleLoading(false);
            console.error("Submission error:", err);
            showToast("網路傳輸失敗，請稍後重試！", "fa-triangle-exclamation");
        });
    });

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
    document.getElementById('form-apply-progress').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        formData.append('student_name', currentUser.name);
        formData.append('student_birthday', currentUser.birthday);
        
        toggleLoading(true, "正在安全傳輸學期進步獎申請數據...");
        
        fetch('/api/apply/progress', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            toggleLoading(false);
            if (data.success) {
                closeModal('modal-apply-progress');
                e.target.reset();
                showToast(data.message, "fa-circle-check");
            } else {
                showToast(data.message, "fa-circle-xmark");
            }
        })
        .catch(err => {
            toggleLoading(false);
            showToast("網路錯誤，申請送出失敗！", "fa-triangle-exclamation");
        });
    });

    // 10. Open Scheme 3 (Future Blueprint) Modal
    document.getElementById('btn-apply-blueprint-modal').addEventListener('click', () => {
        openModal('modal-apply-blueprint');
    });

    // 11. Form Submission: Scheme 3 (Future Blueprint Project)
    document.getElementById('form-apply-blueprint').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        formData.append('student_name', currentUser.name);
        formData.append('student_birthday', currentUser.birthday);
        
        toggleLoading(true, "圓夢計畫上傳中，正在寫入里程碑追蹤軌跡...");
        
        fetch('/api/apply/blueprint', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            toggleLoading(false);
            if (data.success) {
                closeModal('modal-apply-blueprint');
                e.target.reset();
                showToast(data.message, "fa-circle-check");
            } else {
                showToast(data.message, "fa-circle-xmark");
            }
        })
        .catch(err => {
            toggleLoading(false);
            showToast("網路傳輸失敗，企劃上傳失敗！", "fa-triangle-exclamation");
        });
    });
}

// Handle login/register submit click
function handleLoginSubmit() {
    const nameVal = document.getElementById('login-student-name').value.trim();
    const birthdayVal = document.getElementById('login-student-birthday').value.trim();
    const registerDetails = document.getElementById('group-register-details');
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
    
    errorDiv.style.display = "none";
    
    // Check if we are in registration mode (fields visible)
    if (registerDetails.style.display !== 'none') {
        if (!nicknameVal || !schoolVal || !departmentVal || !gradeVal) {
            errorDiv.innerText = "請填寫所有註冊基本資料 (暱稱、學校、科系、年級)！";
            errorDiv.style.display = "block";
            return;
        }
        
        // Call Register API
        fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: nameVal, 
                birthday: birthdayVal, 
                nickname: nicknameVal,
                school: schoolVal,
                department: departmentVal,
                grade: gradeVal
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Clear registration display
                registerDetails.style.display = 'none';
                document.getElementById('login-student-nickname').value = '';
                document.getElementById('login-student-school').value = '';
                document.getElementById('login-student-department').value = '';
                
                // Trigger auto login
                refreshUserStatus(nameVal, birthdayVal);
                
                // Close login modal
                closeModal('modal-login');
                
                // Open consent modal
                openModal('modal-consent');
                
                // Reset button text
                document.getElementById('btn-submit-login').innerText = "驗證登入";
                
                showToast(data.message, "fa-circle-check");
            } else {
                errorDiv.innerText = data.message;
                errorDiv.style.display = "block";
            }
        })
        .catch(err => {
            errorDiv.innerText = "註冊傳輸失敗，請稍後重試！";
            errorDiv.style.display = "block";
        });
    } else {
        // Standard Login API call
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameVal, birthday: birthdayVal })
        })
        .then(res => res.json())
        .then(data => {
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
                
                // Close login modal
                closeModal('modal-login');
                
                // Open Consent Modal
                openModal('modal-consent');
                
                // Load data to UI
                updateStudentUI();
                showToast(`登入成功！歡迎進入計畫，${data.name}同學。`, "fa-circle-check");
            } else if (data.code === 'NOT_REGISTERED') {
                // Reveal the registration details input fields
                registerDetails.style.display = 'block';
                document.getElementById('login-modal-tip').innerText = data.message;
                document.getElementById('btn-submit-login').innerText = "註冊並驗證登入";
                showToast("首次登入，請填寫基本資料註冊！", "fa-user-plus");
            } else {
                errorDiv.innerText = data.message || "登入驗證失敗！";
                errorDiv.style.display = "block";
            }
        })
        .catch(err => {
            errorDiv.innerText = "登入連線失敗！";
            errorDiv.style.display = "block";
        });
    }
}

// Progress Calculator Logic
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

// Session Logout
function logout() {
    sessionStorage.clear();
    currentUser = {
        name: '',
        birthday: '',
        nickname: '',
        school: '',
        department: '',
        grade: '',
        attempts: 0,
        unlockedChallenges: []
    };
    selectedChallengeTarget = null;
    
    document.getElementById('student-status-bar').style.display = 'none';
    document.getElementById('program-tabs').style.display = 'none';
    
    // Restore all cards display
    document.getElementById('card-challenge').style.display = 'block';
    document.getElementById('card-progress').style.display = 'block';
    document.getElementById('card-blueprint').style.display = 'block';

    document.getElementById('challenge-name').value = '';
    document.getElementById('progress-name').value = '';
    document.getElementById('blueprint-name').value = '';
    
    // Reset login modal inputs
    document.getElementById('login-student-name').value = '';
    document.getElementById('login-student-birthday').value = '';
    document.getElementById('login-student-nickname').value = '';
    document.getElementById('login-student-school').value = '';
    document.getElementById('login-student-department').value = '';
    document.getElementById('group-register-details').style.display = 'none';
    document.getElementById('login-modal-tip').innerText = "請輸入您的真實姓名與生日作為登入身分識別。首次登入者將會提示填寫基本資料完成計畫註冊。";
    document.getElementById('login-error-msg').style.display = 'none';
    document.getElementById('btn-submit-login').innerText = "驗證登入";
    
    // Clear checkmarks from shields
    document.querySelectorAll('.shield-item').forEach(s => {
        s.classList.remove('unlocked', 'selected');
        const lockIcon = s.querySelector('.unlocked-icon');
        if (lockIcon) lockIcon.className = "fa-solid fa-lock-open unlocked-icon";
    });
    
    // Reset ladder steps
    document.querySelectorAll('.ladder-step').forEach(step => {
        step.classList.remove('cleared', 'active-step');
        const arrow = step.querySelector('.current-arrow');
        if (arrow) arrow.remove();
        // Set lvl 1 active again as default placeholder visual
        if (step.getAttribute('data-level') === '1') {
            step.classList.add('active-step');
            const detailSpan = step.querySelector('.level-detail');
            const arrowIcon = document.createElement('i');
            arrowIcon.className = "fa-solid fa-circle-chevron-right current-arrow";
            step.appendChild(arrowIcon);
        }
    });

    openModal('modal-login');
    showToast("已成功登出計畫身分！", "fa-right-from-bracket");
}

// Modal Helpers
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('show');
        // Reset scroll position
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
        // Set content
        toastText.innerText = text;
        toastIcon.className = `fa-solid ${iconClass} toast-icon`;
        
        // Show
        toast.classList.add('show');
        
        // Clear previous timer
        if (toastTimer) clearTimeout(toastTimer);
        
        // Auto hide after 4 seconds
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

// Math Min helper for arrays
function min(a, b) {
    return a < b ? a : b;
}

// Switch scheme tabs
function switchTab(tabName) {
    // 1. Update active class on tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Show/hide the cards
    const cardChallenge = document.getElementById('card-challenge');
    const cardProgress = document.getElementById('card-progress');
    const cardBlueprint = document.getElementById('card-blueprint');

    if (cardChallenge) cardChallenge.style.display = tabName === 'challenge' ? 'block' : 'none';
    if (cardProgress) cardProgress.style.display = tabName === 'progress' ? 'block' : 'none';
    if (cardBlueprint) cardBlueprint.style.display = tabName === 'blueprint' ? 'block' : 'none';
    
    // Save active tab preference in session
    sessionStorage.setItem('guge_active_tab', tabName);
}
