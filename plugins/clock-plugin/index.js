// plugins/clock-plugin/index.js

export default class ClockPlugin {
    constructor(manifest, context) {
        this.manifest = manifest;
        this.context = context || {};
        this.element = null;
        this.clockInterval = null;
        
        // Pomodoro State
        this.pomoState = 'idle'; // idle, work, rest
        this.pomoEndTime = 0;
        this.pomoDuration = 0;
        this.pomoInterval = null;
        this.workMins = 25;
        this.restMins = 5;
        this.ringCircumference = 301.6;
    }

    async mount(container) {
        this.element = container;
        
        // Restore Original UI Structure
        this.element.innerHTML = `
            <div class="widget-time" id="pomo-widget" style="position: static; transform: none;">
                <!-- Pomodoro Ring Overlay -->
                <svg class="pomo-svg" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="pomo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#9c88ff;stop-opacity:1" />
                            <stop offset="50%" style="stop-color:#6c5ce7;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#a29bfe;stop-opacity:1" />
                            <animate attributeName="x1" values="0%;100%;0%" dur="3s" repeatCount="indefinite" />
                            <animate attributeName="x2" values="100%;200%;100%" dur="3s" repeatCount="indefinite" />
                        </linearGradient>
                    </defs>
                    <circle class="pomo-bg" cx="50" cy="50" r="48"></circle>
                    <circle class="pomo-ring" id="pomo-ring" cx="50" cy="50" r="48" stroke-dasharray="0, 301.6"></circle>
                </svg>
                
                <div class="time-content">
                    <h1 id="clock">00:00</h1>
                    <p id="date">LOADING...</p>
                    <div id="pomo-status" class="pomo-status">WORK 25:00</div>
                </div>

                <!-- Settings Button -->
                <div class="pomo-settings-btn" id="pomo-settings-btn" title="Pomodoro Settings">
                    <img src="assets/Yukina_icon.png" alt="Settings">
                </div>
            </div>
        `;
        
        // Initial Fetch of Config
        this.fetchPomoConfig();

        // Bind Events
        const widget = this.element.querySelector('#pomo-widget');
        if (widget) {
            widget.onclick = (e) => {
                // Prevent toggling if clicking settings button
                if (e.target.closest('.pomo-settings-btn')) return;
                this.togglePomodoro();
            };
        }

        const settingsBtn = this.element.querySelector('#pomo-settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openPomoSettings();
            };
        }

        // Start Clock
        this.startClock();
        console.log("Clock/Pomodoro Plugin Mounted");
    }

    startClock() {
        const update = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            
            const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
            const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

            const dayStr = `${dayNames[now.getDay()]} | ${monthNames[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

            const clockEl = this.element.querySelector('#clock');
            const dateEl = this.element.querySelector('#date');
            
            if (clockEl) clockEl.innerText = `${hours}:${minutes}`;
            if (dateEl) dateEl.innerText = dayStr;
        };
        
        update();
        this.clockInterval = setInterval(update, 1000);
    }
    
    // --- Pomodoro Logic ---
    
    async fetchPomoConfig() {
        const backendUrl = this.context.backendUrl || 'http://127.0.0.1:35678';
        try {
            const res = await fetch(`${backendUrl}/config`);
            const config = await res.json();
             if (config.pomodoroConfig) {
                this.workMins = config.pomodoroConfig.work || 25;
                this.restMins = config.pomodoroConfig.rest || 5;
            }
        } catch(e) {
            console.error("Pomo Config Error", e);
        }
    }

    async openPomoSettings() {
        const backendUrl = this.context.backendUrl || 'http://127.0.0.1:35678';
        try {
            await fetch(`${backendUrl}/api/pomodoro/open_editor`, { method: 'POST' });
        } catch (e) {
            console.error("Error opening settings", e);
        }
    }

    togglePomodoro() {
        // Reload config before start
        this.fetchPomoConfig().then(() => {
             if (this.pomoState === 'idle') {
                this.startPomoSession('work');
            } else if (this.pomoState === 'work') {
                this.stopPomoSession();
            } else if (this.pomoState === 'rest') {
                this.stopPomoSession();
            }
        });
    }

    startPomoSession(mode) {
        this.pomoState = mode;
        const mins = mode === 'work' ? this.workMins : this.restMins;
        this.pomoDuration = mins * 60 * 1000;
        this.pomoEndTime = Date.now() + this.pomoDuration;
        
        const widget = this.element.querySelector('#pomo-widget');
        if(widget) {
            widget.classList.add('pomo-active');
            if (mode === 'rest') widget.classList.add('rest-mode');
            else widget.classList.remove('rest-mode');
        }

        this.updatePomoVisuals();
        
        if (this.pomoInterval) clearInterval(this.pomoInterval);
        this.pomoInterval = setInterval(this.updatePomoVisuals.bind(this), 1000);
    }

    stopPomoSession() {
        if (this.pomoState === 'work') {
            // Switch to Rest
            this.startPomoSession('rest');
        } else {
            // Idle
            this.pomoState = 'idle';
            if (this.pomoInterval) clearInterval(this.pomoInterval);
            
            const widget = this.element.querySelector('#pomo-widget');
            if(widget) {
                widget.classList.remove('pomo-active', 'rest-mode');
            }
            // Reset Visuals
             const ring = this.element.querySelector('#pomo-ring');
             if (ring) ring.style.strokeDashoffset = 0;
             const statusEl = this.element.querySelector('#pomo-status');
             if (statusEl) statusEl.innerText = `WORK ${this.workMins}:00`;
        }
    }

    updatePomoVisuals() {
        if (this.pomoState === 'idle') return;
        
        const now = Date.now();
        const left = this.pomoEndTime - now;
        
        if (left <= 0) {
            this.stopPomoSession(); // Will switch to rest or idle
            // Play alarm sound if needed (omitted for now)
            return;
        }

        const total = this.pomoDuration;
        const progress = 1 - (left / total);
        const offset = this.ringCircumference * progress;
        
        const ring = this.element.querySelector('#pomo-ring');
        if (ring) ring.style.strokeDashoffset = offset;
        
        // Text
        const secsLeft = Math.ceil(left / 1000);
        const m = Math.floor(secsLeft / 60);
        const s = secsLeft % 60;
        const label = this.pomoState === 'work' ? 'WORK' : 'REST';
        
        const statusEl = this.element.querySelector('#pomo-status');
        if (statusEl) statusEl.innerText = `${label} ${m}:${String(s).padStart(2, '0')}`;
    }

    unmount() {
        if (this.clockInterval) clearInterval(this.clockInterval);
        if (this.pomoInterval) clearInterval(this.pomoInterval);
        this.element.innerHTML = '';
    }
}
