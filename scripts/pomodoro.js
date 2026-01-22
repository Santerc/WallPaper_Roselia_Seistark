import { BACKEND_URL } from './config.js';
import { fetchConfig } from './backend.js';

let pomoState = 'idle'; // idle, work, rest
let pomoEndTime = 0;
let pomoDuration = 0;
let pomoInterval = null;

// Configurable settings
let WORK_MINS = 25;
let REST_MINS = 5;

// SVG Circumference: 2 * PI * 48 ≈ 301.6
const RING_CIRCUMFERENCE = 301.6;

// Init function to be called from main.js
export async function initPomodoro() {
    console.log("Initializing Pomodoro...");
    
    // Load config
    try {
        const config = await fetchConfig();
        if (config.pomodoroConfig) {
            WORK_MINS = config.pomodoroConfig.work || 25;
            REST_MINS = config.pomodoroConfig.rest || 5;
        }
    } catch (e) {
        console.error("Failed to load pomo config", e);
    }

    // Attach Click Listener for Settings Button
    const widget = document.querySelector('.widget-time');
    // Remove right click override if it was there - or just don't add it.
    
    const settingsBtn = document.getElementById('pomo-settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPomoSettings();
        });
    }
}

// Function to call backend to open settings
async function openPomoSettings() {
    try {
        console.log("Requesting backend to open Pomo Settings...");
        const res = await fetch(`${BACKEND_URL}/api/pomodoro/open_editor`, {
            method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
            console.log("Opened Pomo Settings");
        } else {
            console.error("Backend failed to open settings:", data.error);
        }
    } catch (e) {
        console.error("Error opening settings", e);
    }
}

export function togglePomodoro() {
    // Re-fetch settings on start just in case? Or too slow?
    // Let's rely on cached values for responsiveness, 
    // but maybe refresh them asynchronously for next time.
    reloadSettings().then(() => {
         if (pomoState === 'idle') {
            startPomoSession('work');
        } else if (pomoState === 'work') {
            stopPomoSession();
        } else if (pomoState === 'rest') {
            stopPomoSession();
        }
    });
}

async function reloadSettings() {
    try {
        const config = await fetchConfig();
        if (config.pomodoroConfig) {
            WORK_MINS = config.pomodoroConfig.work || WORK_MINS;
            REST_MINS = config.pomodoroConfig.rest || REST_MINS;
        }
    } catch(e) {}
}

function startPomoSession(mode) {
    pomoState = mode;
    const mins = mode === 'work' ? WORK_MINS : REST_MINS;
    pomoDuration = mins * 60 * 1000;
    pomoEndTime = Date.now() + pomoDuration;
    
    const widget = document.querySelector('.widget-time');
    widget.classList.add('pomo-active');
    if (mode === 'rest') widget.classList.add('rest-mode');
    else widget.classList.remove('rest-mode');
    
    updatePomoVisuals();
    
    if (pomoInterval) clearInterval(pomoInterval);
    pomoInterval = setInterval(updatePomoTimer, 1000);
    
    // Immediate update
    updatePomoTimer();
}

function stopPomoSession() {
    pomoState = 'idle';
    if (pomoInterval) clearInterval(pomoInterval);
    
    const ring = document.getElementById('pomo-ring');
    const widget = document.querySelector('.widget-time');
    
    widget.classList.remove('pomo-active');
    widget.classList.remove('rest-mode');
    if(ring) ring.style.strokeDasharray = `0, ${RING_CIRCUMFERENCE}`; 
    
    const statusEl = document.getElementById('pomo-status');
    if(statusEl) statusEl.innerText = "";
}

function updatePomoTimer() {
    const now = Date.now();
    const diff = pomoEndTime - now;
    
    if (diff <= 0) {
        if (pomoState === 'work') {
            startPomoSession('rest');
        } else {
            stopPomoSession();
        }
        return;
    }
    
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    const statusEl = document.getElementById('pomo-status');
    if(statusEl) statusEl.innerText = `${pomoState.toUpperCase()} ${timeStr}`;
    
    updatePomoVisuals(diff);
}

function updatePomoVisuals(remaining = pomoDuration) {
    const ring = document.getElementById('pomo-ring');
    if(!ring) return;
    
    const progress = remaining / pomoDuration; 
    const length = RING_CIRCUMFERENCE * progress;
    ring.style.strokeDasharray = `${length}, ${RING_CIRCUMFERENCE}`;
}
