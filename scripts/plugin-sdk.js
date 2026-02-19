// scripts/plugin-sdk.js

/**
 * Plugin Platform SDK
 * Handles plugin registration, communication, and lifecycle management.
 */

const registeredPlugins = new Map();
const pluginInstances = new Map();
let currentMode = 'runtime'; // 'runtime' | 'edit'

export const PluginAPI = {
    /**
     * Register a plugin implementation
     * @param {string} pluginId - The unique ID from plugin.json
     * @param {object} implementation - The plugin implementation object
     */
    register: (pluginId, implementation) => {
        console.log(`[PluginSDK] Registering plugin: ${pluginId}`);
        if (registeredPlugins.has(pluginId)) {
            console.warn(`[PluginSDK] Plugin ${pluginId} already registered.`);
            return;
        }
        registeredPlugins.set(pluginId, implementation);
    },

    /**
     * Get host capabilities and API
     */
    getHostApi: () => {
        return {
            mode: () => currentMode,
            saveLayout: async (layout) => {
                // Call main.js or backend wrapper to save
                return await fetch('http://127.0.0.1:35678/api/layout/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(layout)
                });
            },
            toast: (msg) => {
                // Assuming showToast is globally available or we import it
                if (window.showToast) window.showToast(msg);
                else console.log(`[Toast] ${msg}`);
            },
            // Event subscription placeholder
            on: (event, callback) => {
                document.addEventListener(`plugin:${event}`, callback);
            },
            emit: (event, data) => {
                document.dispatchEvent(new CustomEvent(`plugin:${event}`, { detail: data }));
            }
        };
    },

    /**
     * Initialize all plugins
     * @param {Array} manifestList - List of loaded plugin manifests
     * @param {Object} context - Shared context (e.g. backendUrl)
     */
    initPlugins: async (manifestList, context = {}) => {
        for (const manifest of manifestList) {
            const Impl = registeredPlugins.get(manifest.id);
            if (Impl) {
                try {
                    // Create instance with manifest AND context
                    const instance = new Impl(manifest, context);
                    pluginInstances.set(manifest.id, instance);
                    
                    // Mount if it's a widget
                    if (manifest.type === 'widget' || manifest.capabilities?.includes('widget')) {
                        const container = document.createElement('div');
                        container.id = `plugin-${manifest.id.replace(/\./g, '-')}`;
                        container.classList.add('plugin-container');
                        container.dataset.pluginId = manifest.id;
                        
                        // Initial Styles from manifest or storage
                        if (manifest.defaultPosition) {
                            container.style.left = manifest.defaultPosition.x + 'px';
                            container.style.top = manifest.defaultPosition.y + 'px';
                            container.style.width = manifest.defaultPosition.width + 'px';
                            container.style.height = manifest.defaultPosition.height + 'px';
                        }

                        document.body.appendChild(container);
                        
                        // Apply current mode state immediately
                        if (currentMode === 'edit') {
                            container.classList.add('edit-mode');
                             // Removed: Explicit drag handle creation is optional now since we drag whole container
                             // But kept for visual indication if needed
                             if (!container.querySelector('.drag-handle')) {
                                const handle = document.createElement('div');
                                handle.className = 'drag-handle';
                                handle.innerText = 'DRIVER'; // Clearer text
                                container.appendChild(handle);
                             }
                        }

                        if (instance.mount) {
                            await instance.mount(container);
                        }
                    } else if (instance.init) {
                        await instance.init();
                    }
                } catch (e) {
                    console.error(`[PluginSDK] Failed to init ${manifest.id}:`, e);
                }
            }
        }
    },
    
    setMode: (mode) => {
        currentMode = mode;
        const event = new CustomEvent('plugin:mode-change', { detail: { mode } });
        document.dispatchEvent(event);
        
        // Update classes on containers
        document.querySelectorAll('.plugin-container').forEach(el => {
            if (mode === 'edit') {
                el.classList.add('edit-mode');
                // Ensure drag handle exists
                if (!el.querySelector('.drag-handle')) {
                    const handle = document.createElement('div');
                    handle.className = 'drag-handle';
                    handle.innerText = '⋮⋮';
                    el.appendChild(handle);
                }
            } else {
                el.classList.remove('edit-mode');
            }
        });
    }
};

// Global Exposure for simpler plugin scripts
window.PluginAPI = PluginAPI;
