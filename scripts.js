// ==========================================
// 1. Clock & Date Logic
// ==========================================
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    const dayStr = `${dayNames[now.getDay()]} | ${monthNames[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');

    if(clockEl) clockEl.innerText = `${hours}:${minutes}`;
    if(dateEl) dateEl.innerText = dayStr;
}

setInterval(updateClock, 1000);
updateClock();

// ==========================================
// 2. UI Interaction (Dock & Modal)
// ==========================================
let isDockOpen = false;
let isSettingsOpen = false;

function toggleDock() {
    const dock = document.getElementById('app-dock');
    if (!dock) return;
    isDockOpen = !isDockOpen;
    dock.classList.toggle('active', isDockOpen);
}

function toggleSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    isSettingsOpen = !isSettingsOpen;

    // Using CSS class for transition instead of direct display manipulation
    if (isSettingsOpen) {
        modal.classList.add('open');
        loadConfigToUI();
    } else {
        modal.classList.remove('open');
    }
}

// Close modal when clicking outside
const modalEl = document.getElementById('settings-modal');
if (modalEl) {
    modalEl.addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') {
            toggleSettingsModal();
        }
    });
}

// ==========================================
// 3. Backend Integration & Dynamic Apps
// ==========================================
const BACKEND_URL = "http://127.0.0.1:35678";
let currentConfig = { apps: [], memos: [], dailyGoals: null, musicPath: "", autoStart: false, debug: false }; // Init default

// --- DEBUG SYSTEM (Global) ---
const debugEl = document.getElementById('debug-console');
function logDebug(msg) {
    if(!debugEl || debugEl.style.display === 'none') return;
    const time = new Date().toTimeString().split(' ')[0];
    debugEl.innerText = `[${time}] ${msg}\n` + debugEl.innerText.substring(0, 500);
}

// --- Edit Flow State ---
let editingIndex = -1; // -1 means adding new

// Initialize Config on Load
const ts = Date.now();
fetch(`${BACKEND_URL}/config?t=${ts}`)
    .then(res => {
         if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
         return res.json();
    })
    .then(data => {
        if (!data) throw new Error("No data received");
        currentConfig = normalizeConfig(data);
        
        // Apply Debug
        if(debugEl) debugEl.style.display = currentConfig.debug ? 'block' : 'none';
        
        // Restore Core UI
        // Wrap in try-catch to prevent one failure from blocking others
        try { renderDock(); } catch(e) { console.error("Render Dock failed", e); }
        try { loadMemos(); } catch(e) { console.error("Load Memos failed", e); }

        // Prepare Goals
        try { initGoals(); } catch(e) { console.error("Init Goals failed", e); }
        
        renderSettingsList(); 
    })
    .catch(e => {
        console.error("Config Load Error", e);
        // Fallback: If config fails, try to load Memos anyway (they use separate endpoint)
        loadMemos();
    });
    
// ... Helper to handle local file paths for images ...
function formatLocalUrl(path) {
    if (!path) return '';
    path = path.replace(/\\/g, '/');
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    
    // Use backend proxy to serve local images (bypass browser file:// restrictions)
    return `${BACKEND_URL}/proxy/image?path=${encodeURIComponent(path)}`;
}

// Render Settings List (New Card Style)
function renderSettingsList() {
    const container = document.getElementById('dynamic-apps-list');
    if (!container) return;
    container.innerHTML = '';

    currentConfig.apps.forEach((app, index) => {
        const div = document.createElement('div');
        div.className = 'app-list-item';
        
        const iconSrc = app.icon ? formatLocalUrl(app.icon) : 'roselia.png';
        
        div.innerHTML = `
            <div class="app-info">
                <img src="${iconSrc}" class="app-icon-thumb" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PC9zdmc+'">
                <div class="app-text">
                    <span class="app-name">${app.name || 'Unnamed App'}</span>
                    <span class="app-path">${app.path || 'No path set'}</span>
                </div>
            </div>
            <div class="actions">
                <button class="btn-icon" onclick="openEditor(${index})">✎</button>
                <button class="btn-icon delete" onclick="removeAppSlot(${index})">×</button>
            </div>
        `;
        // Make the whole card clickable for edit, except buttons
        div.addEventListener('click', (e) => {
            if(e.target.tagName !== 'BUTTON') openEditor(index);
        });
        container.appendChild(div);
    });
}

function addNewAppSlot() {
    openEditor(-1); // Open editor for new
}

window.removeAppSlot = function(index) {
    currentConfig.apps.splice(index, 1);
    renderSettingsList();
};

// --- Editor Modal Logic ---
function openEditor(index) {
    editingIndex = index;
    const modal = document.getElementById('editor-modal');
    modal.classList.add('open');
    
    // Fill data
    let data = { name: "", path: "", icon: "" };
    if (index >= 0 && currentConfig.apps[index]) {
        data = currentConfig.apps[index];
    }
    
    document.getElementById('edit-app-name').value = data.name || ""; // Fix: ensure empty string if undefined
    document.getElementById('edit-app-path').value = data.path || "";
    document.getElementById('edit-icon-path').value = data.icon || "";
    
    const preview = document.getElementById('edit-icon-preview');
    if(data.icon) {
        preview.src = formatLocalUrl(data.icon);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
        preview.src = "";
    }
}

function closeEditor() {
    document.getElementById('editor-modal').classList.remove('open');
}

function saveEditor() {
    const name = document.getElementById('edit-app-name').value;
    const path = document.getElementById('edit-app-path').value;
    const icon = document.getElementById('edit-icon-path').value;
    
    if (!path && !name) {
        closeEditor(); 
        return;
    }

    const appData = { name, path, icon };

    if (editingIndex === -1) {
        currentConfig.apps.push(appData);
    } else {
        currentConfig.apps[editingIndex] = appData;
    }
    
    renderSettingsList();
    closeEditor();
}

// --- File Picker ---
async function pickFile(type) {
    let filter = "All Files (*.*)|*.*";
    if (type === 'icon') filter = "Images (*.png;*.jpg;*.ico)|*.png;*.jpg;*.ico";
    if (type === 'app' || type === 'music') filter = "Executables (*.exe)|*.exe|All Files (*.*)|*.*";
    
    showToast("Opening File Picker...", "info");
    try {
        const res = await fetch(`${BACKEND_URL}/system/pick-file?filter=${encodeURIComponent(filter)}`);
        const data = await res.json();
        
        if (data.path) {
            // Normalized path
            const cleanPath = data.path.replace(/\\/g, '/');
            
            if (type === 'music') {
                document.getElementById('cfg-music').value = cleanPath;
            } else if (type === 'app') {
                document.getElementById('edit-app-path').value = cleanPath;
                // Auto guess name
                const fileName = cleanPath.split('/').pop().replace(/\.exe$/i, '');
                const nameInput = document.getElementById('edit-app-name');
                if(!nameInput.value) nameInput.value = fileName.charAt(0).toUpperCase() + fileName.slice(1);
            } else if (type === 'icon') {
                document.getElementById('edit-icon-path').value = cleanPath;
                document.getElementById('edit-icon-preview').src = formatLocalUrl(cleanPath);
                document.getElementById('edit-icon-preview').style.display = 'block';
            }
        }
    } catch (e) {
        showToast("Cannot open file picker. Is backend v2 running?", "error");
    }
}

// Check Status
async function checkBackendStatus() {
    const orb = document.getElementById('main-orb'); // Changed selector
    if (!orb) return;
    try {
        await fetch(`${BACKEND_URL}/config`, { signal: AbortSignal.timeout(2000) });
        orb.classList.add('online');
    } catch (e) {
        orb.classList.remove('online');
    }
}
setInterval(checkBackendStatus, 5000);
checkBackendStatus();

// Data Migration Helper
function normalizeConfig(data) {
    // Convert old flat format to new array format if needed
    if (!data.apps) {
        data.apps = [];
        if (data.app1) data.apps.push({ name: "App Slot 01", path: data.app1 });
        if (data.app2) data.apps.push({ name: "App Slot 02", path: data.app2 });
        if (data.app3) data.apps.push({ name: "App Slot 03", path: data.app3 });
    }
    return data;
}

// Render Dock
function renderDock() {
    const dock = document.getElementById('app-dock');
    if (!dock) return;
    dock.innerHTML = '';
    
    currentConfig.apps.forEach((app, index) => {
        if (!app.path) return; // Skip empty
        const item = document.createElement('div');
        item.className = 'shard-item';
        
        // Icon support - Icon Only Mode
        if(app.icon) {
            // Remove text, only keep img. CSS will handle size.
            item.innerHTML = `<img src="${formatLocalUrl(app.icon)}" alt="${app.name}">`;
            item.title = app.name; // Tooltip for name
        } else {
            // Fallback if no icon, show text 
            item.innerText = (app.name || `App ${index + 1}`).substring(0, 2).toUpperCase();
        }
        
        item.onclick = () => launchApp(app.path);
        
        // Structured wave delay for "Inner to Outer" explosion feel
        // The further down the list (outer ring), the later it pops
        const waveDelay = index * 0.04; 
        item.style.transitionDelay = `${waveDelay}s`;
        
        dock.appendChild(item);
    });

    // Always add Settings button at the end
    const settingsBtn = document.createElement('div');
    settingsBtn.className = 'shard-item settings-btn';
    // Use Gear Icon instead of text
    settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    settingsBtn.title = 'Settings'; // Tooltip
    settingsBtn.onclick = (e) => {
        e.stopPropagation();
        toggleSettingsModal();
    };
    settingsBtn.style.transitionDelay = `${(currentConfig.apps.length + 1) * 0.04}s`;
    dock.appendChild(settingsBtn);
}


// Launch Helper
async function launchApp(path) {
    if (!path) return;
    try {
        await fetch(`${BACKEND_URL}/launch?path=${encodeURIComponent(path)}`);
    } catch (e) {
        showToast("Failed to launch. Check backend.", "error");
    }
}

function launchMusicApp() {
    const path = currentConfig.musicPath;
    console.log("Music Launch Request:", path);
    
    if (path && path.trim().length > 0) {
        showToast("Launching Music Player...", "info");
        launchApp(path);
    } else {
        showToast("Music path not set! Opening configuration...", "error");
        
        // Open settings and highlight the music input
        if (!isSettingsOpen) toggleSettingsModal();
        setTimeout(() => {
            const input = document.getElementById('cfg-music');
            if(input) {
                input.focus();
                input.style.borderColor = '#ff4757';
                input.style.boxShadow = '0 0 10px rgba(255, 71, 87, 0.5)';
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.style.boxShadow = '';
                }, 1000);
            }
        }, 500);
    }
}

// Load Config
async function loadConfigToUI() {
    try {
        const res = await fetch(`${BACKEND_URL}/config`);
        let data = await res.json();

        // Normalize
        data = normalizeConfig(data);
        currentConfig = data;

        // Update Global UI
        renderDock();

        // Update Settings UI
        renderSettingsList();

        const elMusic = document.getElementById('cfg-music');
        const elAuto = document.getElementById('cfg-autostart');
        if (elMusic) elMusic.value = data.musicPath || '';
        if (elAuto) elAuto.checked = !!data.autoStart;

    } catch (e) {
        console.error("Failed to load config", e);
        // Fallback render
        renderDock();
    }
}

// Toast Function
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Simple icon based on type
    let icon = 'ℹ';
    if(type === 'success') icon = '✔';
    if(type === 'error') icon = '✖';
    
    toast.innerHTML = `<span style="font-size:1.2em; margin-right:5px;">${icon}</span> ${message}`;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Save Config
async function saveConfig() {
    // Current config is already updated by editor, just need music/autostart
    currentConfig.musicPath = document.getElementById('cfg-music').value;
    currentConfig.autoStart = document.getElementById('cfg-autostart').checked;
    
    // Legacy mapping removal
    // ...

    try {
        await fetch(`${BACKEND_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentConfig) // Use modified structure
        });
        renderDock(); // Re-render main dock
        showToast(`Saved! Music: ${currentConfig.musicPath ? 'Set' : 'Empty'}`, "success");
        toggleSettingsModal();
    } catch (e) {
        showToast("Failed to save config. Is backend running?", "error");
    }
}

