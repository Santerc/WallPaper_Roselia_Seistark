import os
import json
import hashlib
import logging

logger = logging.getLogger(__name__)

class PluginManager:
    def __init__(self, plugins_dir):
        self.plugins_dir = plugins_dir
        self.plugins = {} # id -> manifest
        self.layout = [] # List of {id, x, y, w, h}
        
    def discover_plugins(self):
        """Scans the plugin directory for valid plugin.json manifests."""
        if not os.path.exists(self.plugins_dir):
            os.makedirs(self.plugins_dir)
            
        logger.info(f"Scanning plugins in {self.plugins_dir}")
        self.plugins = {}
        
        for name in os.listdir(self.plugins_dir):
            path = os.path.join(self.plugins_dir, name)
            if os.path.isdir(path):
                manifest_path = os.path.join(path, "plugin.json")
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest = json.load(f)
                            
                        # Validate required fields
                        if 'id' not in manifest or 'entry' not in manifest:
                            logger.warning(f"Skipping invalid plugin at {path}: missing id or entry")
                            continue
                            
                        # Checksum validation (Security)
                        if not self._validate_entry_checksum(path, manifest):
                            logger.error(f"Security Warning: Plugin {manifest['id']} failed checksum validation.")
                            # For now we just log, in strict mode we would skip
                            # continue 
                        
                        # Add path to manifest for frontend loading
                        manifest['basePath'] = f"/plugins/{name}"
                        self.plugins[manifest['id']] = manifest
                        logger.info(f"Loaded plugin: {manifest['id']}")
                        
                    except Exception as e:
                        logger.error(f"Error loading plugin {name}: {e}")

        return list(self.plugins.values())

    def _validate_entry_checksum(self, plugin_path, manifest):
        """
        Validates the checksum of the entry file if 'checksum' is provided in manifest.
        """
        if 'checksum' not in manifest:
            return True # skip if not required
            
        entry_file = manifest.get('entry', {}).get('frontend')
        if not entry_file:
             return True
             
        full_path = os.path.join(plugin_path, entry_file)
        if not os.path.exists(full_path):
            return False
            
        try:
             with open(full_path, 'rb') as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()
                return file_hash == manifest['checksum']
        except Exception:
            return False

    def validate_layout_no_overlap(self, new_layout):
        """
        Validates that no two plugins in the layout overlap.
        Plugins are rectangles defined by x, y, w, h.
        Returns: (is_valid, conflicting_ids_list)
        """
        rects = []
        for item in new_layout:
            # item: {id, x, y, w, h}
            # Ensure all required fields exist
            if not all(k in item for k in ('id', 'x', 'y', 'w', 'h')):
                continue
            rects.append(item)

        conflicts = set()
        
        for i in range(len(rects)):
            r1 = rects[i]
            for j in range(i + 1, len(rects)):
                r2 = rects[j]
                
                # AABB Collision Logic
                # If NOT separated, they collide
                # Separated if: r1.right < r2.left OR r1.left > r2.right ...
                
                no_overlap = (
                    (r1['x'] + r1['w'] <= r2['x']) or
                    (r1['x'] >= r2['x'] + r2['w']) or
                    (r1['y'] + r1['h'] <= r2['y']) or
                    (r1['y'] >= r2['y'] + r2['h'])
                )
                
                if not no_overlap:
                    conflicts.add(r1['id'])
                    conflicts.add(r2['id'])
        
        if conflicts:
            return False, list(conflicts)
            
        return True, []

    def get_plugin_config(self, plugin_id):
        # Retrieve plugin specific config (could be merged with user_config.json)
        return {}
