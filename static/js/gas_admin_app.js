


/* ==========================================================================
   【古哥獎學金】後台審查系統 - 互動邏輯 (Apps Script Admin JS)
   ========================================================================== */

const ADMIN_TOKEN = "<?= adminToken ?>";
let currentCases = [];
let selectedCase = null;

document.addEventListener("DOMContentLoaded", () => {
    // Initial data load
    loadCaseList();
    
    // Bind buttons
    document.getElementById('btn-approve-case').addEventListener('click', approveCase);
    document.getElementById('btn-reject-case').addEventListener('click', rejectCase);
    document.getElementById('btn-destroy-case').addEventListener('click', destroyPIICase);
    
    // Bind settings
    document.getElementById('btn-open-settings').addEventListener('click', openSettingsModal);
    document.getElementById('form-settings').addEventListener('submit', saveSettings);
    
    // Bind logout
    document.getElementById('btn-admin-logout').addEventListener('click', logoutAdmin);
    
    // Bind CSV Export
    document.getElementById('btn-export-csv').addEventListener('click', (e) => {
        e.preventDefault();
        exportApprovedCases();
    });
});

// Load applications list
function loadCaseList() {
    google.script.run
        .withSuccessHandler(function(data) {
            currentCases = data;
            renderCaseList();
            updateStats();
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
    
    if (currentCases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding: 40px; color: var(--text-muted);">
            <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 10px; display: block;"></i>
            目前尚無任何學生提交申請。
        </td></tr>`;
        return;
    }
    
    currentCases.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = `case-row ${selectedCase && selectedCase.id === c.id ? 'active-row' : ''}`;
        tr.addEventListener('click', () => selectCase(c));
        
        // Translate type
        let typeText = '成績挑戰';
        if (c.type === 'progress') typeText = '學期進步';
        if (c.type === 'blueprint') typeText = '未來藍圖';

        // Target text
        let targetText = '--';
        if (c.type === 'challenge') targetText = `${c.challenge_target} 分`;
        if (c.type === 'progress') {
            const diffVal = parseFloat(c.curr_gpa) - parseFloat(c.prev_gpa);
            targetText = `+${diffVal.toFixed(2)} 分`;
        }
        if (c.type === 'blueprint') {
            const pName = c.project_name || '';
            targetText = pName.length > 10 ? pName.substring(0, 10) + '...' : pName;
        }
        
        // Format status badge
        let statusBadge = `<span class="badge pending">待審核</span>`;
        if (c.status === 'approved') statusBadge = `<span class="badge approved">已核准</span>`;
        if (c.status === 'rejected') statusBadge = `<span class="badge rejected">已拒絕</span>`;
        if (c.status === 'destroyed') statusBadge = `<span class="badge destroyed">已銷毀結案</span>`;
        
        tr.innerHTML = `
            <td>${c.created_at}</td>
            <td class="font-tech" style="font-size: 0.85rem;">${c.school || ''} ${c.department || ''} (${c.grade || ''})</td>
            <td>${c.name || '已銷毀'}</td>
            <td><span style="color: var(--neon-blue); font-weight: bold; font-family: monospace;">${c.academic_year || '--'}</span></td>
            <td>${typeText}</td>
            <td>${targetText}</td>
            <td class="font-tech text-gold font-bold">NT$ ${(c.amount || 0).toLocaleString()}</td>
            <td>${statusBadge}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Select a row to display details in split pane
function selectCase(c) {
    selectedCase = c;
    renderCaseList(); // Refresh row highlighting
    
    // Fill left pane text details
    document.getElementById('detail-id').innerText = c.id;
    document.getElementById('detail-name').innerText = c.name || '已銷毀';
    document.getElementById('detail-school-dept').innerText = `${c.school || '--'} ${c.department || '--'} (${c.grade || '--'})`;
    document.getElementById('detail-amount').innerText = `NT$ ${c.amount.toLocaleString()}`;
    document.getElementById('detail-created').innerText = c.created_at;
    document.getElementById('detail-academic-year').innerText = c.academic_year || "未指定學年度";
    
    // Toggle details by type
    const challengeBox = document.getElementById('details-type-challenge');
    const progressBox = document.getElementById('details-type-progress');
    const blueprintBox = document.getElementById('details-type-blueprint');
    
    challengeBox.style.display = 'none';
    progressBox.style.display = 'none';
    blueprintBox.style.display = 'none';
    
    if (c.type === 'challenge') {
        challengeBox.style.display = 'block';
        document.getElementById('detail-challenge-target').innerText = `${c.challenge_target}分`;
        document.getElementById('detail-challenge-gpa').innerText = `${c.gpa}分`;
    } else if (c.type === 'progress') {
        progressBox.style.display = 'block';
        document.getElementById('detail-progress-prev').innerText = `${c.prev_gpa}分`;
        document.getElementById('detail-progress-curr').innerText = `${c.curr_gpa}分`;
        document.getElementById('detail-progress-credits').innerText = `${c.credits} 學分`;
        document.getElementById('detail-bank-code').innerText = c.bank_code || '--';
        document.getElementById('detail-bank-account').innerText = c.bank_account || '--';
    } else if (c.type === 'blueprint') {
        blueprintBox.style.display = 'block';
        document.getElementById('detail-blueprint-name').innerText = c.project_name || '--';
        document.getElementById('detail-blueprint-month').innerText = c.project_month || '--';
    }
    
    // Handle File Preview (Right Pane)
    const fileContainer = document.getElementById('preview-file-container');
    const noFileBox = document.getElementById('preview-no-file');
    
    noFileBox.style.display = 'none';
    fileContainer.innerHTML = '';
    
    if (c.status === 'destroyed') {
        noFileBox.querySelector('p').innerText = "⚠️ 撥款已結案：此檔案依隱私安全切結已執行「一鍵銷毀」，檔案從 Google Drive 雲端硬碟中物理刪除，無法預覽。";
        noFileBox.style.display = 'block';
    } else if (c.file_path) {
        // Build preview links/embeds
        const isPdf = c.file_path.toLowerCase().includes('.pdf');
        
        let linkHTML = `<div class="preview-actions" style="margin-bottom:15px; display:flex; gap:10px;">
            <a href="${c.file_path}" target="_blank" class="btn btn-secondary"><i class="fa-solid fa-external-link"></i> 在 Google Drive 中開啟</a>
        </div>`;
        
        if (isPdf) {
            linkHTML += `<div style="text-align:center; padding:50px; background:rgba(0,0,0,0.2); border-radius:8px; border: 1px dashed var(--border-color);">
                <i class="fa-solid fa-file-pdf" style="font-size:4rem; color:var(--neon-pink); margin-bottom:15px; display:block;"></i>
                <p style="margin-bottom:15px;">已載入未來企劃書 (PDF 提案)。請點選上方按鈕在 Google Drive 中檢視完整內容。</p>
            </div>`;
        } else {
            // Assume image
            linkHTML += `<img src="${c.file_path}" alt="成績單圖檔預覽" class="preview-img">`;
            if (c.prev_file_path) {
                linkHTML += `<h4 style="margin:20px 0 10px; color:var(--neon-blue);">第二學期成績單預覽：</h4>
                <div class="preview-actions" style="margin-bottom:15px;">
                    <a href="${c.prev_file_path}" target="_blank" class="btn btn-secondary"><i class="fa-solid fa-external-link"></i> 開啟第二份成績單</a>
                </div>
                <img src="${c.prev_file_path}" alt="成績單預覽 2" class="preview-img">`;
            }
        }
        fileContainer.innerHTML = linkHTML;
    } else {
        noFileBox.querySelector('p').innerText = "點擊左側列表項目，即可在此預覽學生成績單或企劃書。";
        noFileBox.style.display = 'block';
    }
    
    // Enable/Disable Action Panel Buttons based on status
    const btnApprove = document.getElementById('btn-approve-case');
    const btnReject = document.getElementById('btn-reject-case');
    const btnDestroy = document.getElementById('btn-destroy-case');
    const statusMsg = document.getElementById('case-status-msg');
    
    btnApprove.disabled = true;
    btnReject.disabled = true;
    btnDestroy.disabled = true;
    statusMsg.style.display = 'none';
    
    if (c.status === 'pending') {
        btnApprove.disabled = false;
        btnReject.disabled = false;
    } else if (c.status === 'approved') {
        btnDestroy.disabled = false;
        statusMsg.innerText = "✓ 案件已核准，隨時可匯出至網銀撥款。撥款完畢請點選下方紅鍵「一鍵物理銷毀」以保障隱私個資！";
        statusMsg.className = "status-tip tip-approved";
        statusMsg.style.display = 'block';
    } else if (c.status === 'rejected') {
        statusMsg.innerText = "✗ 案件已被拒絕。若資料填寫有誤，學生可修正後重新申報。";
        statusMsg.className = "status-tip tip-rejected";
        statusMsg.style.display = 'block';
    } else if (c.status === 'destroyed') {
        statusMsg.innerText = "🔒 物理個資銷毀完成。系統僅保留去識別化獎勵紀錄，個資已永無蹤跡。";
        statusMsg.className = "status-tip tip-destroyed";
        statusMsg.style.display = 'block';
    }
    
    // Reveal Split Pane
    document.getElementById('audit-pane').style.display = 'grid';
}

// Update upper dashboard counters
function updateStats() {
    let pendingCount = 0;
    let approvedCount = 0;
    let destroyedCount = 0;
    let totalPayout = 0;
    
    currentCases.forEach(c => {
        if (c.status === 'pending') pendingCount++;
        else if (c.status === 'approved') approvedCount++;
        else if (c.status === 'destroyed') destroyedCount++;
        
        if (c.status === 'approved' || c.status === 'destroyed') {
            totalPayout += c.amount;
        }
    });
    
    document.getElementById('stat-pending').innerText = pendingCount;
    document.getElementById('stat-approved').innerText = approvedCount;
    document.getElementById('stat-destroyed').innerText = destroyedCount;
    document.getElementById('stat-total-amount').innerText = `NT$ ${totalPayout.toLocaleString()}`;
}

// Action: Approve
function approveCase() {
    if (!selectedCase) return;
    if (confirm(`確定要「核准」學生 ${selectedCase.name} 的這筆獎學金申請嗎？
核准金額：NT$ ${selectedCase.amount.toLocaleString()} 元`)) {
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
    if (confirm(`確定要「拒絕」這筆申請案件嗎？`)) {
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
    const msg = `【🚨 警告：個資銷毀安全機制】

確定此筆案件已撥款，並執行「一鍵物理銷毀」？
此動作將進行以下作業：
1. 刪除該學生的成績單/企劃書圖檔
2. 抹除資料庫中該筆申請的戶名與收款銀行帳號
3. 姓名去識別化遮罩 (例如 ${selectedCase.name} -> 遮罩處理)

※ 此物理刪除動作永久無法撤回！※`;
    
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
            link.setAttribute("download", `guge_scholarship_export_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.csv`);
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
            document.getElementById('set-progress-base').value = data.progress_base;
            document.getElementById('set-progress-rate').value = data.progress_conversion_rate;
            document.getElementById('set-blueprint-limit').value = data.blueprint_amount;
            
            // Fill challenge level inputs
            if (data.challenge_amounts) {
                for (let i = 0; i < 8; i++) {
                    const inp = document.getElementById(`set-ladder-${i+1}`);
                    if (inp) {
                        inp.value = data.challenge_amounts[i] !== undefined ? data.challenge_amounts[i] : '';
                    }
                }
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
        const val = parseInt(document.getElementById(`set-ladder-${i+1}`).value);
        if (isNaN(val)) {
            showToast("所有挑戰級距獎金均為必填！", "fa-triangle-exclamation");
            return;
        }
        challengeAmounts.push(val);
    }
    
    const payload = {
        progress_base: parseInt(document.getElementById('set-progress-base').value),
        progress_conversion_rate: parseInt(document.getElementById('set-progress-rate').value),
        blueprint_amount: parseInt(document.getElementById('set-blueprint-limit').value),
        challenge_amounts: challengeAmounts
    };
    
    showToast("儲存設定中...", "fa-gears");
    
    google.script.run
        .withSuccessHandler(function(data) {
            if (data.success) {
                closeModal('modal-settings');
                showToast(data.message, "fa-circle-check");
                loadCaseList();
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
        google.script.run
            .withSuccessHandler(function() {
                showToast("已成功登出管理端！", "fa-right-from-bracket");
                setTimeout(() => {
                    window.location.href = google.script.host.origin + "?page=admin";
                }, 800);
            })
            .withFailureHandler(function() {
                window.location.href = google.script.host.origin + "?page=admin";
            })
            .adminLogout(ADMIN_TOKEN);
    }
}

// Toast helper
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



