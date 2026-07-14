











/* ==========================================================================



   【古哥挑戰獎學金】後台審查系統 - 互動邏輯 (Apps Script Admin JS)



   ========================================================================== */







let ADMIN_TOKEN = null;



let currentFilter = 'pending'; // Default tab



let currentCases = [];



let selectedCase = null;







document.addEventListener("DOMContentLoaded", () => {



    // Bind buttons



    document.getElementById('btn-approve-case').addEventListener('click', approveCase);



    document.getElementById('btn-reject-case').addEventListener('click', rejectCase);



    document.getElementById('btn-destroy-case').addEventListener('click', destroyPIICase);



    



    // Bind settings



    document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
    
    const btnPromote = document.getElementById('btn-promote-grades');
    if (btnPromote) {
        btnPromote.addEventListener('click', handlePromoteGrades);
    }

    document.getElementById('form-settings').addEventListener('submit', saveSettings);



    



    // Bind logout



    document.getElementById('btn-admin-logout').addEventListener('click', logoutAdmin);

    // Bind Scheme 3 (Future Blueprint) review buttons
    document.getElementById('btn-bp-approve-proposal').addEventListener('click', () => {
        const amt = document.getElementById('bp-approved-amount-input').value.trim();
        const midtermDl = document.getElementById('bp-midterm-deadline-input').value;
        const finalDl = document.getElementById('bp-final-deadline-input').value;
        
        if (!amt || isNaN(amt) || parseFloat(amt) <= 0) {
            showToast("請輸入核定的專案總金額！", "fa-triangle-exclamation");
            return;
        }
        if (!midtermDl || !finalDl) {
            showToast("請選擇期中與期末的報告繳交截止日！", "fa-triangle-exclamation");
            return;
        }
        
        if (confirm(`確定核准此未來藍圖計畫？\n核定金額：NT$ ${parseFloat(amt).toLocaleString()} 元\n期中截止日：${midtermDl}\n期末截止日：${finalDl}`)) {
            toggleLoading(true, "核准未來藍圖提案中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，核准提案失敗！", "fa-triangle-exclamation");
                })
                .adminApproveBlueprint(ADMIN_TOKEN, selectedCase.id, amt, midtermDl, finalDl);
        }
    });

    document.getElementById('btn-bp-reject-proposal').addEventListener('click', () => {
        if (confirm("確定退回此未來藍圖計畫提案？")) {
            toggleLoading(true, "退回提案中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，退回失敗！", "fa-triangle-exclamation");
                })
                .adminRejectCase(ADMIN_TOKEN, selectedCase.id);
        }
    });

    document.getElementById('btn-bp-approve-midterm').addEventListener('click', () => {
        if (confirm("確定核准該期中報告？核准後將開放中期款 (40%) 撥發。")) {
            toggleLoading(true, "審定通過期中報告中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，審定失敗！", "fa-triangle-exclamation");
                })
                .adminReviewMidterm(ADMIN_TOKEN, selectedCase.id, true);
        }
    });

    document.getElementById('btn-bp-reject-midterm').addEventListener('click', () => {
        if (confirm("確定退回該期中報告並請學生修正重傳？")) {
            toggleLoading(true, "退回期中報告中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，操作失敗！", "fa-triangle-exclamation");
                })
                .adminReviewMidterm(ADMIN_TOKEN, selectedCase.id, false);
        }
    });

    document.getElementById('btn-bp-approve-final').addEventListener('click', () => {
        if (confirm("確定核准該期末報告？核准後將開放期末款 (30%) 撥發並進入結案。")) {
            toggleLoading(true, "審定通過期末報告中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，審定失敗！", "fa-triangle-exclamation");
                })
                .adminReviewFinal(ADMIN_TOKEN, selectedCase.id, true);
        }
    });

    document.getElementById('btn-bp-reject-final').addEventListener('click', () => {
        if (confirm("確定退回該期末報告並請學生修正重傳？")) {
            toggleLoading(true, "退回期末報告中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，操作失敗！", "fa-triangle-exclamation");
                })
                .adminReviewFinal(ADMIN_TOKEN, selectedCase.id, false);
        }
    });

    document.getElementById('btn-bp-update-settings').addEventListener('click', () => {
        const amt = document.getElementById('bp-approved-amount-input').value.trim();
        const midtermDl = document.getElementById('bp-midterm-deadline-input').value;
        const finalDl = document.getElementById('bp-final-deadline-input').value;
        
        if (!amt || isNaN(amt) || parseFloat(amt) <= 0) {
            showToast("請輸入核定的專案總金額！", "fa-triangle-exclamation");
            return;
        }
        if (!midtermDl || !finalDl) {
            showToast("請選擇期中與期末的報告繳交截止日！", "fa-triangle-exclamation");
            return;
        }
        
        if (confirm(`確定更新此未來藍圖計畫的金額與截止日？\n\n更新後核定總金額將改為：NT$ ${parseFloat(amt).toLocaleString()} 元\n期中截止日：${midtermDl}\n期末截止日：${finalDl}`)) {
            toggleLoading(true, "更新未來藍圖設定中...");
            google.script.run
                .withSuccessHandler(function(res) {
                    toggleLoading(false);
                    showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                    if (res.success) {
                        loadCaseList();
                        document.getElementById('auditor-pane').style.display = 'none';
                    }
                })
                .withFailureHandler(function(err) {
                    toggleLoading(false);
                    showToast("網路錯誤，更新設定失敗！", "fa-triangle-exclamation");
                })
                .adminUpdateBlueprintSettings(ADMIN_TOKEN, selectedCase.id, amt, midtermDl, finalDl);
        }
    });



    



    // Bind CSV Export



    document.getElementById('btn-export-csv').addEventListener('click', (e) => {



        e.preventDefault();



        exportApprovedCases();



    });







    // Bind Tab Click events
    const tabPending = document.getElementById('tab-pending');
    const tabApproved = document.getElementById('tab-approved');
    const tabDestroyed = document.getElementById('tab-destroyed');
    const tabBlueprint = document.getElementById('tab-blueprint');
    const tabTotal = document.getElementById('tab-total');
    
    if (tabPending) tabPending.addEventListener('click', () => switchTab('pending'));
    if (tabApproved) tabApproved.addEventListener('click', () => switchTab('approved'));
    if (tabDestroyed) tabDestroyed.addEventListener('click', () => switchTab('destroyed'));
    if (tabBlueprint) tabBlueprint.addEventListener('click', () => switchTab('blueprint'));
    if (tabTotal) tabTotal.addEventListener('click', () => switchTab('all'));



    



    // Bind Login Form



    const loginForm = document.getElementById('admin-login-form');



    if (loginForm) {



        loginForm.addEventListener('submit', handleAdminLogin);



    }



    



    // Perform initial session verification
    verifySessionOnLoad();
    
    // Spawn background images from Google Drive settings
    spawnRandomPic();
});







