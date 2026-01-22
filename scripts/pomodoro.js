// ==========================================
// 番茄钟逻辑
// ==========================================
let pomoState = 'idle'; // idle, work, rest
let pomoEndTime = 0;
let pomoDuration = 25 * 60 * 1000; // 默认 25 分钟
let pomoInterval = null;

const POMO_WORK_MINS = 25;
const POMO_REST_MINS = 5;
// SVG 周长: 2 * PI * 48 ≈ 301.6
const RING_CIRCUMFERENCE = 301.6;

export function togglePomodoro() {
    if (pomoState === 'idle') {
        // 开始工作
        startPomoSession('work');
    } else if (pomoState === 'work') {
        // 点击停止
        stopPomoSession();
    } else if (pomoState === 'rest') {
        stopPomoSession(); // 回到空闲
    }
}

function startPomoSession(mode) {
    pomoState = mode;
    const mins = mode === 'work' ? POMO_WORK_MINS : POMO_REST_MINS;
    pomoDuration = mins * 60 * 1000;
    pomoEndTime = Date.now() + pomoDuration;
    
    const widget = document.querySelector('.widget-time');
    widget.classList.add('pomo-active');
    if (mode === 'rest') widget.classList.add('rest-mode');
    else widget.classList.remove('rest-mode');
    
    updatePomoVisuals();
    
    if (pomoInterval) clearInterval(pomoInterval);
    pomoInterval = setInterval(updatePomoTimer, 1000);
}

function stopPomoSession() {
    pomoState = 'idle';
    if (pomoInterval) clearInterval(pomoInterval);
    
    const ring = document.getElementById('pomo-ring');
    const widget = document.querySelector('.widget-time');
    
    widget.classList.remove('pomo-active');
    ring.style.strokeDasharray = `0, ${RING_CIRCUMFERENCE}`; // 清除环
    
    const statusEl = document.getElementById('pomo-status');
    if(statusEl) statusEl.innerText = "";
}

function updatePomoTimer() {
    const now = Date.now();
    const diff = pomoEndTime - now;
    
    if (diff <= 0) {
        // 计时结束
        // audioBeep(); // 简单提示音 (如果需要)
        if (pomoState === 'work') {
            startPomoSession('rest'); // 自动进入休息
        } else {
            stopPomoSession(); // 结束循环
        }
        return;
    }
    
    // 更新文本
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    const statusEl = document.getElementById('pomo-status');
    if(statusEl) statusEl.innerText = `${pomoState.toUpperCase()} ${timeStr}`;
    
    // 更新环
    updatePomoVisuals(diff);
}

function updatePomoVisuals(remaining = pomoDuration) {
    const ring = document.getElementById('pomo-ring');
    if(!ring) return;
    
    const progress = remaining / pomoDuration; // 1.0 -> 0.0
    
    // 我们希望环收缩
    // stroke-dasharray: length, gap
    const length = RING_CIRCUMFERENCE * progress;
    ring.style.strokeDasharray = `${length}, ${RING_CIRCUMFERENCE}`;
}
