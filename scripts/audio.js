// ==========================================
// 音频可视化
// ==========================================
let globalAudioCanvas = null;
let globalActx = null;
let lastAudioData = new Array(5).fill(0); 

function drawAudioFrame(audioArray) {
    if(!globalActx) return;
    
    const w = globalAudioCanvas.width;
    const h = globalAudioCanvas.height;
    globalActx.clearRect(0, 0, w, h);

    // 可视化设置 (粗条)
    const barCount = 5; 
    const spacing = 4; // 稍微减少间距以更好地适应条形
    const barWidth = (w - (barCount - 1) * spacing) / barCount;
    
    let maxVal = 0;

    for(let i = 0; i < barCount; i++) {
        // 频率映射: 专注于低音/中低音
        // 将 5 个条映射到索引: 0, 1, 3, 5, 8 (更接近对数)
        const indices = [0, 1, 3, 5, 8]; 
        let idx = indices[i];
        
        // 左声道和右声道的总和
        let rawVal = (audioArray[idx] || 0) + (audioArray[64 + idx] || 0); 
        rawVal = rawVal * 0.5; // 平均值

        // 平滑衰减
        if (rawVal > lastAudioData[i]) {
            lastAudioData[i] = rawVal; 
        } else {
            lastAudioData[i] = Math.max(0, lastAudioData[i] - 0.05); // 可见度衰减较慢
        }
        
        const renderVal = lastAudioData[i];
        maxVal = Math.max(maxVal, renderVal);

        // 始终绘制一条基线 (让我们知道它在那里)
        const minHeight = 4;

        if (renderVal > 0.0001 || true) { // 始终绘制内容
            let barHeight = renderVal * h * 3.0; // 3倍增益
            barHeight = Math.max(minHeight, barHeight); 
            barHeight = Math.min(h, barHeight); 

            const x = i * (barWidth + spacing);
            const y = h - barHeight;

            // 霓虹青色
            globalActx.fillStyle = `rgba(0, 210, 211, ${0.4 + renderVal * 0.6})`;
            globalActx.fillRect(x, y, barWidth, barHeight);
            
            // 白色顶盖
            globalActx.fillStyle = `rgba(255, 255, 255, 0.9)`;
            globalActx.fillRect(x, y, barWidth, 3);
        }
    }
    updateDiscRotation(maxVal);
}

function updateDiscRotation(maxVal) {
    const disc = document.querySelector('.album-cover');
    if(disc) {
        if(maxVal > 0.01) disc.classList.add('playing');
        else disc.classList.remove('playing');
    }
}

// 演示模式逻辑 (回退)
function startAudioDemo() {
    console.log("Browser env detected. Starting Audio Demo.");
    const demodata = new Array(128).fill(0);
    let t = 0;
    window.demoTimer = setInterval(() => {
        t += 0.2;
        const beat = Math.pow((Math.sin(t) + 1)/2, 8); // 尖锐的节拍
        for(let i=0; i<10; i++) { // 只填充低频
             demodata[i] = Math.random() * 0.2 + beat * 0.8; 
             demodata[64+i] = demodata[i];
        }
        if (globalActx) drawAudioFrame(demodata);
    }, 33);
}

export function initAudio() {
    globalAudioCanvas = document.getElementById('audio-visualizer');
    
    // Canvas 设置
    if (!globalAudioCanvas) {
        setTimeout(() => {
            globalAudioCanvas = document.getElementById('audio-visualizer');
            if (globalAudioCanvas) {
                globalActx = globalAudioCanvas.getContext('2d');
                globalAudioCanvas.onclick = () => window.location.reload();
            }
        }, 100);
    } else {
        globalActx = globalAudioCanvas.getContext('2d');
        globalAudioCanvas.onclick = () => window.location.reload();
    }
    
    // 注册监听器
    registerListener();
    window.addEventListener('load', registerListener);
    setTimeout(registerListener, 2000);
    
    // 演示检查
    setTimeout(() => {
        // 检查是否尚未收到任何数据
        // 注意: 我们无法轻松检查 listener 是否被调用，但我们可以检查是否静音。
        // 目前，简单的浏览器检查:
        const isWallpaperEngine = !!window.wallpaperRequestRandomFileForProperty; // WE 特定 API 检查
        if (!isWallpaperEngine) {
            startAudioDemo();
        }
    }, 1500);
}

// 监听器回调
function wallpaperAudioListener(audioArray) {
    // 如果正在运行演示停止
    if (window.demoTimer) {
        clearInterval(window.demoTimer);
        window.demoTimer = null;
    }

    if (globalActx && globalAudioCanvas) {
        drawAudioFrame(audioArray);
    }
}

function registerListener() {
    // 检查现代 API
    if (window.wallpaperRegisterAudioListener) {
        try {
            // 标准调用
            window.wallpaperRegisterAudioListener(wallpaperAudioListener);
        } catch(e) {
            console.error("API Call Failed", e);
            // 回退赋值
            window.wallpaperRegisterAudioListener = wallpaperAudioListener;
        }
    } else {
        // 未找到 API (尚未?), 分配全局变量，期望 WE 找到它
        window.wallpaperRegisterAudioListener = wallpaperAudioListener;
    }
}