// Verify if session exists in sessionStorage



function verifySessionOnLoad() {



    const cachedToken = sessionStorage.getItem('admin_token');



    const overlay = document.getElementById('admin-login-overlay');



    



    if (cachedToken) {



        showToast("正在驗證管理登入狀態...", "fa-circle-notch");



        google.script.run



            .withSuccessHandler(function(response) {



                if (response.success) {



                    ADMIN_TOKEN = cachedToken;



                    if (overlay) overlay.style.display = 'none';



                    showToast("身分驗證成功，已載入控制台！", "fa-circle-check");



                    loadCaseList();



                } else {



                    sessionStorage.removeItem('admin_token');



                    if (overlay) overlay.style.display = 'flex';



                    showToast("登入已過期，請重新驗證！", "fa-triangle-exclamation");



                }



            })



            .withFailureHandler(function(err) {



                sessionStorage.removeItem('admin_token');



                if (overlay) overlay.style.display = 'flex';



                showToast("連線伺服器失敗，請重新登入！", "fa-triangle-exclamation");



            })



            .clientVerifyAdminToken(cachedToken);



    } else {



        if (overlay) overlay.style.display = 'flex';



    }



}







// Handle Admin Login submission



function handleAdminLogin(e) {



    e.preventDefault();



    const password = document.getElementById('admin-password').value;



    const errorDiv = document.getElementById('login-error');



    const overlay = document.getElementById('admin-login-overlay');



    



    if (errorDiv) errorDiv.style.display = 'none';



    showToast("密碼驗證中，請稍候...", "fa-circle-notch");



    



    google.script.run



        .withSuccessHandler(function(response) {



            if (response.success && response.token) {



                ADMIN_TOKEN = response.token;



                sessionStorage.setItem('admin_token', response.token);



                showToast("驗證成功！正在載入後台控制面板...", "fa-circle-check");



                



                if (overlay) overlay.style.display = 'none';



                document.getElementById('admin-password').value = '';



                



                loadCaseList();



            } else {



                if (errorDiv) {



                    errorDiv.innerText = response.message || "驗證密碼錯誤，拒絕登入後台！";



                    errorDiv.style.display = 'block';



                }



                showToast("登入失敗，請確認密碼！", "fa-triangle-exclamation");



            }



        })



        .withFailureHandler(function(err) {



            if (errorDiv) {



                errorDiv.innerText = "伺服器無回應，連線失敗！";



                errorDiv.style.display = 'block';



            }



            showToast("驗證通訊失敗！", "fa-triangle-exclamation");



        })



        .adminLogin(password);



}







// Load applications list



function loadCaseList() {



    if (!ADMIN_TOKEN) return;



    google.script.run



        .withSuccessHandler(function(data) {



            currentCases = data;



            updateStats();



            switchTab(currentFilter); // Automatically apply active tab filter and highlight



        })



        .withFailureHandler(function(err) {



            showToast("讀取案件名冊失敗，請重試！", "fa-triangle-exclamation");



        })



        .adminGetList(ADMIN_TOKEN);



}







// Render list rows in table



