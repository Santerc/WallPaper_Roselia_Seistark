import { state } from './config.js';
import { formatLocalUrl, showToast } from './utils.js';
import { systemPickFile } from './backend.js';

// 渲染设置列表 (卡片风格)
export function renderSettingsList() {
    const container = document.getElementById('dynamic-apps-list');
    if (!container) return;
    container.innerHTML = '';

    state.currentConfig.apps.forEach((app, index) => {
        const div = document.createElement('div');
        div.className = 'app-list-item';
        
        const iconSrc = app.icon ? formatLocalUrl(app.icon) : '../assets/roselia.png';
        
        div.innerHTML = `
            <div class="app-info">
                <img src="${iconSrc}" class="app-icon-thumb" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PC9zdmc+'">
                <div class="app-text">
                    <span class="app-name">${app.name || 'Unnamed App'}</span>
                    <span class="app-path">${app.path || 'No path set'}</span>
                </div>
            </div>
            <div class="actions">
                <button class="btn-icon" onclick="window.openEditor(${index})">✎</button>
                <button class="btn-icon delete" onclick="window.removeAppSlot(${index})">×</button>
            </div>
        `;
        // 让整个卡片可点击进行编辑 (除了按钮)
        div.addEventListener('click', (e) => {
            if(e.target.tagName !== 'BUTTON') window.openEditor(index);
        });
        container.appendChild(div);
    });
}

export function addNewAppSlot() {
    window.openEditor(-1); // 打开新编辑
}

export function removeAppSlot(index) {
    state.currentConfig.apps.splice(index, 1);
    renderSettingsList();
}

// --- 编辑器模态框逻辑 ---
export function openEditor(index) {
    state.editingIndex = index;
    const modal = document.getElementById('editor-modal');
    modal.classList.add('open');
    
    // 填充数据
    let data = { name: "", path: "", icon: "" };
    if (index >= 0 && state.currentConfig.apps[index]) {
        data = state.currentConfig.apps[index];
    }
    
    document.getElementById('edit-app-name').value = data.name || ""; 
    document.getElementById('edit-app-path').value = data.path || "";
    document.getElementById('edit-icon-path').value = data.icon || "";
    
    const preview = document.getElementById('edit-icon-preview');
    if(data.icon) {
        preview.src = formatLocalUrl(data.icon);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
        preview.src = "";
    }
}

export function closeEditor() {
    document.getElementById('editor-modal').classList.remove('open');
}

export function saveEditor() {
    const name = document.getElementById('edit-app-name').value;
    const path = document.getElementById('edit-app-path').value;
    const icon = document.getElementById('edit-icon-path').value;
    
    if (!path && !name) {
        closeEditor(); 
        return;
    }

    const appData = { name, path, icon };

    if (state.editingIndex === -1) {
        state.currentConfig.apps.push(appData);
    } else {
        state.currentConfig.apps[state.editingIndex] = appData;
    }
    
    renderSettingsList();
    closeEditor();
}

// --- 文件选择器 ---
export async function pickFile(type) {
    let filter = "All Files (*.*)|*.*";
    if (type === 'icon') filter = "Images (*.png;*.jpg;*.ico)|*.png;*.jpg;*.ico";
    if (type === 'app' || type === 'music') filter = "Executables (*.exe)|*.exe|All Files (*.*)|*.*";
    
    showToast("Opening File Picker...", "info");
    try {
        const data = await systemPickFile(filter);
        
        if (data.path) {
            // 标准化路径
            const cleanPath = data.path.replace(/\\/g, '/');
            
            if (type === 'music') {
                document.getElementById('cfg-music').value = cleanPath;
            } else if (type === 'app') {
                document.getElementById('edit-app-path').value = cleanPath;
                // 自动猜测名称
                const fileName = cleanPath.split('/').pop().replace(/\.exe$/i, '');
                const nameInput = document.getElementById('edit-app-name');
                if(!nameInput.value) nameInput.value = fileName.charAt(0).toUpperCase() + fileName.slice(1);
            } else if (type === 'icon') {
                document.getElementById('edit-icon-path').value = cleanPath;
                document.getElementById('edit-icon-preview').src = formatLocalUrl(cleanPath);
                document.getElementById('edit-icon-preview').style.display = 'block';
            }
        }
    } catch (e) {
        showToast("Cannot open file picker. Is backend v2 running?", "error");
    }
}
