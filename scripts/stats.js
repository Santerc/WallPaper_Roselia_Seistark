import { BACKEND_URL } from './config.js';

// --- 系统统计 ---
export function updateSystemStats() {
    fetch(`${BACKEND_URL}/api/stats`)
        .then(res => res.json())
        .then(data => {
            const cpu = data.cpu || 0;
            const ram = data.ram || 0;

            document.getElementById('cpu-text').innerText = Math.round(cpu) + '%';
            document.getElementById('ram-text').innerText = Math.round(ram) + '%';
            
            const cpuRing = document.getElementById('cpu-ring');
            // 逻辑: 100 指的是相对于 SVG viewBox 大小的周长
            if(cpuRing) cpuRing.setAttribute('stroke-dasharray', `${cpu}, 100`);

            const ramRing = document.getElementById('ram-ring');
            if(ramRing) ramRing.setAttribute('stroke-dasharray', `${ram}, 100`);
        })
        .catch(err => { 
            // 静默失败
        });
}

export function initStats() {
    // 每 2 秒轮询一次
    setInterval(updateSystemStats, 2000);
    updateSystemStats();
}