// Stop Server Function
async function stopServer() {
    // Direct stop without confirmation
    try {
        await fetch(`${BACKEND_URL}/system/stop`, { method: 'POST' });
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

// ... existing code ...

// Render Settings Form (Removed old text)
// function renderSettingsList() { ... } 
// function addNewAppSlot() { ... }
// window.removeAppSlot = ...
// function readConfigFromForm() { ... } (Deprecated)


// ==========================================
// 4. Shard (Glass Fragment) Animation
// ==========================================
const canvas = document.getElementById('sakura-canvas');
let ctx;
let width, height;
let sakuraCount = 50; 
const petals = [];

function mediaControl(action, event) {
    // Visual feedback
    const btn = event ? event.currentTarget : null;
    if (btn) {
        btn.style.transform = "scale(0.9)";
        setTimeout(() => btn.style.transform = "", 150);
    }
    fetch(`${BACKEND_URL}/media/${action}`)
        .catch(e => console.error("Media Control Error:", e));
}

class Shard {
    constructor() {
        this.reset();
        this.points = [];
        const type = Math.random() > 0.5 ? 3 : 4; 
        for(let i=0; i<type; i++) {
            const angle = (i / type) * Math.PI * 2 + (Math.random() * 0.5); // More random angle jitter
            // Irregular radius for sharper shards: 0.3 to 1.0 range creates spikes
            const r = (Math.random() * 0.7 + 0.3); 
            this.points.push({x: Math.cos(angle) * r, y: Math.sin(angle) * r});
        }
        // Added some brighter colors for the "exploded" feel
        const colors = ['255, 255, 255', '162, 155, 254', '116, 185, 255', '0, 210, 211', '223, 228, 234'];
        this.baseColor = colors[Math.floor(Math.random() * colors.length)];
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * -height;
        // Increased base size range
        this.size = Math.random() * 30 + 10; 
        this.speedX = Math.random() * 1 - 0.5;
        this.speedY = Math.random() * 1.5 + 0.5;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 1 - 0.5;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.flipX = Math.random() * Math.PI;
        this.flipY = Math.random() * Math.PI;
        this.flipSpeedX = Math.random() * 0.05;
        this.flipSpeedY = Math.random() * 0.05;
    }


    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.rotation += this.rotationSpeed;
        this.flipX += this.flipSpeedX;
        this.flipY += this.flipSpeedY;

        if (this.y > height + 50) {
            this.reset();
        }
    }

    draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        
        const scaleX = Math.cos(this.flipX);
        const scaleY = Math.cos(this.flipY);
        ctx.scale(scaleX, scaleY);

        ctx.beginPath();
        if(this.points.length > 0) {
            ctx.moveTo(this.points[0].x * this.size, this.points[0].y * this.size);
            for(let i=1; i<this.points.length; i++) {
                ctx.lineTo(this.points[i].x * this.size, this.points[i].y * this.size);
            }
        }
        ctx.closePath();

        ctx.fillStyle = `rgba(${this.baseColor}, ${this.opacity})`;
        ctx.fill();
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 1.5})`;
        ctx.stroke();

        ctx.restore();
    }
}
const Petal = Shard; 

if (canvas) {
    ctx = canvas.getContext('2d');
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    function initSakura() {
        petals.length = 0;
        for (let i = 0; i < sakuraCount; i++) {
            petals.push(new Shard());
        }
    }

    function animateSakura() {
        ctx.clearRect(0, 0, width, height);
        petals.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animateSakura);
    }

    window.addEventListener('resize', () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    });

    initSakura();
    animateSakura();
}

// ==========================================
// 5. Wallpaper Engine Property Listeners
// ==========================================
window.wallpaperPropertyListener = {
    applyUserProperties: function(properties) {
        if (properties.sakura_count) {
            sakuraCount = properties.sakura_count.value;
            if (petals.length < sakuraCount) {
                while(petals.length < sakuraCount) petals.push(new Petal());
            } else {
                petals.length = sakuraCount;
            }
        }
    }
};

// ==========================================
// 6. Audio Visualizer
// ==========================================
let globalAudioCanvas = document.getElementById('audio-visualizer');
let globalActx = null;
let lastAudioData = new Array(5).fill(0); 

// Canvas Setup
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

// THE LISTENER CALLBACK
function wallpaperAudioListener(audioArray) {
    // Stop demo if running
    if (window.demoTimer) {
        clearInterval(window.demoTimer);
        window.demoTimer = null;
    }

    if (globalActx && globalAudioCanvas) {
        drawAudioFrame(audioArray);
    }
}

// REGISTRATION LOGIC
function registerListener() {
    // Check for Modern API
    if (window.wallpaperRegisterAudioListener) {
        try {
            // Standard Call
            window.wallpaperRegisterAudioListener(wallpaperAudioListener);
        } catch(e) {
            console.error("API Call Failed", e);
            // Fallback assignment
            window.wallpaperRegisterAudioListener = wallpaperAudioListener;
        }
    } else {
        // API not found (yet?), assign global expecting WE to find it
        window.wallpaperRegisterAudioListener = wallpaperAudioListener;
    }
}

// Try multiple times
registerListener();
window.addEventListener('load', registerListener);
setTimeout(registerListener, 2000);

function drawAudioFrame(audioArray) {
    if(!globalActx) return;
    
    const w = globalAudioCanvas.width;
    const h = globalAudioCanvas.height;
    globalActx.clearRect(0, 0, w, h);

    // Visualizer Settings (Thick Bars)
    const barCount = 5; 
    const spacing = 4; // Slightly reduced spacing to fit bars better
    const barWidth = (w - (barCount - 1) * spacing) / barCount;
    
    let maxVal = 0;

    for(let i = 0; i < barCount; i++) {
        // Frequency Mapping: Focus on Bass/Low-Mids
        // Map 5 bars to indices: 0, 1, 3, 5, 8 (More logarithmic-ish)
        const indices = [0, 1, 3, 5, 8]; 
        let idx = indices[i];
        
        // Sum Left and Right channels
        let rawVal = (audioArray[idx] || 0) + (audioArray[64 + idx] || 0); 
        rawVal = rawVal * 0.5; // Average

        // Smooth falloff
        if (rawVal > lastAudioData[i]) {
            lastAudioData[i] = rawVal; 
        } else {
            lastAudioData[i] = Math.max(0, lastAudioData[i] - 0.05); // Slower decay for visibility
        }
        
        const renderVal = lastAudioData[i];
        maxVal = Math.max(maxVal, renderVal);

        // ALWAYS Draw a base line (so we know it's there)
        const minHeight = 4;

        if (renderVal > 0.0001 || true) { // Always draw something
            let barHeight = renderVal * h * 3.0; // 3x Gain
            barHeight = Math.max(minHeight, barHeight); 
            barHeight = Math.min(h, barHeight); 

            const x = i * (barWidth + spacing);
            const y = h - barHeight;

            // Neon Cyan
            globalActx.fillStyle = `rgba(0, 210, 211, ${0.4 + renderVal * 0.6})`;
            globalActx.fillRect(x, y, barWidth, barHeight);
            
            // White Cap
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

// Demo Mode Logic (Fallback)
window.demoTimer = null;
setTimeout(() => {
    // Check if we haven't received any data yet
    // Note: We can't easily check if the listener was CALLED, but we can check if we are silent.
    // For now, simple Browser check:
    const isWallpaperEngine = !!window.wallpaperRequestRandomFileForProperty; // WE specific API check
    if (!isWallpaperEngine) {
        console.log("Browser env detected. Starting Audio Demo.");
        startAudioDemo();
    }
}, 1500);

function startAudioDemo() {
    const demodata = new Array(128).fill(0);
    let t = 0;
    window.demoTimer = setInterval(() => {
        t += 0.2;
        const beat = Math.pow((Math.sin(t) + 1)/2, 8); // Sharp beat
        for(let i=0; i<10; i++) { // Only fill low freqs
             demodata[i] = Math.random() * 0.2 + beat * 0.8; 
             demodata[64+i] = demodata[i];
        }
        if (globalActx) drawAudioFrame(demodata);
    }, 33);
}

// Initial backend check (This must be called at the end)
loadConfigToUI();

// ==========================================
// 7. System Stats & Memo Logic
// ==========================================

// --- System Stats ---
function updateSystemStats() {
    fetch('http://127.0.0.1:35678/api/stats')
        .then(res => res.json())
        .then(data => {
            const cpu = data.cpu || 0;
            const ram = data.ram || 0;

            document.getElementById('cpu-text').innerText = Math.round(cpu) + '%';
            document.getElementById('ram-text').innerText = Math.round(ram) + '%';
            
            const cpuRing = document.getElementById('cpu-ring');
            // The logic: 100 refers to the circumference relative to SVG viewBox size 
            if(cpuRing) cpuRing.setAttribute('stroke-dasharray', `${cpu}, 100`);

            const ramRing = document.getElementById('ram-ring');
            if(ramRing) ramRing.setAttribute('stroke-dasharray', `${ram}, 100`);
        })
        .catch(err => { 
            // Silent fail
        });
}

// Poll every 2 seconds
setInterval(updateSystemStats, 2000);
updateSystemStats();

// --- Memo Logic ---
function toggleMemo() {
    const w = document.getElementById('memo-widget');
    if(w) w.classList.toggle('closed');
}

let lastMemoDataHash = "";

function loadMemos() {
    fetch('http://127.0.0.1:35678/api/memos')
        .then(res => res.json())
        .then(memos => {
            // Simple checksum to avoid dom refresh if data hasn't changed
            // This prevents scroll jumping and interaction resetting
            const currentHash = JSON.stringify(memos);
            if (currentHash === lastMemoDataHash) return;
            lastMemoDataHash = currentHash;

            const container = document.getElementById('memo-list-container');
            if(!container) return;
            
            // Save scroll position
            const scrollPos = container.scrollTop;
            
            container.innerHTML = '';
            // Sort: Not done first, then by ID (newest)
            // Or just keep arbitrary order. Let's do a simple sort.
            // Active first, then Done. Within each, newest first.
            memos.sort((a, b) => {
                if (a.done === b.done) {
                    return b.id - a.id; 
                }
                return a.done ? 1 : -1;
            });
            
            memos.forEach(m => renderMemoCard(m));
            
            // Restore scroll
            // Use requestAnimationFrame to ensure DOM is painted
            requestAnimationFrame(() => {
                container.scrollTop = scrollPos;
            });
        })
        .catch(e => {
            console.error(e);
            const container = document.getElementById('memo-list-container');
            // Only replace if it's still "Loading..." or empty, to avoid overwriting transient states if possible
            if(container) {
                container.innerHTML = `<div style="padding:20px; text-align:center; color:#ff7675; font-size:12px;">
                    <p>CONNECTION FAILED</p>
                    <p style="opacity:0.6; margin-top:5px;">Ensure Backend is Running</p>
                    <div style="margin-top:10px; cursor:pointer; text-decoration:underline;" onclick="loadMemos()">RETRY</div>
                </div>`;
            }
        });
}

function renderMemoCard(memo) {
    const container = document.getElementById('memo-list-container');
    const div = document.createElement('div');
    div.className = 'memo-card';
    div.id = `memo-${memo.id}`;
    
    // Check deadline status
    let statusClass = '';
    const now = new Date();
    if (memo.dueDate && !memo.done) {
        const due = new Date(memo.dueDate);
        const timeDiff = due - now;
        if (timeDiff < 0) statusClass = 'overdue';
        else if (timeDiff < 3600000) statusClass = 'urgent'; // 1 hour
    }
    
    if (memo.done) {
        div.classList.add('done');
    } else if (statusClass) {
        div.classList.add(statusClass);
    }
    
    // Display Only Mode (Click to Edit)
    const displayDate = memo.dueDate ? new Date(memo.dueDate).toLocaleString() : 'No Deadline';
    const hasReminder = memo.enableReminder ? '🔔 ON' : '🔕 OFF';
    
    const title = memo.title || '(No Title)';
    const content = memo.content || memo.text || ''; // Fallback for old memos

    div.innerHTML = `
        <div class="memo-left-check">
             <div class="circle-check ${memo.done ? 'checked' : ''}" onclick="toggleMemoStatus(${memo.id}, event)">
                ${memo.done ? '✓' : ''}
             </div>
        </div>
        <div class="memo-main-body">
            <div class="memo-content" onclick="openMemoEditor(${memo.id})">
                <div class="memo-title">${title}</div>
            </div>
            
            <div class="memo-meta">
                <div class="ddl-chip">${displayDate}</div>
                <div class="reminder-chip ${memo.enableReminder?'active':''}">${hasReminder}</div>
            </div>

            <div class="memo-toolbar">
                <span class="memo-edit-btn" onclick="openMemoEditor(${memo.id})">EDIT</span>
                <span class="memo-delete" onclick="requestDeleteMemo(${memo.id})">DELETE</span>
            </div>
        </div>
        
        <div class="delete-overlay" id="del-overlay-${memo.id}">
             <span>Confirm delete?</span>
             <div class="del-actions">
                 <button class="yes" onclick="confirmDeleteMemo(${memo.id})">YES</button>
                 <button class="no" onclick="cancelDeleteMemo(${memo.id})">NO</button>
             </div>
        </div>
    `;
    container.appendChild(div); 
}

function toggleMemoStatus(id, event) {
    if(event) event.stopPropagation();
    
    fetch('http://127.0.0.1:35678/api/memos')
    .then(r => r.json())
    .then(list => {
        const item = list.find(m => m.id === id);
        if(item) {
            item.done = !item.done;
            // Save back
            fetch('http://127.0.0.1:35678/api/memos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(item)
            }).then(() => loadMemos()); // Reload list
        }
    });
}

// Open Editor via Backend Window
function openMemoEditor(id) {
    // Find existing data to pass
    // We basically need to look up the memo object from our 'memos' list we fetched earlier?
    // Let's assume we can fetch it or we store it in a global map.
    // Simpler: Just Fetch All, find ID, send. 
    // Or attach data to DOM.
    // Let's re-fetch local state or better: make memos global
    fetch('http://127.0.0.1:35678/api/memos')
    .then(r => r.json())
    .then(list => {
        const item = list.find(m => m.id === id);
        if(item) {
            fetch('http://127.0.0.1:35678/api/memos/open_editor', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(item)
            });
        }
    });
}

function addNewMemo() {
    // Open editor with empty data
    fetch('http://127.0.0.1:35678/api/memos/open_editor', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: 0, title: "", content: "", dueDate: ""})
    });
}

// Poll for updates (since external editor changes file)
setInterval(() => {
    // Only reload if we are not interacting? Or just reload.
    // Since UI is read-only, it is safe to reload always.
    loadMemos();
}, 2000);

// --- Custom Delete UX (No Alert) ---
function requestDeleteMemo(id) {
    const overlay = document.getElementById(`del-overlay-${id}`);
    if(overlay) overlay.classList.add('show');
}

function cancelDeleteMemo(id) {
    const overlay = document.getElementById(`del-overlay-${id}`);
    if(overlay) overlay.classList.remove('show');
}

function confirmDeleteMemo(id) {
    fetch('http://127.0.0.1:35678/api/memos/delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: id})
    }).then(() => {
        const el = document.getElementById(`memo-${id}`);
        if(el) el.remove();
    });
}

// --- Reminder Polling System ---
setInterval(() => {
    const cards = document.querySelectorAll('.memo-card');
    const now = new Date();
    
    cards.forEach(card => {
        const dateInput = card.querySelector('.memo-date');
        const reminderCheck = card.querySelector('input[type="checkbox"]');
        
        if (dateInput && dateInput.value && reminderCheck && reminderCheck.checked) {
            const due = new Date(dateInput.value);
            const diff = due - now;
            
            // Logic: If due in < 15 mins and > -1 min (just passed)
            // Pulse effect
            if (diff < 900000 && diff > -60000) {
                card.classList.add('gentle-pulse');
                // Optional: Play soft sound?
            } else {
                card.classList.remove('gentle-pulse');
            }
            
            // Overdue styling
            if (diff < 0) card.classList.add('overdue');
            else card.classList.remove('overdue');
        }
    });
}, 30000); // Check every 30s

// Load memos on start
loadMemos();

// ... existing mouse tracking (optional, can be removed if verified) ...
// Global Mouse Tracking to debug scrolling
document.addEventListener('mousemove', (e) => {
    // Only log if debug is visible
    // Safety check for debugEl
    if(typeof debugEl !== 'undefined' && debugEl && debugEl.style.display !== 'none') {
       // ... existing ...
    }
});
// ...

function loadConfigToUI() {
    // ... config loading logic ...
    // Check debug flag
    if(currentConfig.debug) {
        if(debugEl) debugEl.style.display = 'block';
    } else {
        if(debugEl) debugEl.style.display = 'none';
    }
}

// ==========================================
// Daily Goals Logic
// ==========================================
// Stored in currentConfig.dailyGoals = { date: "YYYY-MM-DD", items: [...] }

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function initGoals() {
    if (!currentConfig.dailyGoals || typeof currentConfig.dailyGoals !== 'object') {
        currentConfig.dailyGoals = { date: getTodayStr(), items: [] };
    }
    
    // Check logic: Reset if new day
    if (currentConfig.dailyGoals.date !== getTodayStr()) {
         // Auto archive? or just wipe? Let's wipe for now.
         currentConfig.dailyGoals = { date: getTodayStr(), items: [] };
         saveConfigToServer();
    }
    
    renderGoals();
}

function renderGoals() {
    const list = document.getElementById('goal-list-container');
    if (!list) return;
    list.innerHTML = '';
    
    const items = currentConfig.dailyGoals.items || [];
    let doneCount = 0;
    
    items.forEach((item, index) => {
        if(item.done) doneCount++;
        
        const div = document.createElement('div');
        div.className = `goal-item ${item.done ? 'done' : ''}`;
        div.innerHTML = `
            <div class="goal-check" onclick="toggleGoal(${index})">${item.done ? '✔' : ''}</div>
            <div class="goal-text">${item.text}</div>
            <div class="goal-del" onclick="deleteGoal(${index})">×</div>
        `;
        list.appendChild(div);
    });
    
    // Update Progress
    const percent = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
    document.getElementById('goal-percent').innerText = `${percent}%`;
    document.getElementById('goal-bar').style.width = `${percent}%`;
}

function addGoal() {
    const input = document.getElementById('new-goal-input');
    const text = input.value.trim();
    if (!text) return;
    
    if (!currentConfig.dailyGoals) currentConfig.dailyGoals = { date: getTodayStr(), items: [] };
    
    currentConfig.dailyGoals.items.push({ text: text, done: false });
    input.value = '';
    
    saveConfigToServer();
    renderGoals();
}

function handleGoalInput(e) {
    if (e.key === 'Enter') addGoal();
}

function toggleGoal(index) {
    currentConfig.dailyGoals.items[index].done = !currentConfig.dailyGoals.items[index].done;
    saveConfigToServer();
    renderGoals();
}

function deleteGoal(index) {
    currentConfig.dailyGoals.items.splice(index, 1);
    saveConfigToServer();
    renderGoals();
}

function switchMemoTab(tab) {
    // UI Toggles
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchMemoTab('${tab}')"]`).classList.add('active');
    
    document.querySelectorAll('.memo-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${tab}`).classList.add('active');
    
    // Handle Add Button visibility
    const addBtn = document.getElementById('mem-add-btn');
    if(tab === 'goals') {
        addBtn.style.display = 'none'; // Goals has inline add
        initGoals(); // Refresh goals on switch
    } else {
        addBtn.style.display = 'flex';
    }
}

