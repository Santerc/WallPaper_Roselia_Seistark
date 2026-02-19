// ==========================================
// 音频可视化
// ==========================================
let globalAudioCanvas = null;
let globalActx = null;
let lastAudioData = new Array(48).fill(0); 

function drawAudioFrame(audioArray) {
    if(!globalActx) return;
    
    const w = globalAudioCanvas.width;
    const h = globalAudioCanvas.height;
    globalActx.clearRect(0, 0, w, h);

    // 密集条柱（全宽面板用 48 条）
    const barCount = 48;
    const spacing = 2;
    const barWidth = (w - (barCount - 1) * spacing) / barCount;
    
    let maxVal = 0;
    const barVals = [];

    for(let i = 0; i < barCount; i++) {
        // 对数频率映射：覆盖 0~63 频段
        const logIdx = Math.floor(Math.pow(i / barCount, 1.4) * 63);
        let rawVal = ((audioArray[logIdx] || 0) + (audioArray[64 + logIdx] || 0)) * 0.5;

        if (rawVal > lastAudioData[i]) {
            lastAudioData[i] = rawVal;
        } else {
            lastAudioData[i] = Math.max(0, lastAudioData[i] - 0.03);
        }
        
        const renderVal = lastAudioData[i];
        barVals.push(renderVal);
        maxVal = Math.max(maxVal, renderVal);

        const minH = 3;
        let barH = renderVal * h * 5.0;
        barH = Math.max(minH, Math.min(h * 0.98, barH));

        const x = i * (barWidth + spacing);
        const y = h - barH;

        // 中央偏亮的紫粉渐变，顶端透明消散
        const prog = i / (barCount - 1);
        const brightness = 1 - Math.abs(prog - 0.5) * 0.5;
        const topAlpha   = (0.0 + renderVal * 0.7) * brightness;  // 顶端几乎透明
        const botAlpha   = (0.5 + renderVal * 0.5) * brightness;
        const grad = globalActx.createLinearGradient(x, y, x, y + barH);
        grad.addColorStop(0,   `rgba(220, 140, 255, ${topAlpha})`);
        grad.addColorStop(0.4, `rgba(190, 100, 255, ${(topAlpha + botAlpha) * 0.55})`);
        grad.addColorStop(1,   `rgba(110, 40,  200, ${botAlpha})`);
        globalActx.fillStyle = grad;
        globalActx.fillRect(x, y, barWidth, barH);

        // 顶盖高光（突出上界，低振幅也显示）
        if (renderVal > 0.02) {
            // 白色亮线
            globalActx.fillStyle = `rgba(255, 230, 255, ${0.3 + renderVal * 0.7})`;
            globalActx.fillRect(x, y, barWidth, 2);
            // 顶端额外辉光
            if (renderVal > 0.15) {
                const glow = globalActx.createLinearGradient(x, y - 8, x, y + 4);
                glow.addColorStop(0, 'rgba(255, 180, 255, 0)');
                glow.addColorStop(1, `rgba(240, 160, 255, ${renderVal * 0.5})`);
                globalActx.fillStyle = glow;
                globalActx.fillRect(x - 1, y - 8, barWidth + 2, 10);
            }
        }
    }

    updateDiscRotation(maxVal);
    updateCSSVisBars(barVals, maxVal);
}

// 把音频幅度映射到右侧 8 根 CSS 装饰条
function updateCSSVisBars(barVals, maxVal) {
    const bars = document.querySelectorAll('.lm-vbar');
    if (!bars.length) return;
    const n = bars.length;
    const segSize = Math.floor(barVals.length / n);
    bars.forEach((bar, i) => {
        let avg = 0;
        for (let k = i * segSize; k < (i + 1) * segSize; k++) avg += barVals[k] || 0;
        avg /= segSize;
        const px = Math.max(8, Math.min(60, avg * 180));
        bar.style.setProperty('--peak', `${px}px`);
    });
}

function updateDiscRotation(maxVal) {
    const disc = document.querySelector('.lm-disc') || document.querySelector('.album-cover');
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