function renderCaseList() {



    const tbody = document.getElementById('case-list-tbody');



    tbody.innerHTML = '';



    



    let filteredCases = currentCases;

    if (currentFilter === 'pending') {
        filteredCases = currentCases.filter(c => c.status === 'pending' && c.type !== 'blueprint');
    } else if (currentFilter === 'approved') {
        filteredCases = currentCases.filter(c => c.status === 'approved' && c.type !== 'blueprint');
    } else if (currentFilter === 'destroyed') {
        filteredCases = currentCases.filter(c => {
            if (c.type === 'blueprint') {
                return getPaidAmount(c) > 0;
            }
            return c.status === 'destroyed';
        });
    } else if (currentFilter === 'blueprint') {
        filteredCases = currentCases.filter(c => c.type === 'blueprint');
    }



    



    if (filteredCases.length === 0) {



        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted); font-size: 0.95rem;">\n\n\n\n            <i class="fa-solid fa-folder-open" style="font-size: 2.2rem; margin-bottom: 10px; display: block;"></i>\n\n\n\n            目前尚無符合該篩選狀態的申請案件。\n\n\n\n        </td></tr>';



        return;



    }



    



    filteredCases.forEach(c => {



        const tr = document.createElement('tr');



        tr.className = 'case-row ' + (selectedCase && selectedCase.id === c.id ? 'active-row' : '');



        tr.addEventListener('click', () => selectCase(c));



        



        // Translate type



        let typeText = '成績挑戰';



        if (c.type === 'progress') typeText = '學期進步';



        if (c.type === 'blueprint') typeText = '未來藍圖';







        // Target text



        let targetText = '--';



        if (c.type === 'challenge') targetText = c.challenge_target ? (parseFloat(c.challenge_target).toFixed(2)) + ' 分' : '--';



        if (c.type === 'progress') {



            const diffVal = parseFloat(c.curr_gpa || 0) - parseFloat(c.prev_gpa || 0);



            targetText = '+' + (diffVal.toFixed(2)) + ' 分';



        }



        if (c.type === 'blueprint') {



            const pName = c.project_name || '';



            targetText = pName.length > 10 ? pName.substring(0, 10) + '...' : pName;



        }



        



        // Format status badge
        let statusBadge = '<span class="badge pending">待審核</span>';
        if (c.status === 'approved') statusBadge = '<span class="badge approved">已核准</span>';
        if (c.status === 'rejected') statusBadge = '<span class="badge rejected">已拒絕</span>';
        if (c.status === 'destroyed') statusBadge = '<span class="badge destroyed">已銷毀結案</span>';
        
        // Blueprint state status badge
        if (c.type === 'blueprint') {
            if (c.status === 'pending') {
                statusBadge = '<span class="badge pending">提案待審核</span>';
            } else if (c.status === 'approved') {
                const phase = c.phase || 1;
                if (phase === 1) {
                    statusBadge = '<span class="badge approved" style="background: rgba(245,158,11,0.2); color: #f59e0b; border-color: #f59e0b;">首款待撥付</span>';
                } else if (phase === 2) {
                    if (c.midterm_status === 'pending') {
                        statusBadge = '<span class="badge pending">期中待審查</span>';
                    } else if (c.midterm_status === 'rejected') {
                        statusBadge = '<span class="badge rejected">期中已退回</span>';
                    } else {
                        statusBadge = '<span class="badge approved" style="background: rgba(59,130,246,0.2); color: #3b82f6; border-color: #3b82f6;">期中執行中</span>';
                    }
                } else if (phase === 3) {
                    if (c.final_status === 'pending') {
                        statusBadge = '<span class="badge pending">期末待審查</span>';
                    } else if (c.final_status === 'rejected') {
                        statusBadge = '<span class="badge rejected">期末已退回</span>';
                    } else {
                        statusBadge = '<span class="badge approved" style="background: rgba(16,185,129,0.2); color: #10b981; border-color: #10b981;">期末執行中</span>';
                    }
                } else if (phase === 4) {
                    statusBadge = '<span class="badge approved" style="background: rgba(16,185,129,0.2); color: #10b981; border-color: #10b981;">已完成/待結案</span>';
                }
            } else if (c.status === 'destroyed') {
                statusBadge = '<span class="badge destroyed">已結案銷毀</span>';
            }
        }
        
        // Show correct amount: overall approved for blueprint tab, paid amount for destroyed tab
        let showAmt = c.amount || 0;
        if (c.type === 'blueprint') {
            if (currentFilter === 'blueprint' || currentFilter === 'all') {
                showAmt = c.approved_amount || c.amount || 0;
            } else {
                showAmt = getPaidAmount(c);
            }
        }

        tr.innerHTML = `
            <td>${c.created_at}</td>
            <td class="font-tech" style="font-size: 0.85rem;">${c.school || ''} ${c.department || ''} (${c.grade || ''})</td>
            <td>${c.name || '已銷毀'}</td>
            <td><span style="color: var(--neon-blue); font-weight: bold; font-family: monospace;">${c.academic_year || '--'}</span></td>
            <td>${typeText}</td>
            <td>${targetText}</td>
            <td class="font-tech text-gold font-bold">NT$ ${parseInt(showAmt).toLocaleString()}</td>
            <td>${statusBadge}</td>
        `;
        


        



        tbody.appendChild(tr);



    });



}







// Select a row to display details in split pane



// Select a row to display details in split pane



function selectCase(c) {



    selectedCase = c;



    renderCaseList(); // Refresh row highlighting



    



    // Reveal Split Pane
    document.getElementById('auditor-pane').style.display = 'block';
    
    // Toggle full-width mode for blueprint圓夢專案
    const splitContainer = document.getElementById('auditor-split-container');
    const paneIcon = document.getElementById('auditor-pane-icon');
    const paneTitle = document.getElementById('auditor-pane-title');
    const auditDocPane = document.querySelector('.audit-document');
    const auditDetailsPane = document.querySelector('.audit-details');
    
    if (c.type === 'blueprint') {
        if (splitContainer) {
            splitContainer.classList.add('blueprint-mode');
            splitContainer.style.gridTemplateColumns = '1fr';
        }
        if (auditDocPane) {
            auditDocPane.style.setProperty('display', 'none', 'important');
        }
        if (auditDetailsPane) {
            auditDetailsPane.style.borderRight = 'none';
        }
        if (paneIcon) {
            paneIcon.className = 'fa-solid fa-diagram-project';
        }
        if (paneTitle) {
            paneTitle.innerText = '未來藍圖計畫圓夢專案審定';
        }
    } else {
        if (splitContainer) {
            splitContainer.classList.remove('blueprint-mode');
            splitContainer.style.gridTemplateColumns = '';
        }
        if (auditDocPane) {
            auditDocPane.style.display = '';
        }
        if (auditDetailsPane) {
            auditDetailsPane.style.borderRight = '';
        }
        if (paneIcon) {
            paneIcon.className = 'fa-solid fa-magnifying-glass-chart';
        }
        if (paneTitle) {
            paneTitle.innerText = '雙螢幕審對視窗';
        }
    }



    



    // Fill left pane text details



    document.getElementById('audit-case-id').innerText = c.id;



    document.getElementById('audit-name').innerText = c.name || '已銷毀';



    document.getElementById('audit-grade').innerText = c.grade || '--';



    document.getElementById('audit-school-dept').innerText = (c.school || '--') + ' ' + (c.department || '--');



    document.getElementById('audit-bank-code').innerText = c.bank_code || '--';



    document.getElementById('audit-bank-account').innerText = c.bank_account || '--';



    document.getElementById('audit-amount').innerText = 'NT$ ' + ((c.amount || 0).toLocaleString());



    



    // Translate type



    let typeLabel = "成績挑戰";



    if (c.type === 'progress') typeLabel = "學期進步獎";



    if (c.type === 'blueprint') typeLabel = "未來藍圖計畫";



    document.getElementById('audit-type').innerText = typeLabel;



    



    // Toggle details by type



    const prevGpaGroup = document.getElementById('group-prev-gpa');



    const gpaGroup = document.getElementById('group-gpa');



    const targetGroup = document.getElementById('group-target');



    const projectGroup = document.getElementById('group-project');



    const gpaLabel = document.getElementById('label-gpa');



    



    if (c.type === 'challenge') {



        prevGpaGroup.style.display = 'none';



        gpaGroup.style.display = 'block';



        targetGroup.style.display = 'block';



        projectGroup.style.display = 'none';



        gpaLabel.innerText = "當學期平均";



        



        document.getElementById('audit-gpa').innerText = c.gpa ? (parseFloat(c.gpa).toFixed(2)) + ' 分' : '--';



        document.getElementById('audit-target').innerText = c.challenge_target ? (parseFloat(c.challenge_target).toFixed(2)) + ' 分' : '--';



    } else if (c.type === 'progress') {



        prevGpaGroup.style.display = 'block';



        gpaGroup.style.display = 'block';



        targetGroup.style.display = 'none';



        projectGroup.style.display = 'none';



        gpaLabel.innerText = "本學期平均";



        



        document.getElementById('audit-prev-gpa').innerText = c.prev_gpa ? (parseFloat(c.prev_gpa).toFixed(2)) + ' 分' : '--';



        document.getElementById('audit-gpa').innerText = c.curr_gpa ? (parseFloat(c.curr_gpa).toFixed(2)) + ' 分' : '--';



    } else if (c.type === 'blueprint') {



        prevGpaGroup.style.display = 'none';



        gpaGroup.style.display = 'none';



        targetGroup.style.display = 'none';



        projectGroup.style.display = 'block';



        



        document.getElementById('audit-project-name').innerText = c.project_name || '--';



        document.getElementById('audit-project-month').innerText = c.project_month || '--';



    }



    



        // Handle File Preview (Right Pane) - on-demand metadata loading and PDF/Image rendering

    renderFilePreview(c);

    

// Show control buttons based on status



    const pendingActions = document.getElementById('actions-pending-group');



    const approvedActions = document.getElementById('actions-approved-group');



    const destroyedBanner = document.getElementById('actions-destroyed-banner');



    



    pendingActions.style.display = 'none';



    approvedActions.style.display = 'none';



    destroyedBanner.style.display = 'none';



    



    if (c.status === 'pending') {



        pendingActions.style.display = 'flex';



    } else if (c.status === 'approved') {



        approvedActions.style.display = 'block';



    } else if (c.status === 'destroyed') {



        destroyedBanner.style.display = 'block';



    }
    
    // Handle specialized Blueprint Audit and Milestones panel
    renderBlueprintAudit(c);
}







