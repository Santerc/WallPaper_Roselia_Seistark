import { BACKEND_URL, state } from './config.js';
import { saveConfigToBackend } from './backend.js';
import { waitForEditorClose, showToast } from './utils.js';

// ==========================================
// 每日目标逻辑
// ==========================================

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

export function initGoals() {
    if (!state.currentConfig.dailyGoals || typeof state.currentConfig.dailyGoals !== 'object') {
        state.currentConfig.dailyGoals = { date: getTodayStr(), items: [] };
    }
    
    // 检查逻辑: 如果是新的一天重置
    const today = getTodayStr();
    const savedDate = state.currentConfig.dailyGoals.date;
    
    if (!savedDate) {
        state.currentConfig.dailyGoals.date = today;
        saveGoalsConfig();
    }
    else if (savedDate !== today) {
         console.log("New Day Detected! Resetting Goals.");
         state.currentConfig.dailyGoals = { date: today, items: [] };
         saveGoalsConfig();
    }
    
    renderGoals();
}

export function renderGoals() {
    const list = document.getElementById('goal-list-container');
    if (!list) return;
    list.innerHTML = '';
    
    const items = state.currentConfig.dailyGoals.items || [];
    let doneCount = 0;
    
    items.forEach((item, index) => {
        if(item.done) doneCount++;
        
        const div = document.createElement('div');
        div.className = `goal-item ${item.done ? 'done' : ''}`;
        div.innerHTML = `
            <div class="goal-check" onclick="window.toggleGoal(${index})">${item.done ? '✔' : ''}</div>
            <div class="goal-text">${item.text}</div>
            <div class="goal-del" onclick="window.deleteGoal(${index})">×</div>
        `;
        list.appendChild(div);
    });
    
    // 更新进度
    const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
    const pStr = `${percent}%`;
    
    // 文本
    const txt = document.getElementById('goal-percent-big'); 
    if(txt) txt.innerText = pStr;
    
    // 条形图
    const bar = document.getElementById('goal-bar');
    if(bar) bar.style.width = pStr;
    
    // 侧边栏图标液体填充
    const liquid = document.getElementById('sidebar-liquid-fill');
    if(liquid) liquid.style.height = pStr;
}

export function addGoal() {
    showToast("Opening Goals Editor...", "info");
    // 打开外部编辑器
    fetch(`${BACKEND_URL}/api/goals/open_editor`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({}) 
    }).then(res => res.json())
      .then(data => {
          showToast("Monitoring Editor Status...", "info");
          // 长轮询等待关闭
          waitForEditorClose('goals', () => {
              showToast("Editor Closed. Refreshing Data...", "success");
              console.log("Goals editor closed, refreshing...");
              // 我们需要重新加载配置以获取最新目标，这通常涉及 main.js 中的 loadConfigToUI
              // 这里我们可以触发一个全局事件或者直接调用 window 上的方法
              if (window.loadConfigToUI) window.loadConfigToUI();
          });
      })
      .catch(e => {
          console.error("Failed to open goals editor", e);
          showToast("Failed to open editor", "error");
      });
}

export function toggleGoal(index) {
    state.currentConfig.dailyGoals.items[index].done = !state.currentConfig.dailyGoals.items[index].done;
    saveGoalsConfig();
    renderGoals();
}

export function deleteGoal(index) {
    state.currentConfig.dailyGoals.items.splice(index, 1);
    saveGoalsConfig();
    renderGoals();
}

// 保存配置的帮助函数
function saveGoalsConfig() {
    saveConfigToBackend(state.currentConfig);
}
