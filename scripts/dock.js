import { state } from './config.js';
import { formatLocalUrl, showToast } from './utils.js';
import { releaseLaunchApp } from './backend.js';

// ==========================================
// 2. UI 交互 (Dock & Modal)
// ==========================================

export function toggleDock() {
    const dock = document.getElementById('app-dock');
    if (!dock) return;
    state.isDockOpen = !state.isDockOpen;
    dock.classList.toggle('active', state.isDockOpen);
}

export function toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    state.isSettingsOpen = !state.isSettingsOpen;

    // 使用 CSS 类进行过渡
    if (state.isSettingsOpen) {
        modal.classList.add('open');
        // 加载配置到 UI (在 main.js 中处理或通过回调)
        if(window.loadConfigToUI) window.loadConfigToUI();
    } else {
        modal.classList.remove('open');
    }
}

// 渲染 Dock
export function renderDock() {
    const dock = document.getElementById('app-dock');
    if (!dock) return;
    dock.innerHTML = '';
    
    state.currentConfig.apps.forEach((app, index) => {
        if (!app.path) return; // 跳过空项
        const item = document.createElement('div');
        item.className = 'shard-item';
        
        // 仅图标模式
        if(app.icon) {
            item.innerHTML = `<img src="${formatLocalUrl(app.icon)}" alt="${app.name}">`;
            item.title = app.name; // Tooltip
        } else {
            // 备用文本
            item.innerText = (app.name || `App ${index + 1}`).substring(0, 2).toUpperCase();
        }
        
        item.onclick = () => window.launchApp(app.path);
        
        // 结构化波浪延迟
        const waveDelay = index * 0.04; 
        item.style.transitionDelay = `${waveDelay}s`;
        
        dock.appendChild(item);
    });

    // 始终在该末尾添加设置按钮
    const settingsBtn = document.createElement('div');
    settingsBtn.className = 'shard-item settings-btn';
    // 齿轮 SVG
    settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    settingsBtn.title = 'Settings';
    settingsBtn.onclick = (e) => {
        e.stopPropagation();
        toggleSettingsModal();
    };
    settingsBtn.style.transitionDelay = `${(state.currentConfig.apps.length + 1) * 0.04}s`;
    dock.appendChild(settingsBtn);
}

export function launchApp(path) {
    return releaseLaunchApp(path);
}

export function launchMusicApp() {
    const path = state.currentConfig.musicPath;
    console.log("Music Launch Request:", path);
    
    if (path && path.trim().length > 0) {
        showToast("Launching Music Player...", "info");
        launchApp(path);
    } else {
        showToast("Music path not set! Opening configuration...", "error");
        
        if (!state.isSettingsOpen) toggleSettingsModal();
        setTimeout(() => {
            const input = document.getElementById('cfg-music');
            if(input) {
                input.focus();
                input.style.borderColor = '#ff4757';
                input.style.boxShadow = '0 0 10px rgba(255, 71, 87, 0.5)';
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.style.boxShadow = '';
                }, 1000);
            }
        }, 500);
    }
}
