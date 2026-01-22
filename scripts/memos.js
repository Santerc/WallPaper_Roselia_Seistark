import { BACKEND_URL } from './config.js';
import { waitForEditorClose } from './utils.js';

let lastMemoDataHash = "";

// 切换备忘录状态 (完成/未完成)
export function toggleMemoStatus(id, event) {
    if(event) event.stopPropagation();
    
    fetch(`${BACKEND_URL}/api/memos`)
    .then(r => r.json())
    .then(list => {
        const item = list.find(m => m.id === id);
        if(item) {
            item.done = !item.done;
            // 保存回传
            fetch(`${BACKEND_URL}/api/memos`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(item)
            }).then(() => loadMemos()); // 重新加载列表
        }
    });
}

// 通过后端窗口打开编辑器
export function openMemoEditor(id) {
    fetch(`${BACKEND_URL}/api/memos`)
    .then(r => r.json())
    .then(list => {
        const item = list.find(m => m.id === id);
        if(item) {
            fetch(`${BACKEND_URL}/api/memos/open_editor`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(item)
            }).then(() => {
                console.log("Editor opened, monitoring...");
                waitForEditorClose('memo', () => {
                    console.log("Editor closed, reloading memos...");
                    loadMemos();
                });
            });
        }
    });
}

export function addNewMemo() {
    // 使用空数据打开编辑器
    fetch(`${BACKEND_URL}/api/memos/open_editor`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: 0, title: "", content: "", dueDate: ""})
    }).then(() => {
        console.log("Editor closed, reloading memos...");
        loadMemos();
    });
}

// --- 自定义删除交互 (无弹窗) ---
export function requestDeleteMemo(id) {
    const overlay = document.getElementById(`del-overlay-${id}`);
    if(overlay) overlay.classList.add('show');
}

export function cancelDeleteMemo(id) {
    const overlay = document.getElementById(`del-overlay-${id}`);
    if(overlay) overlay.classList.remove('show');
}

export function confirmDeleteMemo(id) {
    fetch(`${BACKEND_URL}/api/memos/delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: id})
    }).then(() => {
        const el = document.getElementById(`memo-${id}`);
        if(el) el.remove();
    });
}

// 加载备忘录
export function loadMemos() {
    fetch(`${BACKEND_URL}/api/memos`)
        .then(res => res.json())
        .then(memos => {
            // 简单校验和以避免不必要的 DOM 刷新
            const currentHash = JSON.stringify(memos);
            if (currentHash === lastMemoDataHash) return;
            lastMemoDataHash = currentHash;

            const container = document.getElementById('memo-list-container');
            if(!container) return;
            
            // 保存滚动位置
            const scrollPos = container.scrollTop;
            
            container.innerHTML = '';
            // 排序: 未完成在前，然后按 ID (最新)
            memos.sort((a, b) => {
                if (a.done === b.done) {
                    return b.id - a.id; 
                }
                return a.done ? 1 : -1;
            });
            
            memos.forEach(m => renderMemoCard(m));
            
            // 恢复滚动
            requestAnimationFrame(() => {
                container.scrollTop = scrollPos;
            });
        })
        .catch(e => {
            console.error(e);
            const container = document.getElementById('memo-list-container');
            if(container) {
                container.innerHTML = `<div style="padding:20px; text-align:center; color:#ff7675; font-size:12px;">
                    <p>CONNECTION FAILED</p>
                    <p style="opacity:0.6; margin-top:5px;">Ensure Backend is Running</p>
                    <div style="margin-top:10px; cursor:pointer; text-decoration:underline;" onclick="loadMemos()">RETRY</div>
                </div>`;
            }
        });
}

function renderMemoCard(memo) {
    const container = document.getElementById('memo-list-container');
    const div = document.createElement('div');
    div.className = 'memo-card';
    div.id = `memo-${memo.id}`;
    
    // 检查截止日期状态
    let statusClass = '';
    const now = new Date();
    if (memo.dueDate && !memo.done) {
        const due = new Date(memo.dueDate);
        const timeDiff = due - now;
        if (timeDiff < 0) statusClass = 'overdue';
        else if (timeDiff < 3600000) statusClass = 'urgent'; // 1 hour
    }
    
    if (memo.done) {
        div.classList.add('done');
    } else if (statusClass) {
        div.classList.add(statusClass);
    }
    
    const displayDate = memo.dueDate ? new Date(memo.dueDate).toLocaleString() : 'No Deadline';
    const hasReminder = memo.enableReminder ? '🔔 ON' : '🔕 OFF';
    const title = memo.title || '(No Title)';

    div.innerHTML = `
        <div class="memo-left-check">
             <div class="circle-check ${memo.done ? 'checked' : ''}" onclick="window.toggleMemoStatus(${memo.id}, event)">
                ${memo.done ? '✓' : ''}
             </div>
        </div>
        <div class="memo-main-body">
            <div class="memo-content" onclick="window.openMemoEditor(${memo.id})">
                <div class="memo-title">${title}</div>
            </div>
            
            <div class="memo-meta">
                <div class="ddl-chip">${displayDate}</div>
                <div class="reminder-chip ${memo.enableReminder?'active':''}">${hasReminder}</div>
            </div>

            <div class="memo-toolbar">
                <span class="memo-edit-btn" onclick="window.openMemoEditor(${memo.id})">EDIT</span>
                <span class="memo-delete" onclick="window.requestDeleteMemo(${memo.id})">DELETE</span>
            </div>
        </div>
        
        <div class="delete-overlay" id="del-overlay-${memo.id}">
             <span>Confirm delete?</span>
             <div class="del-actions">
                 <button class="yes" onclick="window.confirmDeleteMemo(${memo.id})">YES</button>
                 <button class="no" onclick="window.cancelDeleteMemo(${memo.id})">NO</button>
             </div>
        </div>
    `;
    container.appendChild(div); 
}

// 初始化备忘录逻辑
export function initMemos() {
    loadMemos();
    // 轮询更新列表
    setInterval(loadMemos, 2000);
    
    // 提醒轮询系统
    setInterval(() => {
        const cards = document.querySelectorAll('.memo-card');
        const now = new Date();
        
        cards.forEach(card => {
            // 注意：这里需要根据实际DOM结构获取数据，可能需要将在 render 时把数据绑在 dom 上更方便
            // 但目前的 HTML 结构并没有 input.memo-date。 原代码逻辑是查找 '.memo-date' input，但在 renderMemoCard 中没有该元素。
            // 假设我们只检查 overdue statusClass
            if(card.classList.contains('urgent')) {
                card.classList.add('gentle-pulse');
            } else {
                card.classList.remove('gentle-pulse');
            }
        });
    }, 30000); // Check every 30s
}
