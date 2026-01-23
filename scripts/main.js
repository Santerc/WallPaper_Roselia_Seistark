import { state, normalizeConfig, BACKEND_URL } from './config.js';
import { logDebug, showToast } from './utils.js';
import { initClock } from './clock.js';
import { toggleDock, renderDock, toggleSettingsModal, launchApp, launchMusicApp } from './dock.js';
import { renderSettingsList, addNewAppSlot, removeAppSlot, openEditor, closeEditor, saveEditor, pickFile } from './apps.js';
import { fetchConfig, saveConfigToBackend, checkBackendStatus, systemStopServer, controlMedia } from './backend.js';
import { initAnimation, updateSakuraCount } from './animation.js';
import { initAudio } from './audio.js';
import { initStats } from './stats.js';
import { initMemos, addNewMemo as addNewMemoAction, openMemoEditor, toggleMemoStatus, requestDeleteMemo, cancelDeleteMemo, confirmDeleteMemo, loadMemos } from './memos.js';
import { initGoals, addGoal, toggleGoal, deleteGoal } from './goals.js';
import { togglePomodoro, initPomodoro } from './pomodoro.js';
import { initScrollFix } from './scroll_fix.js';

// ==========================================
// 全局绑定 (为了让 HTML onclick 工作)
// ==========================================
window.toggleDock = toggleDock;
window.toggleSettingsModal = toggleSettingsModal;
window.launchApp = launchApp;
window.launchMusicApp = launchMusicApp;
window.mediaControl = controlMedia;
window.addNewAppSlot = addNewAppSlot;
window.removeAppSlot = removeAppSlot;
window.openEditor = openEditor;
window.closeEditor = closeEditor; // HTML 中可能没有直接调用，但为了完整性
window.saveEditor = saveEditor; // 通常绑定在按钮上
window.pickFile = pickFile;
window.stopServer = stopServer;
window.saveConfig = saveConfig;
window.loadConfigToUI = loadConfigToUI; // 让 goals.js 等调用
window.togglePomodoro = togglePomodoro;
window.addNewMemo = addNewMemoAction;
window.openMemoEditor = openMemoEditor;
window.toggleMemoStatus = toggleMemoStatus;
window.requestDeleteMemo = requestDeleteMemo;
window.cancelDeleteMemo = cancelDeleteMemo;
window.confirmDeleteMemo = confirmDeleteMemo;
window.addGoal = addGoal;
window.toggleGoal = toggleGoal;
window.deleteGoal = deleteGoal;
window.openSidebarTab = openSidebarTab;
window.switchMemoTab = switchMemoTab;
window.closeBackendModal = closeBackendModal;
window.switchLang = switchLang;
window.copyToClipboard = copyToClipboard;


// ==========================================
// 主逻辑
// ==========================================

async function loadConfigToUI() {
    logDebug("Starting Config Reload from Main...");
    try {
        const data = await fetchConfig();
        
        logDebug("Config Fetched Successfully.");

        // 标准化
        state.currentConfig = normalizeConfig(data);

        // 应用调试
        const debugEl = document.getElementById('debug-console');
        if (state.currentConfig.debug) {
            if(debugEl) debugEl.style.display = 'block';
        } else {
            if(debugEl) debugEl.style.display = 'none';
        }

        // 更新全局 UI
        try { renderDock(); } catch(e) { console.error("Dock Render fail", e); }

        // 更新设置 UI
        renderSettingsList();

        const elMusic = document.getElementById('cfg-music');
        const elAuto = document.getElementById('cfg-autostart');
        if (elMusic) elMusic.value = state.currentConfig.musicPath || '';
        if (elAuto) elAuto.checked = !!state.currentConfig.autoStart;

        // 确保 Memos 和 Goals 被渲染
        try { loadMemos(); } catch(e) { console.error("Memo Render fail", e); }
        
        logDebug(`Reloading Goals. Items: ${state.currentConfig.dailyGoals?.items?.length || 0}`);
        try { initGoals(); } catch(e) { console.error("Goals Render fail", e); }

    } catch (e) {
        logDebug("Config Load Error: " + e.message);
        console.error("Config Load Failed", e);
        // 回退机制
        loadMemos();
    }
}

async function saveConfig() {
    // UI 读取
    const musicPath = document.getElementById('cfg-music').value;
    const autoStart = document.getElementById('cfg-autostart').checked;
    
    state.currentConfig.musicPath = musicPath;
    state.currentConfig.autoStart = autoStart;

    try {
        await saveConfigToBackend(state.currentConfig);
        renderDock(); 
        showToast(`Saved! Music: ${state.currentConfig.musicPath ? 'Set' : 'Empty'}`, "success");
        toggleSettingsModal();
    } catch (e) {
        showToast("Failed to save config. Is backend running?", "error");
    }
}

async function stopServer() {
    try {
        await systemStopServer();
        showToast("Server stopping...", "success");
        setTimeout(() => {
            const orb = document.getElementById('main-orb');
            if(orb) orb.classList.remove('online');
            toggleSettingsModal();
        }, 1000);
    } catch (e) {
        showToast("Failed to stop server", "error");
    }
}