function getPaidAmount(c) {
    if (c.type !== 'blueprint') {
        return c.status === 'destroyed' ? (c.amount || 0) : 0;
    }
    const approvedAmt = parseFloat(c.approved_amount || "0");
    let paid = 0;
    if (c.phase_1_status === 'paid') paid += Math.round(approvedAmt * 0.3);
    if (c.midterm_status === 'paid') paid += Math.round(approvedAmt * 0.4);
    if (c.final_status === 'paid') paid += Math.round(approvedAmt * 0.3);
    return paid;
}

function updateStats() {
    let pendingCount = 0;
    let approvedCount = 0;
    let destroyedCount = 0;
    let blueprintCount = 0;
    let totalPayout = 0;
    
    currentCases.forEach(c => {
        if (c.type === 'blueprint') {
            blueprintCount++;
            const paidAmt = getPaidAmount(c);
            if (paidAmt > 0) {
                destroyedCount++;
            }
            totalPayout += paidAmt;
        } else {
            if (c.status === 'pending') pendingCount++;
            else if (c.status === 'approved') approvedCount++;
            else if (c.status === 'destroyed') destroyedCount++;
            
            if (c.status === 'approved' || c.status === 'destroyed') {
                totalPayout += c.amount;
            }
        }
    });
    
    document.getElementById('stat-pending').innerText = pendingCount;
    document.getElementById('stat-approved').innerText = approvedCount;
    document.getElementById('stat-destroyed').innerText = destroyedCount;
    const statBp = document.getElementById('stat-blueprint');
    if (statBp) statBp.innerText = blueprintCount;
    document.getElementById('stat-total-amount').innerText = 'NT$ ' + (totalPayout.toLocaleString());
}







// Action: Approve



function approveCase() {



    if (!selectedCase) return;



    if (confirm('確定要「核准」學生 ' + (selectedCase.name) + ' 的這筆獎學金申請嗎？\n\n\n\n核准金額：NT$ ' + (selectedCase.amount.toLocaleString()) + ' 元')) {



        google.script.run



            .withSuccessHandler(function(data) {



                if (data.success) {



                    showToast(data.message, "fa-circle-check");



                    loadCaseList();



                    // Keep selection updated



                    setTimeout(() => {



                        const updated = currentCases.find(x => x.id === selectedCase.id);



                        if (updated) selectCase(updated);



                    }, 500);



                } else {



                    showToast(data.message, "fa-triangle-exclamation");



                }



            })



            .adminApproveCase(ADMIN_TOKEN, selectedCase.id);



    }



}







// Action: Reject



function rejectCase() {



    if (!selectedCase) return;



    if (confirm('確定要「拒絕」這筆申請案件嗎？')) {



        google.script.run



            .withSuccessHandler(function(data) {



                if (data.success) {



                    showToast(data.message, "fa-circle-xmark");



                    loadCaseList();



                    setTimeout(() => {



                        const updated = currentCases.find(x => x.id === selectedCase.id);



                        if (updated) selectCase(updated);



                    }, 500);



                } else {



                    showToast(data.message, "fa-triangle-exclamation");



                }



            })



            .adminRejectCase(ADMIN_TOKEN, selectedCase.id);



    }



}







// Action: Destroy PII (結案物理銷毀個資)



function destroyPIICase() {



    if (!selectedCase) return;



    const msg = '【🚨 警告：個資銷毀安全機制】\n\n\n\n\n\n\n\n確定此筆案件已撥款，並執行「一鍵物理銷毀」？\n\n\n\n此動作將進行以下作業：\n\n\n\n1. 刪除該學生的成績單/企劃書圖檔\n\n\n\n2. 抹除資料庫中該筆申請的戶名與收款銀行帳號\n\n\n\n3. 姓名去識別化遮罩 (例如 ' + (selectedCase.name) + ' -> 遮罩處理)\n\n\n\n\n\n\n\n※ 此物理刪除動作永久無法撤回！※';



    



    if (confirm(msg)) {



        google.script.run



            .withSuccessHandler(function(data) {



                if (data.success) {



                    showToast(data.message, "fa-dumpster-fire");



                    



                    loadCaseList();



                    setTimeout(() => {



                        const updated = currentCases.find(x => x.id === selectedCase.id);



                        if (updated) selectCase(updated);



                    }, 500);



                } else {



                    showToast(data.message, "fa-triangle-exclamation");



                }



            })



            .adminDestroyCase(ADMIN_TOKEN, selectedCase.id);



    }



}







