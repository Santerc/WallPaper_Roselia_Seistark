// plugins/clock-plugin/index.js

export default class ClockPlugin {
    constructor(manifest) {
        this.manifest = manifest;
        this.element = null;
        this.interval = null;
    }

    async mount(container) {
        this.element = container;
        this.element.innerHTML = `
            <div style="color: white; font-family: sans-serif; text-align: center;">
                <h1 id="clock-time" style="font-size: 3em; margin:0; text-shadow: 0 0 10px black;">00:00:00</h1>
                <p id="clock-date" style="font-size: 1.2em; opacity: 0.8; margin:0;">Loading...</p>
            </div>
        `;
        
        this.startClock();
        console.log("Clock Plugin Mounted");
    }

    startClock() {
        const update = () => {
            const now = new Date();
            const timeEl = this.element.querySelector('#clock-time');
            const dateEl = this.element.querySelector('#clock-date');
            
            if (timeEl) timeEl.innerText = now.toLocaleTimeString();
            if (dateEl) dateEl.innerText = now.toLocaleDateString();
        };
        
        update();
        this.interval = setInterval(update, 1000);
    }

    unmount() {
        if (this.interval) clearInterval(this.interval);
        this.element.innerHTML = '';
    }
}
