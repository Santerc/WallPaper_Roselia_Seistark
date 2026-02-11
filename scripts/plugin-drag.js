// scripts/plugin-drag.js

export class PluginDragManager {
    constructor(containerSelector = '.plugin-container') {
        this.containerSelector = containerSelector;
        this.draggingEl = null;
        this.offset = { x: 0, y: 0 };
        this.initialPos = { left: 0, top: 0 };
        this.isDragging = false;
        
        this.init();
    }

    init() {
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Initial state check
        if (window.PluginAPI) {
            this.isEnabled = window.PluginAPI.getHostApi().mode() === 'edit';
        }

        // Listen for mode changes to enable/disable interaction
        document.addEventListener('plugin:mode-change', (e) => {
            this.isEnabled = e.detail.mode === 'edit';
        });
    }

    handleMouseDown(e) {
        // console.log("MouseDown", e.target, "Enabled:", this.isEnabled); // Debug
        if (!this.isEnabled) return;
        
        // Allow dragging from anywhere in the container in edit mode
        const container = e.target.closest(this.containerSelector);
        if (!container) return;

        // If clicking a specific interactive element inside (like an input), maybe don't drag?
        // But in edit mode, we usually want to move it.
        // Let's prevent default only if we found a container
        
        this.isDragging = true;
        this.draggingEl = container;
        this.draggingEl.classList.add('is-dragging');

        const rect = this.draggingEl.getBoundingClientRect();
        this.offset.x = e.clientX - rect.left;
        this.offset.y = e.clientY - rect.top;
        
        this.initialPos = {
            left: parseFloat(this.draggingEl.style.left) || rect.left,
            top: parseFloat(this.draggingEl.style.top) || rect.top
        };

        // Prevent text selection
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.draggingEl) return;

        let newX = e.clientX - this.offset.x;
        let newY = e.clientY - this.offset.y;

        // Boundary checks (Screen)
        const maxX = window.innerWidth - this.draggingEl.offsetWidth;
        const maxY = window.innerHeight - this.draggingEl.offsetHeight;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        this.draggingEl.style.left = `${newX}px`;
        this.draggingEl.style.top = `${newY}px`;

        this.checkCollisions(this.draggingEl);
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;

        const hasCollision = this.checkCollisions(this.draggingEl);

        if (hasCollision) {
            // Revert
            this.draggingEl.style.left = `${this.initialPos.left}px`;
            this.draggingEl.style.top = `${this.initialPos.top}px`;
            this.showVisualCue(this.draggingEl, 'invalid');
        } else {
            // Save prompt
             this.showVisualCue(this.draggingEl, 'valid');
             // Trigger save event
             this.saveLayout();
        }

        this.draggingEl.classList.remove('is-dragging');
        this.draggingEl = null;
        this.isDragging = false;
        
        // clear collision highlights
        document.querySelectorAll('.collision-warning').forEach(el => el.classList.remove('collision-warning'));
    }

    checkCollisions(targetEl) {
        const targetRect = targetEl.getBoundingClientRect();
        let collided = false;

        const allPlugins = document.querySelectorAll(this.containerSelector);
        allPlugins.forEach(otherEl => {
            if (otherEl === targetEl) return;

            const otherRect = otherEl.getBoundingClientRect();

            // AABB Collision
            const isColliding = !(
                targetRect.right < otherRect.left || 
                targetRect.left > otherRect.right || 
                targetRect.bottom < otherRect.top || 
                targetRect.top > otherRect.bottom
            );

            if (isColliding) {
                collided = true;
                otherEl.classList.add('collision-warning');
            } else {
                otherEl.classList.remove('collision-warning');
            }
        });
        
        if (collided) {
            targetEl.classList.add('collision-active');
        } else {
            targetEl.classList.remove('collision-active');
        }

        return collided;
    }
    
    showVisualCue(element, status) {
        // Simple animation class logic
        const cls = status === 'valid' ? 'snap-success' : 'snap-fail';
        element.classList.add(cls);
        setTimeout(() => element.classList.remove(cls), 500);
    }

    async saveLayout() {
        const layout = [];
        document.querySelectorAll(this.containerSelector).forEach(el => {
            layout.push({
                id: el.dataset.pluginId,
                x: parseInt(el.style.left, 10),
                y: parseInt(el.style.top, 10),
                w: el.offsetWidth,
                h: el.offsetHeight
            });
        });

        // Call SDK save
        if(window.PluginAPI && window.PluginAPI.getHostApi().saveLayout) {
             try {
                const res = await window.PluginAPI.getHostApi().saveLayout({ layout });
                if (!res.ok) throw new Error('Backend rejected layout');
             } catch(e) {
                 console.error("Save failed", e);
                 // Ideally revert UI if save fails
             }
        }
    }
}