// Wrapper to save entire config because goals are part of it
function saveConfigToServer() {
    fetch(`${BACKEND_URL}/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(currentConfig)
    });
}


// ==========================================
// Pomodoro Timer Logic
// ==========================================
let pomoState = 'idle'; // idle, work, rest
let pomoEndTime = 0;
let pomoDuration = 25 * 60 * 1000; // 25 mins default
let pomoInterval = null;

const POMO_WORK_MINS = 25;
const POMO_REST_MINS = 5;
// SVG Circumference: 2 * PI * 48 ≈ 301.6
const RING_CIRCUMFERENCE = 301.6;

function togglePomodoro() {
    const widget = document.querySelector('.widget-time');
    const statusEl = document.getElementById('pomo-status');
    
    if (pomoState === 'idle') {
        // Start Work
        startPomoSession('work');
    } else if (pomoState === 'work') {
        // Switch to Rest manually or stop? Let's say click toggles stop.
        // Or maybe click skips to rest? Let's implement Stop for simplicity.
        // User asked for "Colors indicate rest/work", implies auto switching usually.
        // Let's make click = Stop/Reset.
        stopPomoSession();
    } else if (pomoState === 'rest') {
        stopPomoSession(); // Back to idle
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
    ring.style.strokeDasharray = `0, ${RING_CIRCUMFERENCE}`; // Clear ring
    
    // updateClock() will take over text
}

function updatePomoTimer() {
    const now = Date.now();
    const diff = pomoEndTime - now;
    
    if (diff <= 0) {
        // Timer Finished
        audioBeep(); // Simple notification
        if (pomoState === 'work') {
            startPomoSession('rest'); // Auto chain
        } else {
            stopPomoSession(); // End cycle
        }
        return;
    }
    
    // Update Text
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    document.getElementById('pomo-status').innerText = `${pomoState.toUpperCase()} ${timeStr}`;
    
    // Update Ring
    updatePomoVisuals(diff);
}

function updatePomoVisuals(remaining = pomoDuration) {
    const ring = document.getElementById('pomo-ring');
    const progress = remaining / pomoDuration; // 1.0 -> 0.0
    
    // We want ring to shrink: dashoffset or dasharray
    // stroke-dasharray: length, gap
    // length = circumference * progress
    const length = RING_CIRCUMFERENCE * progress;
    ring.style.strokeDasharray = `${length}, ${RING_CIRCUMFERENCE}`;
}

function audioBeep() {
    // Can play simple sound context or rely on system
    // For WP Engine, visual is key.
}

// Hook into config loading to init goals
const originalLoadConfig = typeof window.loadConfigToUI !== 'undefined' ? window.loadConfigToUI : null;
// We actually need to find where `currentConfig` is populated.
// It's in `loadConfigToUI` inside toggleSettingsModal usually?
// Ah, `fetch(BACKEND/config)` calls renderSettingsList.
// Let's inject into the fetch flow.
// Actually, `loadMemos` is separate. `initGoals` relies on `currentConfig`.
// We need to fetch config ONCE globally on start if not already done.

// Modify the start sequence
// ...


document.addEventListener('click', (e) => {
    logDebug(`CLICK: ${e.target.tagName} .${e.target.className}`);
});

const memoContainer = document.getElementById('memo-list-container');

// --- DRAG TO SCROLL (Robust V3 - Window Binding) ---
function initDragScroll() {
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
        
        // CRITICAL: Disable smooth scrolling during drag to ensure 1:1 instant movement
        container.style.scrollBehavior = 'auto';
        
        // Record initial state
        startY = e.pageY;
        startScrollTop = container.scrollTop;
        
        // Bind global listeners to capture fast movements outside container
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        
        logDebug("DRAG START");
    };

    const onMouseMove = (e) => {
        if (!isDown) return;
        
        e.preventDefault(); // Stop selection/native drag
        
        const y = e.pageY;
        const walk = (y - startY); 
        
        // Threshold to treat as drag (prevent jitter on simple clicks)
        if(Math.abs(walk) > 3) {
            isDragging = true;
            // Disable pointer events on children during drag to improve performance
            container.style.pointerEvents = 'none'; 
        }

        // Direct 1:1 mapping: Move mouse down (positive walk) -> Scroll up (decrease scrollTop)
        // No easing, no animation, raw position update
        container.scrollTop = startScrollTop - walk;
        
        // logDebug(`DRAG: ${Math.round(walk)}`);
    };

    const onMouseUp = (e) => {
        isDown = false;
        container.classList.remove('grabbing');
        container.style.pointerEvents = 'auto'; // Re-enable children
        
        // Restore smooth scrolling if you want it for other interactions (optional)
        container.style.scrollBehavior = 'smooth';
        
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        
        if(isDragging) {
            logDebug("DRAG END");
            // Delay resetting isDragging slightly to block the subsequent 'click' event
            setTimeout(() => { isDragging = false; }, 50);
        } else {
            isDragging = false;
        }
    };

    // Attach Start Handler
    container.addEventListener('mousedown', onMouseDown);
    
    // Capture Click to prevent triggering items after drag
    // We use capture phase to intercept before child elements
    container.addEventListener('click', (e) => {
        if(isDragging) {
            e.preventDefault();
            e.stopPropagation();
            logDebug("CLICK BLOCKED (Drag)");
        }
    }, true);
}

// Ensure CSS support
const style = document.createElement('style');
style.innerHTML = `
    .grabbing { cursor: grabbing !important; }
    #memo-list-container { cursor: grab; }
`;
document.head.appendChild(style);

// Call init
setTimeout(initDragScroll, 500); // Wait for DOM

// --- FORCE SCROLL FIX (Ultimate Solution V2) ---
// Use Capture Phase (true) to intercept events BEFORE they reach the element.
// Listen to multiple event types for compatibility.
['wheel', 'mousewheel', 'DOMMouseScroll'].forEach(eventType => {
    window.addEventListener(eventType, (e) => {
        // Log raw event to confirm we receive ANYTHING
        // logDebug(`RAW EVENT: ${e.type}`);

        const target = e.target;
        // Check if we are inside the memo list
        const listContainer = target.closest('#memo-list-container');
        
        if (listContainer) {
            // Calculate Delta
            let delta = 0;
            if (e.deltaY) delta = e.deltaY;
            else if (e.detail) delta = e.detail * 40; // FF
            else if (e.wheelDelta) delta = -e.wheelDelta / 2; // IE/Chrome old

            logDebug(`SCROLL CAPTURE: ${delta} on ${target.tagName}`);

            const before = listContainer.scrollTop;
            listContainer.scrollTop += delta;
            
            // Prevent default browser scrolling (which might be failing anyway)
            e.preventDefault();
            e.stopPropagation();
        }
    }, { capture: true, passive: false });
});

if(memoContainer) {
    // Keep existing listener just in case, but the global one above should handle it.
    memoContainer.addEventListener('wheel', (e) => {
         // This might not fire, which is why we added the window listener.
         e.stopPropagation(); 
    }, {passive: false});
    
    // Check scroll geometry periodically
    setInterval(() => {
        if(memoContainer) {
             // logDebug(`GEO: SH=${memoContainer.scrollHeight} CH=${memoContainer.clientHeight}`);
        }
    }, 5000);
} else {
    logDebug("ERROR: Memo container not found on init");
}
