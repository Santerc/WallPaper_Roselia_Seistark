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
const BACKEND_URL = "http://localhost:35678";
let currentConfig = { apps: [], musicPath: "", autoStart: false };

// --- Edit Flow State ---
let editingIndex = -1; // -1 means adding new

// Helper to handle local file paths for images
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
    if(confirm('Delete this shortcut?')) {
        currentConfig.apps.splice(index, 1);
        renderSettingsList();
    }
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
const audioCanvas = document.getElementById('audio-visualizer');
let audioCtx, audioDataArray;

if (audioCanvas) {
    const actx = audioCanvas.getContext('2d');

    function drawAudio(audioArray) {
        if (!actx) return;
        const w = audioCanvas.width;
        const h = audioCanvas.height;
        actx.clearRect(0, 0, w, h);

        // Simple Bar Visualizer (using first 64 bins mostly)
        const barCount = 16;
        const barWidth = w / barCount - 2;

        // Check if there is audio to rotate the disc
        let maxVal = 0;

        for(let i = 0; i < barCount; i++) {
            // Map low frequencies better
            const value = audioArray[i * 2] || 0;
            maxVal = Math.max(maxVal, value);

            const barHeight = value * h * 0.8;

            actx.fillStyle = `rgba(0, 210, 211, ${0.5 + value * 0.5})`;
            actx.fillRect(i * (barWidth + 2), h - barHeight, barWidth, barHeight);
        }

        // Rotate Disc Logic
        const disc = document.querySelector('.album-cover');
        if(disc) {
            // Threshold for rotation
            if(maxVal > 0.01) disc.classList.add('playing');
            else disc.classList.remove('playing');
        }
    }

    // Wallpaper Engine Listener
    window.wallpaperRegisterAudioListener = function(audioArray) {
        // audioArray is 128 floats (left+right). We average or take left.
        // Simplified usage
        drawAudio(audioArray);
    };
}

// Initial backend check (This must be called at the end)
loadConfigToUI();
