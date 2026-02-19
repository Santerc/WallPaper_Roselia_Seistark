// plugins/dock-bar/index.js
import { state } from '../../scripts/config.js';
import { formatLocalUrl } from '../../scripts/utils.js';

export default class DockPlugin {
    constructor(manifest, context) {
        this.manifest = manifest;
        this.context = context;
        this.element = null;
    }

    async mount(container) {
        this.element = container;
        // Use existing structure
        this.element.innerHTML = `
            <div class="liquid-container" style="position: static; margin: 0;">
                <div class="crystal-menu-btn" id="plug-main-orb" title="展开菜单">
                    <div class="crystal-content">
                        <div class="status-dot" id="plug-status-indicator"></div>
                    </div>
                </div>

                <div class="app-dock" id="plug-app-dock">
                    <!-- Items injected here -->
                </div>
            </div>
        `;

        // Bind Events
        const orb = this.element.querySelector('#plug-main-orb');
        if (orb) {
            orb.onclick = () => this.toggleDock();
        }

        // Render Initial State
        this.renderDockContent();
        
        // Listen to global config updates (custom event or just polling state is easier for now)
        // Ideally we subscribe to config changes.
        document.addEventListener('configUpdated', () => {
             this.renderDockContent();
        });

        console.log("Dock Plugin Mounted");
    }
    
    toggleDock() {
        // Can reuse global toggleDock logic or implement local
        // Re-implementing correctly for Plugin instance
        const dock = this.element.querySelector('#plug-app-dock');
        if (!dock) return;
        
        // Use state but maybe local state is better?
        // Let's toggle class
        dock.classList.toggle('active');
        
        // Check backend status (visual only)
        // const orb = this.element.querySelector('#plug-main-orb');
        // orb.classList.toggle('online', ...); 
    }

    renderDockContent() {
        const dock = this.element.querySelector('#plug-app-dock');
        if (!dock) return;
        dock.innerHTML = '';
        
        if (!state.currentConfig || !state.currentConfig.apps) return;

        state.currentConfig.apps.forEach((app, index) => {
            if (!app.path) return;
            const item = document.createElement('div');
            item.className = 'shard-item';
            
            if(app.icon) {
                item.innerHTML = `<img src="${formatLocalUrl(app.icon)}" alt="${app.name}">`;
                item.title = app.name; 
            } else {
                item.innerText = (app.name || `App ${index + 1}`).substring(0, 2).toUpperCase();
            }
            
            item.onclick = () => window.launchApp(app.path);
            
            const waveDelay = index * 0.04; 
            item.style.transitionDelay = `${waveDelay}s`;
            
            dock.appendChild(item);
        });

        // Settings Btn
        const settingsBtn = document.createElement('div');
        settingsBtn.className = 'shard-item settings-btn';
        settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
        settingsBtn.title = 'Settings';
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            if(window.toggleSettingsModal) window.toggleSettingsModal();
        };
        settingsBtn.style.transitionDelay = `${(state.currentConfig.apps.length + 1) * 0.04}s`;
        dock.appendChild(settingsBtn);
    }
}