// Action: Client-side CSV download trigger



function exportApprovedCases() {



    showToast("正在產生網銀撥款清冊...", "fa-file-excel");



    google.script.run



        .withSuccessHandler(function(csvContent) {



            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });



            const link = document.createElement("a");



            const url = URL.createObjectURL(blob);



            link.setAttribute("href", url);



            link.setAttribute("download", 'guge_scholarship_export_' + (new Date().toISOString().slice(0,10).replace(/-/g,"")) + '.csv');



            link.style.visibility = 'hidden';



            document.body.appendChild(link);



            link.click();



            document.body.removeChild(link);



            showToast("已成功匯出網銀撥款 CSV 檔案！", "fa-circle-check");



        })



        .withFailureHandler(function(err) {



            showToast("匯出失敗，請重試！", "fa-triangle-exclamation");



        })



        .adminExportApproved(ADMIN_TOKEN);



}







// Modal open/close helpers



function openModal(id) {



    const m = document.getElementById(id);



    if (m) m.classList.add('show');



}







function closeModal(id) {



    const m = document.getElementById(id);



    if (m) m.classList.remove('show');



}







// Open settings parameters modal
function openSettingsModal() {
    showToast("獲取最新參數設定中...", "fa-arrows-spin");
    google.script.run
        .withSuccessHandler(function(data) {
            document.getElementById('settings-progress-base').value = data.progress_base;
            document.getElementById('settings-progress-rate').value = data.progress_conversion_rate;
            document.getElementById('settings-blueprint').value = data.blueprint_amount;
            
            // Fill challenge level inputs
            if (data.challenge_amounts) {
                for (let i = 0; i < 8; i++) {
                    const inp = document.getElementById('settings-challenge-' + (i+1));
                    if (inp) {
                        inp.value = data.challenge_amounts[i] !== undefined ? data.challenge_amounts[i] : '';
                    }
                }
            }
            
            // 載入底圖分類資料夾選單
            const bgSelect = document.getElementById('settings-bg-folder');
            if (bgSelect) {
                bgSelect.innerHTML = '<option value="">⏳ 載入分類清單中...</option>';
                google.script.run
                    .withSuccessHandler(function(bgData) {
                        bgSelect.innerHTML = '';
                        if (bgData.success && bgData.albums) {
                            bgData.albums.forEach(album => {
                                const opt = document.createElement('option');
                                opt.value = album.id;
                                opt.textContent = album.name;
                                if (album.id === data.active_bg_folder_id) {
                                    opt.selected = true;
                                }
                                bgSelect.appendChild(opt);
                            });
                        } else {
                            bgSelect.innerHTML = '<option value="">❌ 無法載入雲端分類</option>';
                        }
                    })
                    .withFailureHandler(function(err) {
                        bgSelect.innerHTML = '<option value="">❌ 載入失敗</option>';
                    })
                    .getAlbumList();
            }
            
            openModal('modal-settings');
        })
        .withFailureHandler(function(err) {
            showToast("載入設定參數失敗！", "fa-triangle-exclamation");
        })
        .adminGetSettings(ADMIN_TOKEN);
}







// Save settings parameters
function saveSettings(e) {
    e.preventDefault();
    
    const challengeAmounts = [];
    for (let i = 0; i < 8; i++) {
        const val = parseInt(document.getElementById('settings-challenge-' + (i+1)).value);
        if (isNaN(val)) {
            showToast("所有挑戰級距獎金均為必填！", "fa-triangle-exclamation");
            return;
        }
        challengeAmounts.push(val);
    }
    
    const payload = {
        progress_base: parseInt(document.getElementById('settings-progress-base').value),
        progress_conversion_rate: parseInt(document.getElementById('settings-progress-rate').value),
        blueprint_amount: parseInt(document.getElementById('settings-blueprint').value),
        challenge_amounts: challengeAmounts,
        active_bg_folder_id: document.getElementById('settings-bg-folder').value
    };
    
    showToast("儲存設定中...", "fa-gears");
    
    google.script.run
        .withSuccessHandler(function(data) {
            if (data.success) {
                closeModal('modal-settings');
                showToast(data.message, "fa-circle-check");
                loadCaseList();
                // 儲存成功後，若有更新底圖設定，立即重新載入底圖
                if (typeof spawnRandomPic === 'function') {
                    spawnRandomPic();
                }
            } else {
                showToast(data.message, "fa-triangle-exclamation");
            }
        })
        .withFailureHandler(function(err) {
            showToast("伺服器錯誤，儲存設定失敗！", "fa-triangle-exclamation");
        })
        .adminSaveSettings(ADMIN_TOKEN, payload);
}







// Session logout



function logoutAdmin() {



    if (confirm("確定要登出管理後台嗎？")) {



        const overlay = document.getElementById('admin-login-overlay');



        const tokenToClear = ADMIN_TOKEN;



        



        // Instant client-side logout



        ADMIN_TOKEN = null;



        sessionStorage.removeItem('admin_token');



        if (overlay) {



            overlay.style.display = 'flex';



            document.getElementById('admin-password').value = '';



        }



        showToast("已成功登出管理端！", "fa-right-from-bracket");



        



        // Notify server in background



        if (tokenToClear) {



            google.script.run.adminLogout(tokenToClear);



        }



    }



}







// Switch current filter tab



