// ==========================================
// 拖拽滚动 & 强制滚动修复
// ==========================================
import { logDebug } from './utils.js';

const memoContainer = document.getElementById('memo-list-container');

// --- DRAG TO SCROLL (Robust V3 - Window Binding) ---
export function initDragScroll() {
    const container = document.getElementById('memo-list-container');
    if (!container) return;

    let isDown = false;
    let startY;
    let startScrollTop;
    let isDragging = false; 

    const onMouseDown = (e) => {
        isDown = true;
        isDragging = false;
        container.classList.add('grabbing');
        
        // 关键: 在拖动过程中禁用平滑滚动以确保 1:1 即时移动
        container.style.scrollBehavior = 'auto';
        
        // 记录初始状态
        startY = e.pageY;
        startScrollTop = container.scrollTop;
        
        // 绑定全局监听器以捕获容器外部的快速移动
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        
        logDebug("DRAG START");
    };

    const onMouseMove = (e) => {
        if (!isDown) return;
        
        e.preventDefault(); // 停止选择/原生拖动
        
        const y = e.pageY;
        const walk = (y - startY); 
        
        // 阈值以作为拖动处理 (防止在简单点击时抖动)
        if(Math.abs(walk) > 3) {
            isDragging = true;
            // 在拖动期间禁用子元素的指针事件以提高性能
            container.style.pointerEvents = 'none'; 
        }

        // 直接 1:1 映射: 鼠标向下移动 (正 walk) -> 向上滚动 (减少 scrollTop)
        container.scrollTop = startScrollTop - walk;
    };

    const onMouseUp = (e) => {
        isDown = false;
        container.classList.remove('grabbing');
        container.style.pointerEvents = 'auto'; // 重新启用子元素
        
        // 如果需要其他交互，恢复平滑滚动 (可选)
        container.style.scrollBehavior = 'smooth';
        
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        
        if(isDragging) {
            logDebug("DRAG END");
            // 稍微延迟重置 isDragging 以阻止后续的 'click' 事件
            setTimeout(() => { isDragging = false; }, 50);
        } else {
            isDragging = false;
        }
    };

    // 绑定开始处理程序
    container.addEventListener('mousedown', onMouseDown);
    
    // 捕获点击以防止拖动后触发项目
    // 我们使用捕获阶段在子元素之前拦截
    container.addEventListener('click', (e) => {
        if(isDragging) {
            e.preventDefault();
            e.stopPropagation();
            logDebug("CLICK BLOCKED (Drag)");
        }
    }, true);
}

export function initScrollFix() {
    // 确保 CSS 支持
    const style = document.createElement('style');
    style.innerHTML = `
        .grabbing { cursor: grabbing !important; }
        #memo-list-container { cursor: grab; }
    `;
    document.head.appendChild(style);

    // 调用 init
    setTimeout(initDragScroll, 500); // Wait for DOM

    // --- FORCE SCROLL FIX (Ultimate Solution V2) ---
    // 使用捕获阶段 (true) 在事件到达元素之前拦截事件。
    // 监听多个事件类型以实现兼容性。
    ['wheel', 'mousewheel', 'DOMMouseScroll'].forEach(eventType => {
        window.addEventListener(eventType, (e) => {
            const target = e.target;
            // 检查我们是否在备忘录列表中
            const listContainer = target.closest('#memo-list-container');
            
            if (listContainer) {
                // 计算 Delta
                let delta = 0;
                if (e.deltaY) delta = e.deltaY;
                else if (e.detail) delta = e.detail * 40; // FF
                else if (e.wheelDelta) delta = -e.wheelDelta / 2; // IE/Chrome old

                const before = listContainer.scrollTop;
                listContainer.scrollTop += delta;
                
                // 防止默认浏览器滚动 (可能会失败)
                e.preventDefault();
                e.stopPropagation();
            }
        }, { capture: true, passive: false });
    });
}
