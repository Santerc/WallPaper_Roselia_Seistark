/**
 * Live2D Widget — Lisa (Cubism 2)
 * 依赖: pixi.js v6, live2d.min.js (Cubism2 Core), pixi-live2d-display/cubism2
 */

(function () {
    'use strict';

    // ── 对话文本池（中文）──────────────────────────────────────
    const IDLE_MESSAGES = [
        '✨ 今天也要加油哦！',
        '💕 有什么我可以帮你的吗？',
        '🎵 好像听到音乐声了……',
        '⭐ 在专心工作吗？真棒！',
        '🍃 累了就休息一下吧～',
        '📋 今天的目标完成了多少？',
        '💫 要注意身体哦，别太拼了',
        '🌸 你已经很努力了！',
        '💧 记得多喝水～',
        '🌙 今天过得怎么样？',
    ];

    const TAP_MESSAGES = [
        '😳 诶，你戳哪里呢！',
        '🙈 嘻嘻，好痒～',
        '💢 轻一点啦！',
        '😤 ……你、你干什么！',
        '💦 / / / 算了，随便你……',
    ];

    // ── 工具函数 ──────────────────────────────────────────────
    let bubbleTimer = null;

    function showBubble(text, duration = 3500) {
        const bubble = document.getElementById('live2d-bubble');
        if (!bubble) return;
        clearTimeout(bubbleTimer);
        // 重置动画：先移除再强制重流再加回
        bubble.classList.remove('visible', 'bubble-pop');
        void bubble.offsetWidth;
        bubble.textContent = text;
        bubble.classList.add('visible', 'bubble-pop');
        bubbleTimer = setTimeout(() => {
            bubble.classList.remove('visible', 'bubble-pop');
        }, duration);
    }

    function randomFrom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ── 平滑眼追踪状态 ──────────────────────────────────────────
    // 目标焦点（PIXI 坐标），由 mousemove 更新
    let targetFocusX = 0, targetFocusY = 0;
    // 当前平滑后焦点
    let currentFocusX = 0, currentFocusY = 0;
    let focusInitialized = false;
    // 上次鼠标移动时间
    let lastMouseMoveTime = 0;
    // 动作播放锁：timestamp，期间暂停眼追踪
    let motionLockUntil = 0;

    // ── Debug 辅助线 ──────────────────────────────────────────
    let debugActive = false;
    let debugSvg = null, debugPanel = null;
    let mouseScreenX = 0, mouseScreenY = 0;
    let modelInstanceRef = null;
    let appRef = null;

    function createDebugUI() {
        // 全屏 SVG 覆盖层
        debugSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        debugSvg.id = 'live2d-debug-svg';
        debugSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        document.body.appendChild(debugSvg);

        // 数值面板
        debugPanel = document.createElement('div');
        debugPanel.id = 'live2d-debug-panel';
        document.body.appendChild(debugPanel);

        // Debug 开关按钮
        const btn = document.createElement('button');
        btn.id = 'live2d-debug-btn';
        btn.textContent = '⊹ DEBUG';
        btn.onclick = toggleDebug;
        document.body.appendChild(btn);
    }

    function toggleDebug() {
        debugActive = !debugActive;
        if (debugSvg) debugSvg.classList.toggle('active', debugActive);
        if (debugPanel) debugPanel.classList.toggle('active', debugActive);
        const btn = document.getElementById('live2d-debug-btn');
        if (btn) btn.style.color = debugActive ? '#0ff' : '';
    }

    window.toggleLive2DDebug = toggleDebug;

    function updateDebugOverlay(mx, my) {
        if (!debugActive || !debugSvg || !appRef || !modelInstanceRef) return;

        const model = modelInstanceRef;
        const app   = appRef;
        const canvas = document.getElementById('live2d-canvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();

        // 估算模型头部位置（canvas 内头部大约在上 1/3 处，水平居中）
        const headScreenX = rect.left + rect.width * 0.5;
        const headScreenY = rect.top  + rect.height * 0.28;

        // 画布框
        const dpr = window.devicePixelRatio || 1;
        // model 真实渲染尺寸（PIXI 坐标）
        const scaleX = model.scale.x;
        const scaleY = model.scale.y;
        const mW = model.width  * scaleX;
        const mH = model.height * scaleY;

        // 把 mouse 转为 canvas 内相对坐标（CSS px）
        const canvasRelX = mx - rect.left;
        const canvasRelY = my - rect.top;
        // 转为 PIXI 渲染坐标（考虑 DPR）
        const pixiX = canvasRelX * (canvas.width  / rect.width);
        const pixiY = canvasRelY * (canvas.height / rect.height);

        // 模型中心（PIXI 坐标）
        const modelCX = model.position.x;
        const modelCY = model.position.y - model.height * model.scale.y * 0.72; // 头部偏移
        // 转回 CSS 屏幕坐标
        const headPxX = rect.left + (modelCX / (canvas.width / rect.width));
        const headPxY = rect.top  + (modelCY / (canvas.height / rect.height));

        // 归一化向量（用于 face direction）
        const dx = pixiX - modelCX;
        const dy = pixiY - modelCY;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const nx = dx / len;
        const ny = dy / len;

        // 重新渲染 SVG 内容
        debugSvg.innerHTML = `
          <!-- canvas 边框 -->
          <rect x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}"
                class="dbg-canvas" />
          <!-- 鼠标到头部连线 -->
          <line x1="${headPxX}" y1="${headPxY}" x2="${mx}" y2="${my}" class="dbg-line"/>
          <!-- 头部估算点 (青色) -->
          <circle cx="${headPxX}" cy="${headPxY}" r="7" class="dbg-head"/>
          <text x="${headPxX+10}" y="${headPxY-6}" fill="#0ff" font-size="11" font-family="monospace">HEAD</text>
          <!-- 鼠标点 (洋红) -->
          <circle cx="${mx}" cy="${my}" r="6" class="dbg-mouse"/>
          <text x="${mx+10}" y="${my-6}" fill="#f0f" font-size="11" font-family="monospace">MOUSE</text>
          <!-- 方向箭头（从 HEAD 延伸） -->
          <line x1="${headPxX}" y1="${headPxY}"
                x2="${headPxX + nx*60}" y2="${headPxY + ny*60}"
                stroke="#ff0" stroke-width="2"/>
          <circle cx="${headPxX + nx*60}" cy="${headPxY + ny*60}" r="4" fill="#ff0"/>
        `;

        debugPanel.textContent =
            `[mouse]   screen=(${Math.round(mx)}, ${Math.round(my)})` +
            `\n[mouse]   canvasRel=(${Math.round(canvasRelX)}, ${Math.round(canvasRelY)})` +
            `\n[mouse]   pixi=(${Math.round(pixiX)}, ${Math.round(pixiY)})` +
            `\n[head]    pixi=(${Math.round(modelCX)}, ${Math.round(modelCY)})` +
            `\n[head]    screen=(${Math.round(headPxX)}, ${Math.round(headPxY)})` +
            `\n[dir]     nx=${nx.toFixed(3)}  ny=${ny.toFixed(3)}` +
            `\n[canvas]  rect=(${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)})` +
            `\n[model]   scale=(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})` +
            `\n[model]   pos=(${Math.round(model.position.x)}, ${Math.round(model.position.y)})`;
    }

    // ── 主初始化 ──────────────────────────────────────────────
    async function initLive2D() {
        // 检查依赖是否加载完成
        if (!window.PIXI || !window.PIXI.live2d) {
            console.warn('[Live2D] PIXI 或 pixi-live2d-display 未加载，跳过初始化');
            return;
        }

        createDebugUI();

        const canvas = document.getElementById('live2d-canvas');
        if (!canvas) return;

        const { Live2DModel } = PIXI.live2d;

        // 创建 PIXI app，透明背景
        const app = new PIXI.Application({
            view: canvas,
            autoStart: true,
            backgroundAlpha: 0,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            width: canvas.offsetWidth,
            height: canvas.offsetHeight,
        });
        appRef = app;

        let model;
        try {
            model = await Live2DModel.from('assets/LISA_MODEL/lisa.model.json', {
                autoInteract: false,
                autoUpdate: true,
            });
        } catch (e) {
            console.error('[Live2D] 模型加载失败:', e);
            return;
        }

        app.stage.addChild(model);
        modelInstanceRef = model;

        // ── 缩放与定位 ──
        function resizeModel() {
            const W = app.renderer.width;
            const H = app.renderer.height;
            const scale = (H / model.height) * 0.92;
            model.scale.set(scale);
            model.anchor.set(0.5, 1.0);
            model.position.set(W / 2, H + 10);
        }

        resizeModel();
        window.addEventListener('resize', () => {
            resizeModel();
            // 重置焦点中心
            focusInitialized = false;
        });

        // ── 初始化焦点到模型中心 ──
        function initFocusCenter() {
            currentFocusX = targetFocusX = app.renderer.width  / 2;
            currentFocusY = targetFocusY = app.renderer.height / 2;
            focusInitialized = true;
        }
        initFocusCenter();

        // ── 平滑眼追踪 RAF 循环 ──
        // 插值速度：0.04 = 慢速跟随，更自然
        const LERP_SPEED  = 0.04;
        // 距离阈值：鼠标足够近时不再更新（避免抖动）
        const FOCUS_DEAD_ZONE = 8;  // pixi px
        // 鼠标静止多少 ms 后眼睛回归休息位
        const IDLE_RETURN_MS = 3500;
        // 休息位：略偏上偏右（自然向「观看者」方向）
        function getRestFocusX() { return app.renderer.width  * 0.55; }
        function getRestFocusY() { return app.renderer.height * 0.38; }

        ;(function focusLoop() {
            const now = Date.now();
            const locked = now < motionLockUntil;

            if (!locked) {
                const idle = (now - lastMouseMoveTime) > IDLE_RETURN_MS && lastMouseMoveTime > 0;
                const tx = idle ? getRestFocusX() : targetFocusX;
                const ty = idle ? getRestFocusY() : targetFocusY;

                const dx = tx - currentFocusX;
                const dy = ty - currentFocusY;

                if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                    currentFocusX += dx * LERP_SPEED;
                    currentFocusY += dy * LERP_SPEED;
                    model.focus(currentFocusX, currentFocusY);
                }
            }
            requestAnimationFrame(focusLoop);
        })();

        // ── 鼠标移动：只更新目标，不直接 focus ──
        document.addEventListener('mousemove', (e) => {
            mouseScreenX = e.clientX;
            mouseScreenY = e.clientY;
            lastMouseMoveTime = Date.now();

            const rect = canvas.getBoundingClientRect();
            const pixiX = (e.clientX - rect.left) * (canvas.width  / rect.width);
            const pixiY = (e.clientY - rect.top)  * (canvas.height / rect.height);

            // 只有鼠标超出死区才更新目标，减少微抖动
            const ddx = pixiX - targetFocusX;
            const ddy = pixiY - targetFocusY;
            if (ddx*ddx + ddy*ddy > FOCUS_DEAD_ZONE * FOCUS_DEAD_ZONE) {
                targetFocusX = pixiX;
                targetFocusY = pixiY;
            }

            updateDebugOverlay(e.clientX, e.clientY);
        });

        // ── 点击互动 ──
        canvas.addEventListener('pointerdown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const px = (e.clientX - rect.left) * (canvas.width / rect.width);
            const py = (e.clientY - rect.top)  * (canvas.height / rect.height);

            const hit = model.hitTest(px, py);
            // 锁定眼追踪 2.8 秒（动作播放期间）
            motionLockUntil = Date.now() + 2800;

            if (hit && hit.length > 0) {
                model.motion('tap_body');
                showBubble(randomFrom(TAP_MESSAGES), 3200);
            } else {
                const motions = ['happy', 'wink', 'tap_body'];
                model.motion(randomFrom(motions));
                showBubble(randomFrom(IDLE_MESSAGES), 3200);
            }
        });

        // ── 空闲时随机说话 ──
        function scheduleIdleMessage() {
            const delay = 15000 + Math.random() * 20000;
            setTimeout(() => {
                const widget = document.getElementById('live2d-widget');
                if (widget && !widget.classList.contains('hidden')) {
                    showBubble(randomFrom(IDLE_MESSAGES), 4000);
                }
                scheduleIdleMessage();
            }, delay);
        }
        scheduleIdleMessage();

        model.motion('idle');
        console.log('[Live2D] Lisa 模型加载成功 ✓');
    }

    // ── 切换显示/隐藏 ──────────────────────────────────────────
    function toggleLive2D() {
        const widget = document.getElementById('live2d-widget');
        const btn = document.getElementById('live2d-toggle');
        if (!widget) return;
        const hidden = widget.classList.toggle('hidden');
        if (btn) btn.textContent = hidden ? '▲ LISA' : '▼ HIDE';
    }

    window.toggleLive2D = toggleLive2D;

    // ── 等待 DOM 就绪后启动 ──────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLive2D);
    } else {
        setTimeout(initLive2D, 200);
    }
})();