function switchTab(filter) {



    currentFilter = filter;



    



    // Remove active-tab class from all tabs



    document.querySelectorAll('.stat-card').forEach(card => {



        card.classList.remove('active-tab');



    });



    



    // Add active-tab to selected tab
    if (filter === 'pending') {
        const tab = document.getElementById('tab-pending');
        if (tab) tab.classList.add('active-tab');
    } else if (filter === 'approved') {
        const tab = document.getElementById('tab-approved');
        if (tab) tab.classList.add('active-tab');
    } else if (filter === 'destroyed') {
        const tab = document.getElementById('tab-destroyed');
        if (tab) tab.classList.add('active-tab');
    } else if (filter === 'blueprint') {
        const tab = document.getElementById('tab-blueprint');
        if (tab) tab.classList.add('active-tab');
    } else if (filter === 'all') {
        const tab = document.getElementById('tab-total');
        if (tab) tab.classList.add('active-tab');
    }



    



    // Render case table rows



    renderCaseList();



    



    // Close auditor pane upon tab switching to avoid displaying obsolete cases



    const auditor = document.getElementById('auditor-pane');



    if (auditor) auditor.style.display = 'none';



    selectedCase = null;



}







// Toast helper



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

















// Convert Google Drive sharing link into embed/preview links to bypass CORS / iframe blocks

function getGoogleDriveEmbedUrl(url, type) {

    if (!url) return '';

    

    // Extract File ID from drive sharing URL

    let fileId = '';

    const regId = /id=([^&]+)/;

    const regPath = /\/file\/d\/([^\/]+)/;

    

    let match = url.match(regId);

    if (match) {

        fileId = match[1];

    } else {

        match = url.match(regPath);

        if (match) {

            fileId = match[1];

        }

    }

    

    if (!fileId) return url; // Fallback

    

    if (type === 'pdf') {

        // Embed PDF inside iframe using Google Drive PDF preview mode

        return 'https://drive.google.com/file/d/' + fileId + '/preview';

    } else {

        // Render image thumbnail directly

        return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';

    }
}


// Render file preview in the right pane, querying metadata on-demand if it's a Drive URL and not yet fetched
function renderFilePreview(c) {
    if (c.type === 'blueprint') {
        return; // Skip document preview generation entirely for Blueprint full-width mode
    }
    const docViewer = document.getElementById('document-viewer');
    if (!docViewer) return;

    if (c.status === 'destroyed') {
        docViewer.innerHTML = '\n            <div style="padding: 60px 20px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px dashed var(--border-color);">\n                <i class="fa-solid fa-shield-halved" style="font-size: 3.5rem; color: var(--neon-blue); margin-bottom: 15px; display: block;"></i>\n                <p style="font-weight: bold; margin-bottom: 5px;">🔒 個資與證明文件已物理銷毀</p>\n                <small>依照隱私切結安全承諾，本案已完成匯款。成績單與個資已徹底刪除，不可復原。</small>\n            </div>\n        ';
        return;
    }

    if (!c.file_path) {
        docViewer.innerHTML = '\n            <div style="padding: 60px 20px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.1); border-radius: 8px; border: 1px dashed var(--border-color);">\n                <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 10px; display: block;"></i>\n                未上傳任何證明文件。\n            </div>\n        ';
        return;
    }

    // Determine if we need to fetch metadata for file_path
    const isDriveUrl = c.file_path.includes('drive.google.com') || c.file_path.includes('docs.google.com');
    
    // Check if we need to fetch metadata for file1 (file_path)
    if (isDriveUrl && c._mimeType === undefined) {
        docViewer.innerHTML = '\n            <div style="padding: 80px 20px; text-align: center; color: var(--text-muted);">\n                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--neon-blue); margin-bottom: 15px; display: block;"></i>\n                <p style="font-weight: bold; margin-bottom: 5px;">雲端安全驗證中...</p>\n                <small>正在自 Google Drive 取得證明文件資訊...</small>\n            </div>\n        ';
        
        google.script.run
            .withSuccessHandler(function(data) {
                if (data && data.success) {
                    c._mimeType = data.mimeType || '';
                    c._fileName = data.name || '';
                } else {
                    c._mimeType = '';
                    c._fileName = '';
                }
                // Check if we also need to fetch for file2 (prev_file_path) for progress scheme
                if (c.prev_file_path && (c.prev_file_path.includes('drive.google.com') || c.prev_file_path.includes('docs.google.com')) && c._prevMimeType === undefined) {
                    google.script.run
                        .withSuccessHandler(function(data2) {
                            if (data2 && data2.success) {
                                c._prevMimeType = data2.mimeType || '';
                                c._prevFileName = data2.name || '';
                            } else {
                                c._prevMimeType = '';
                                c._prevFileName = '';
                            }
                            renderFilePreview(c); // Render with both metadata resolved
                        })
                        .withFailureHandler(function() {
                            c._prevMimeType = '';
                            renderFilePreview(c);
                        })
                        .adminGetFileMetadata(ADMIN_TOKEN, c.prev_file_path);
                } else {
                    renderFilePreview(c); // Render with file1 resolved
                }
            })
            .withFailureHandler(function() {
                c._mimeType = '';
                renderFilePreview(c);
            })
            .adminGetFileMetadata(ADMIN_TOKEN, c.file_path);
        return;
    }

    // Check if we have file2 but it's not yet fetched
    if (c.prev_file_path && (c.prev_file_path.includes('drive.google.com') || c.prev_file_path.includes('docs.google.com')) && c._prevMimeType === undefined) {
        docViewer.innerHTML = '\n            <div style="padding: 80px 20px; text-align: center; color: var(--text-muted);">\n                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: var(--neon-blue); margin-bottom: 15px; display: block;"></i>\n                <p style="font-weight: bold; margin-bottom: 5px;">載入第二證明文件...</p>\n            </div>\n        ';
        google.script.run
            .withSuccessHandler(function(data2) {
                if (data2 && data2.success) {
                    c._prevMimeType = data2.mimeType || '';
                    c._prevFileName = data2.name || '';
                } else {
                    c._prevMimeType = '';
                    c._prevFileName = '';
                }
                renderFilePreview(c);
            })
            .withFailureHandler(function() {
                c._prevMimeType = '';
                renderFilePreview(c);
            })
            .adminGetFileMetadata(ADMIN_TOKEN, c.prev_file_path);
        return;
    }

    // Now both metadata are resolved or not Drive URLs
    const isPdf1 = c._mimeType === 'application/pdf' || 
                   (c._fileName && c._fileName.toLowerCase().endsWith('.pdf')) ||
                   c.file_path.toLowerCase().includes('.pdf');
                   
    const isPdf2 = c.prev_file_path ? (
                       c._prevMimeType === 'application/pdf' ||
                       (c._prevFileName && c._prevFileName.toLowerCase().endsWith('.pdf')) ||
                       c.prev_file_path.toLowerCase().includes('.pdf')
                   ) : false;

    // Build UI for preview
    if (isPdf1) {
        const embedPdfUrl = getGoogleDriveEmbedUrl(c.file_path, 'pdf');
        docViewer.innerHTML = '\n            <div style="display:flex; flex-direction:column; gap:10px; height: 100%;">\n                <div style="margin-bottom:10px; display:flex; gap:10px;">\n                    <a href="' + (c.file_path) + '" target="_blank" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;"><i class="fa-solid fa-external-link"></i> 新視窗開啟 PDF</a>\n                </div>\n                <iframe src="' + (embedPdfUrl) + '" class="audit-iframe" style="width:100%; height:550px; border:1px solid var(--border-color); border-radius:8px; background:#fff;"></iframe>\n            </div>\n        ';
    } else {
        // Render as image preview
        const embedImgUrl1 = getGoogleDriveEmbedUrl(c.file_path, 'image');
        const embedImgUrl2 = c.prev_file_path ? getGoogleDriveEmbedUrl(c.prev_file_path, 'image') : '';
        
        let imgHTML = '\n            <div style="display:flex; flex-direction:column; gap:15px; width:100%;">\n                <div style="margin-bottom:10px; display:flex; gap:10px;">\n                    <a href="' + (c.file_path) + '" target="_blank" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;"><i class="fa-solid fa-external-link"></i> 新視窗開啟檔案一</a>\n';
        if (c.prev_file_path) {
            imgHTML += '                    <a href="' + c.prev_file_path + '" target="_blank" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.85rem;"><i class="fa-solid fa-external-link"></i> 新視窗開啟檔案二</a>\n';
        }
        imgHTML += '                </div>\n                <div style="text-align:center;">\n                    <img src="' + (embedImgUrl1) + '" alt="證明文件一" class="audit-img" style="max-width:100%; border-radius:8px; border:1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">\n                </div>\n        ';

        if (c.prev_file_path) {
            if (isPdf2) {
                const embedPdfUrl2 = getGoogleDriveEmbedUrl(c.prev_file_path, 'pdf');
                imgHTML += '\n                    <div style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px;">\n                        <iframe src="' + (embedPdfUrl2) + '" class="audit-iframe" style="width:100%; height:400px; border:1px solid var(--border-color); border-radius:8px; background:#fff;"></iframe>\n                    </div>\n                ';
            } else {
                imgHTML += '\n                    <div style="margin-top: 15px; text-align:center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 15px;">\n                        <img src="' + (embedImgUrl2) + '" alt="證明文件二" class="audit-img" style="max-width:100%; border-radius:8px; border:1px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.5);">\n                    </div>\n                ';
            }
        }
        
        imgHTML += '</div>';
        docViewer.innerHTML = imgHTML;
    }
}

