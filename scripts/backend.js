import { BACKEND_URL } from './config.js';
import { showToast } from './utils.js';

// 获取配置
export function fetchConfig() {
    const ts = Date.now();
    return fetch(`${BACKEND_URL}/config?t=${ts}`)
        .then(res => {
             if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
             return res.json();
        });
}

// 保存配置
export async function saveConfigToBackend(config) {
    return fetch(`${BACKEND_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
}

// 启动应用
export async function releaseLaunchApp(path) {
    if (!path) return;
    try {
        await fetch(`${BACKEND_URL}/launch?path=${encodeURIComponent(path)}`);
    } catch (e) {
        showToast("无法启动。检查后端。", "error");
    }
}

// 系统：选择文件
export async function systemPickFile(filter) {
    const res = await fetch(`${BACKEND_URL}/system/pick-file?filter=${encodeURIComponent(filter)}`);
    return await res.json();
}

// 系统：停止服务器
export async function systemStopServer() {
    return fetch(`${BACKEND_URL}/system/stop`, { method: 'POST' });
}

// 媒体控制
export function controlMedia(action) {
    fetch(`${BACKEND_URL}/media/${action}`)
        .catch(e => console.error("Media Control Error:", e));
}

// 状态检查
export async function checkBackendStatus() {
    const orb = document.getElementById('main-orb'); 
    if (!orb) return;
    try {
        await fetch(`${BACKEND_URL}/config`, { signal: AbortSignal.timeout(2000) });
        orb.classList.add('online');
    } catch (e) {
        orb.classList.remove('online');
    }
}
