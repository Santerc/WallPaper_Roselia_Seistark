// plugins/system-stats/index.js
// No imports to avoid cross-origin/path issues

export default class SystemStatsPlugin {
    constructor(manifest, context) {
        this.manifest = manifest;
        this.context = context || {};
        this.element = null;
        this.interval = null;
    }

    async mount(container) {
        this.element = container;
        // Re-use existing classes for style compatibility
        this.element.innerHTML = `
            <div class="system-stats" style="position: static;">
                <div class="stat-item">
                    <div class="stat-label">CPU</div>
                    <div class="stat-circle">
                        <svg viewBox="0 0 36 36">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle" id="plug-cpu-ring" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div class="stat-text" id="plug-cpu-text">0%</div>
                    </div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">RAM</div>
                    <div class="stat-circle">
                        <svg viewBox="0 0 36 36">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path class="circle" id="plug-ram-ring" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div class="stat-text" id="plug-ram-text">0%</div>
                    </div>
                </div>
            </div>
        `;
        
        // Start polling
        this.updateStats();
        this.interval = setInterval(this.updateStats.bind(this), 2000);
        console.log("SystemStats Plugin Mounted");
    }

    updateStats() {
        if (!this.element) return;
        
        const backendUrl = this.context.backendUrl || 'http://127.0.0.1:35678';
        fetch(`${backendUrl}/api/stats`)
            .then(res => res.json())
            .then(data => {
                const cpu = data.cpu || 0;
                const ram = data.ram || 0;

                const cpuText = this.element.querySelector('#plug-cpu-text');
                const ramText = this.element.querySelector('#plug-ram-text');
                const cpuRing = this.element.querySelector('#plug-cpu-ring');
                const ramRing = this.element.querySelector('#plug-ram-ring');

                if(cpuText) cpuText.innerText = Math.round(cpu) + '%';
                if(ramText) ramText.innerText = Math.round(ram) + '%';
                
                if(cpuRing) cpuRing.setAttribute('stroke-dasharray', `${cpu}, 100`);
                if(ramRing) ramRing.setAttribute('stroke-dasharray', `${ram}, 100`);
            })
            .catch(err => { 
                // silent fail
            });
    }

    unmount() {
        if (this.interval) clearInterval(this.interval);
        this.element.innerHTML = '';
    }
}