// ==========================================
// 🌌 雲端底圖非同步載入引擎
// ==========================================
function spawnRandomPic() {
    google.script.run
        .withSuccessHandler(function(result) {
            if (result.success && Array.isArray(result.images)) {
                // 先清除畫面上的舊圖，確保不會重複疊加
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
// 🎓 學年升級校對處理函式
// ==========================================
function handlePromoteGrades() {
    if (!confirm("確定要執行學年升級校對嗎？\n\n系統將會比對所有學員的「註冊時間」與「當前時間」，判定是否跨越 8 月份的開學分水嶺，自動將學員年級往上升級（例如大一 ➔ 大二，大四 ➔ 已畢業）並直接寫入試算表資料庫中。")) {
        return;
    }
    
    showToast("正在執行年級升級校對...", "fa-arrows-spin");
    
    google.script.run
        .withSuccessHandler(function(res) {
            if (res.success) {
                if (res.updatedCount === 0) {
                    showToast("校對完成！所有學籍皆為最新年級，無須更新。", "fa-circle-check");
                } else {
                    showToast(res.message, "fa-circle-check");
                    // 以詳細對話框展示升級清單
                    let logStr = '🎉 學年升級校對成功！共更新 ' + (res.updatedCount) + ' 位學員：\n\n';
                    res.logs.forEach(log => {
                        logStr += '• ' + (log.name) + ' (' + (log.uid) + '): ' + (log.oldGrade) + ' ➔ ' + (log.newGrade) + '\n';
                    });
                    alert(logStr);
                    loadCaseList(); // 重新載入案件列表
                }
            } else {
                showToast(res.message, "fa-triangle-exclamation");
            }
        })
        .withFailureHandler(function(err) {
            showToast("伺服器連線失敗，學年升級校對執行失敗！", "fa-triangle-exclamation");
        })
        .adminPromoteStudentGrades(ADMIN_TOKEN);
}

// specialized Blueprint Audit and Milestones panel display
function renderBlueprintAudit(c) {
    const bpSection = document.getElementById('blueprint-audit-section');
    if (!bpSection) return;
    
    if (c.type !== 'blueprint') {
        bpSection.style.display = 'none';
        return;
    }
    
    // Hide standard buttons
    document.getElementById('actions-pending-group').style.display = 'none';
    document.getElementById('actions-approved-group').style.display = 'none';
    document.getElementById('actions-destroyed-banner').style.display = 'none';
    
    bpSection.style.display = 'block';
    
    // Set initial proposal file link
    const propLink = document.getElementById('bp-proposal-file-link');
    if (propLink) propLink.href = c.file_path || '#';
    
    const proposalBox = document.getElementById('bp-proposal-review-box');
    const midtermBox = document.getElementById('bp-midterm-review-box');
    const finalBox = document.getElementById('bp-final-review-box');
    const payoutBoard = document.getElementById('bp-payout-board');
    
    proposalBox.style.display = 'none';
    midtermBox.style.display = 'none';
    finalBox.style.display = 'none';
    payoutBoard.style.display = 'none';
    
    const phase = c.phase || 1;
    const phase1Status = c.phase_1_status || c.status;
    const midtermStatus = c.midterm_status || '';
    const finalStatus = c.final_status || '';
    
    // Proposal Settings Box (always visible unless destroyed)
    if (c.status === 'pending' || phase1Status === 'rejected') {
        proposalBox.style.display = 'block';
        document.getElementById('bp-proposal-actions-pending').style.display = 'flex';
        document.getElementById('bp-proposal-actions-approved').style.display = 'none';
        document.getElementById('bp-approved-amount-input').value = '';
        document.getElementById('bp-midterm-deadline-input').value = '';
        document.getElementById('bp-final-deadline-input').value = '';
    } else if (c.status === 'approved') {
        proposalBox.style.display = 'block';
        document.getElementById('bp-proposal-actions-pending').style.display = 'none';
        document.getElementById('bp-proposal-actions-approved').style.display = 'flex';
        document.getElementById('bp-approved-amount-input').value = c.approved_amount || '';
        document.getElementById('bp-midterm-deadline-input').value = c.midterm_deadline || '';
        document.getElementById('bp-final-deadline-input').value = c.final_deadline || '';
    }

    if (c.status === 'approved' || c.status === 'destroyed') {
        // Show payout board if proposal approved
        payoutBoard.style.display = 'block';
        const approvedAmt = c.approved_amount || 0;
        
        const stage1Amt = Math.round(approvedAmt * 0.3);
        const stage2Amt = Math.round(approvedAmt * 0.4);
        const stage3Amt = Math.round(approvedAmt * 0.3);
        
        document.getElementById('bp-stage-1-amt').innerText = `NT$ ${stage1Amt.toLocaleString()}`;
        document.getElementById('bp-stage-2-amt').innerText = `NT$ ${stage2Amt.toLocaleString()}`;
        document.getElementById('bp-stage-3-amt').innerText = `NT$ ${stage3Amt.toLocaleString()}`;
        
        // Stage 1 status
        const s1Container = document.getElementById('bp-stage-1-status-container');
        if (phase1Status === 'approved') {
            s1Container.innerHTML = `<button class="btn btn-approve" style="padding: 4px 8px; font-size: 0.75rem;" onclick="disburseStage('${c.id}', 1)">確認首款撥發 (30%)</button>`;
        } else if (phase1Status === 'paid') {
            s1Container.innerHTML = `<span class="badge approved">已撥發首款</span>`;
        } else {
            s1Container.innerHTML = `<span class="badge pending">未核准</span>`;
        }
        
        // Stage 2 status
        const s2Container = document.getElementById('bp-stage-2-status-container');
        if (midtermStatus === 'approved') {
            s2Container.innerHTML = `<button class="btn btn-approve" style="padding: 4px 8px; font-size: 0.75rem;" onclick="disburseStage('${c.id}', 2)">確認中期撥發 (40%)</button>`;
        } else if (midtermStatus === 'paid') {
            s2Container.innerHTML = `<span class="badge approved">已撥發中期款</span>`;
        } else if (midtermStatus === 'pending') {
            s2Container.innerHTML = `<span class="badge pending">待審查</span>`;
        } else if (midtermStatus === 'rejected') {
            s2Container.innerHTML = `<span class="badge rejected">已退回</span>`;
        } else {
            s2Container.innerHTML = `<span class="badge pending" style="opacity: 0.5;">未達進度</span>`;
        }
        
        // Stage 3 status
        const s3Container = document.getElementById('bp-stage-3-status-container');
        if (finalStatus === 'approved') {
            s3Container.innerHTML = `<button class="btn btn-approve" style="padding: 4px 8px; font-size: 0.75rem;" onclick="disburseStage('${c.id}', 3)">確認尾款撥發 (30%結案)</button>`;
        } else if (finalStatus === 'paid') {
            s3Container.innerHTML = `<span class="badge approved">已結案</span>`;
        } else if (finalStatus === 'pending') {
            s3Container.innerHTML = `<span class="badge pending">待審查</span>`;
        } else if (finalStatus === 'rejected') {
            s3Container.innerHTML = `<span class="badge rejected">已退回</span>`;
        } else {
            s3Container.innerHTML = `<span class="badge pending" style="opacity: 0.5;">未達進度</span>`;
        }
        
        // Show midterm report review box if pending
        if (midtermStatus === 'pending') {
            midtermBox.style.display = 'block';
            document.getElementById('bp-midterm-file-link').href = c.midterm_file || '#';
            document.getElementById('bp-midterm-overtime-badge').style.display = c.midterm_overtime ? 'inline-block' : 'none';
        }
        
        // Show final report review box if pending
        if (finalStatus === 'pending') {
            finalBox.style.display = 'block';
            document.getElementById('bp-final-file-link').href = c.final_file || '#';
            document.getElementById('bp-final-overtime-badge').style.display = c.final_overtime ? 'inline-block' : 'none';
        }
        
        // If final_status === 'paid' (or phase === 4), enable GDPR Shred button!
        if (phase === 4 && c.status !== 'destroyed') {
            // Show approvedActions (which contains GDPR Shred button)
            document.getElementById('actions-approved-group').style.display = 'block';
        } else if (c.status === 'destroyed') {
            document.getElementById('actions-destroyed-banner').style.display = 'block';
        }
    }
}

window.disburseStage = function(appId, stageNum) {
    let pct = stageNum === 1 ? '30%' : stageNum === 2 ? '40%' : '30%';
    if (confirm(`確認該筆計畫第 ${stageNum} 階段款項 (${pct}) 已成功入帳撥發？\n\n撥發完成後，系統將移轉至下一執行階段並自動發送 Line 撥款通知給學員！`)) {
        toggleLoading(true, "變更撥款進度中...");
        google.script.run
            .withSuccessHandler(function(res) {
                toggleLoading(false);
                showToast(res.message, res.success ? "fa-circle-check" : "fa-circle-xmark");
                if (res.success) {
                    loadCaseList();
                    document.getElementById('auditor-pane').style.display = 'none';
                }
            })
            .withFailureHandler(function(err) {
                toggleLoading(false);
                showToast("網路錯誤，撥發確認失敗！", "fa-triangle-exclamation");
            })
            .adminDisburseStage(ADMIN_TOKEN, appId, stageNum);
    }
};
