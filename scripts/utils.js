import { BACKEND_URL, state } from './config.js';

// --- DEBUG 系统 (全局) ---
const debugEl = document.getElementById('debug-console');

export function logDebug(msg) {
    console.log(msg); // 同时也在这个浏览器控制台中记录
    if(!debugEl) return;
    
    // 只有在配置启用时显示 (由 loadConfigToUI 控制 debugEl 的显示状态)
    
    const time = new Date().toTimeString().split(' ')[0];
    debugEl.innerText = `[${time}] ${msg}\n` + debugEl.innerText.substring(0, 1000);
}

// ... 处理本地图片路径的助手 ...
export function formatLocalUrl(path) {
    if (!path) return '';
    path = path.replace(/\\/g, '/');
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    
    // 使用后端代理服务本地图片 (绕过浏览器 file:// 限制)
    return `${BACKEND_URL}/proxy/image?path=${encodeURIComponent(path)}`;
}

// Toast 提示函数
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // 基于类型的简单图标
    let icon = 'ℹ';
    if(type === 'success') icon = '✔';
    if(type === 'error') icon = '✖';
    
    toast.innerHTML = `<span style="font-size:1.2em; margin-right:5px;">${icon}</span> ${message}`;
    
    container.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 通用轮询等待编辑器关闭
export function waitForEditorClose(targetType, callback) {
    // 递归长轮询
    function check() {
        console.log(`Checking ${targetType} status...`);
        fetch(`${BACKEND_URL}/api/system/wait_for_close?type=${targetType}`)
            .then(res => res.json())
            .then(data => {
                if (data.closed) {
                    if (callback) callback();
                } else {
                    // 仍未关闭，立即再次检查
                    check();
                }
            })
            .catch(e => {
                console.error("Long polling failed, retrying in 2s...", e);
                setTimeout(check, 2000);
            });
    }
    // 稍微延迟第一次检查以确保后端状态已更新
    setTimeout(check, 1000);
}