// SideBar Tab Switching
function openSidebarTab(tabName) {
    const w = document.getElementById('memo-widget');
    if(!w) return;
    
    const isClosed = w.classList.contains('closed');
    const memoView = document.getElementById('view-memos');
    const goalsView = document.getElementById('view-goals');
    
    // Case 1: Closed -> Open specific tab
    if(isClosed) {
        w.classList.remove('closed');
        switchMemoTab(tabName);
    } 
    // Case 2: Open -> Check if same tab
    else {
        // Check which view is active
        const isMemoActive = memoView && memoView.classList.contains('active');
        const isGoalsActive = goalsView && goalsView.classList.contains('active');
        
        if (tabName === 'memos' && isMemoActive) {
            // Already active? Toggle close.
            w.classList.add('closed');
        } else if (tabName === 'goals' && isGoalsActive) {
            // Already active? Toggle close.
            w.classList.add('closed');
        } else {
            // Different tab? Switch.
            switchMemoTab(tabName);
        }
    }
}

function switchMemoTab(tab) {
    // UI Toggles
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // 安全检查，防止选择器失败
    const btn = document.querySelector(`.tab-btn[onclick="switchMemoTab('${tab}')"]`);
    if(btn) btn.classList.add('active');
    
    document.querySelectorAll('.memo-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${tab}`);
    if(view) view.classList.add('active');
    
    // Handle Add Button visibility
    const addBtn = document.getElementById('mem-add-btn');
    if(addBtn) {
        if(tab === 'goals') {
            addBtn.style.display = 'none'; // Goals has inline add
            initGoals(); // Refresh goals on switch
        } else {
            addBtn.style.display = 'flex';
        }
    }
}

// ==========================================
// Wallpaper Engine Property Listeners
// ==========================================
window.wallpaperPropertyListener = {
    applyUserProperties: function(properties) {
        if (properties.sakura_count) {
            updateSakuraCount(properties.sakura_count.value);
        }
    }
};

// Close Backend Modal
function closeBackendModal() {
    const modal = document.getElementById('backend-offline-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Switch Language for Backend Modal
function switchLang(lang) {
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const wallpaperDirLabelEl = document.getElementById('wallpaper-dir-label');
    const wallpaperDirEl = document.getElementById('wallpaper-dir');
    const expectedPathLabelEl = document.getElementById('expected-path-label');
    const fullPathLabelEl = document.getElementById('full-path-label');
    const fullPathEl = document.getElementById('full-path');
    const downloadLabelEl = document.getElementById('download-label');
    const githubEl = document.getElementById('github-link');
    
    const wallpaperDir = window.wallpaperDir || '未知';
    const fullPath = wallpaperDir + '\\server.exe';
    
    const langs = {
        en: {
            title: 'Backend Server Not Running',
            text: 'Please start the backend server to use app launch features.',
            wallpaperDirLabel: 'Wallpaper directory:',
            expectedPathLabel: 'Expected server path:',
            fullPathLabel: 'Full path:',
            downloadLabel: 'If not found, please download server.exe from the following website:',
            github: 'https://github.com/yourusername/WallPaper_WE'
        },
        cn: {
            title: '后端服务器未运行',
            text: '请启动后端服务器以使用应用启动功能。',
            wallpaperDirLabel: '壁纸目录为:',
            expectedPathLabel: '预期服务器路径:',
            fullPathLabel: '完整路径:',
            downloadLabel: '如果未找到，请在以下网站下载server.exe：',
            github: 'https://github.com/yourusername/WallPaper_WE'
        },
        jp: {
            title: 'バックエンドサーバーが実行されていません',
            text: 'アプリ起動機能を使用するにはバックエンドサーバーを起動してください。',
            wallpaperDirLabel: '壁紙ディレクトリ:',
            expectedPathLabel: '期待されるサーバーパス:',
            fullPathLabel: '完全パス:',
            downloadLabel: '見つからない場合、以下のウェブサイトからserver.exeをダウンロードしてください：',
            github: 'https://github.com/yourusername/WallPaper_WE'
        }
    };
    
    const data = langs[lang];
    titleEl.textContent = data.title;
    textEl.textContent = data.text;
    wallpaperDirLabelEl.textContent = data.wallpaperDirLabel;
    wallpaperDirEl.textContent = wallpaperDir;
    expectedPathLabelEl.textContent = data.expectedPathLabel;
    fullPathLabelEl.textContent = data.fullPathLabel;
    fullPathEl.textContent = fullPath;
    downloadLabelEl.textContent = data.downloadLabel;
    githubEl.textContent = data.github;
    
    // Update active button
    document.querySelectorAll('.lang-switch button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.lang-switch button[onclick="switchLang('${lang}')"]`).classList.add('active');
}

// Copy to Clipboard
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'success');
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Copied to clipboard', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textArea);
}

// ==========================================
// 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Set wallpaper directory from location
    const url = new URL(location.href);
    let dir = url.pathname;
    if (dir.startsWith('/')) dir = dir.substring(1);
    dir = dir.replace('index.html', '').replace(/\//g, '\\');
    if (dir.endsWith('\\')) dir = dir.slice(0, -1);
    window.wallpaperDir = dir;

    initClock();
    initAnimation();
    initAudio();
    initStats();
    initScrollFix();
    initPomodoro();
    loadConfigToUI();
    
    // 状态检查
    setInterval(checkBackendStatus, 5000);
    checkBackendStatus();

    // Copy functionality for modal
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('copyable')) {
            copyToClipboard(e.target.textContent);
        }
    });

    // Debug Click
    document.addEventListener('click', (e) => {
        // logDebug(`CLICK: ${e.target.tagName} .${e.target.className}`);
    });
});
