import os
import sys
import json
import ctypes
import subprocess
import winreg
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import mimetypes
try:
    import psutil
except ImportError:
    print("Installing psutil...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
    import psutil
import time
import threading
from datetime import datetime

# PyQt Imports for Integrated GUI Support
from PyQt6.QtWidgets import QApplication, QFileDialog
from PyQt6.QtCore import QObject, pyqtSignal, pyqtSlot
from memo_gui import MemoWindow
from goals_gui import GoalsWindow
from pomo_gui import PomodoroSettingsWindow
from plugin_manager import PluginManager

# ================= Configuration =================
PORT = 35678
# Determine working directory (handle PyInstaller frozen state)
if getattr(sys, 'frozen', False):
    WORKING_DIR = os.path.dirname(sys.executable)
    PLUGINS_DIR = os.path.join(WORKING_DIR, 'plugins')
else:
    WORKING_DIR = os.path.dirname(os.path.abspath(__file__))
    # Go up one level from backend_python to root, then plugins
    PLUGINS_DIR = os.path.join(os.path.dirname(WORKING_DIR), 'plugins')

CONFIG_FILE = os.path.join(WORKING_DIR, 'user_config.json')

DEFAULT_CONFIG = {
    "apps": [], 
    "memos": [], # Stores {id, text, due_date, done}
    "dailyGoals": {"date": "", "items": []}, # New Daily Goals
    "musicPath": "",
    "autoStart": False,
    "debug": False, # Debug toggle
    "layout": [] # Plugin Layout
}

app = Flask(__name__, static_folder=PLUGINS_DIR) # Serve plugins statically if needed, or see routes below
CORS(app)  # Enable CORS for all routes

# Initialize Plugin Manager
plugin_manager = PluginManager(PLUGINS_DIR)



# ================= GUI Manager (Bridge) =================
class GuiManager(QObject):
    # Signals to Main Thread
    open_editor_signal = pyqtSignal(dict)
    pick_file_signal = pyqtSignal()
    open_goals_signal = pyqtSignal(list)
    open_pomodoro_signal = pyqtSignal(dict)

    def __init__(self):
        super().__init__()
        self.active_window = None
        self.goals_window = None
        self.pomodoro_window = None
        # State tracking: keys 'memo', 'goals', 'pomodoro' -> value: boolean (is_open)
        self.status = {'memo': False, 'goals': False, 'pomodoro': False}
        self.file_picker_result = None
        self.file_picker_event = threading.Event()
        
        # Connect signals
        self.open_editor_signal.connect(self.show_editor_slot)
        self.pick_file_signal.connect(self.show_file_picker_slot)
        self.open_goals_signal.connect(self.show_goals_editor_slot)
        self.open_pomodoro_signal.connect(self.show_pomodoro_slot)

    @pyqtSlot(dict)
    def show_editor_slot(self, data):
        self.status['memo'] = True
        
        def on_save(memo_data):
            self.update_memo(memo_data)
        def on_delete(memo_id):
            self.delete_memo_internal(memo_id)

        if self.active_window:
            self.active_window.close()
            
        self.active_window = MemoWindow(data, on_save, on_delete)
        
        # Detect Close
        original_close = self.active_window.closeEvent
        def wrapped_close(event):
            self.status['memo'] = False # Mark closed
            if original_close: original_close(event)
            else: event.accept()
        self.active_window.closeEvent = wrapped_close
        
        self.active_window.show()
        self.active_window.activateWindow()
        self.active_window.raise_()

    @pyqtSlot(list)
    def show_goals_editor_slot(self, items):
        self.status['goals'] = True
        
        def on_save(new_items):
             print(f"Goals Saved: {len(new_items)}")
             self.update_goals_internal(new_items)

        if self.goals_window:
            self.goals_window.close()
            
        self.goals_window = GoalsWindow(items, on_save)
        
        # Monkey patch
        original_close = self.goals_window.closeEvent
        def wrapped_close(event):
            print("Goals Window Closing...")
            # Auto-save
            if hasattr(self.goals_window, 'items'):
                on_save(self.goals_window.items)
            
            self.status['goals'] = False # Mark closed
            
            if original_close: original_close(event)
            else: event.accept()
        self.goals_window.closeEvent = wrapped_close
        
        self.goals_window.show()
        self.goals_window.activateWindow()
        self.goals_window.raise_()

    @pyqtSlot(dict)
    def show_pomodoro_slot(self, config_data):
        self.status['pomodoro'] = True
        
        def on_save(new_config):
            self.update_pomodoro_internal(new_config)

        if self.pomodoro_window:
            self.pomodoro_window.close()
            
        self.pomodoro_window = PomodoroSettingsWindow(config_data, on_save)
        
        # Monkey patch close event
        original_close = self.pomodoro_window.closeEvent
        def wrapped_close(event):
            self.status['pomodoro'] = False
            if original_close: original_close(event)
            else: event.accept()
        self.pomodoro_window.closeEvent = wrapped_close
        
        self.pomodoro_window.show()
        self.pomodoro_window.activateWindow()
        self.pomodoro_window.raise_()

    @pyqtSlot()
    def show_file_picker_slot(self):
        filename, _ = QFileDialog.getOpenFileName(None, "Select File", "", "All Files (*)")
        self.file_picker_result = filename
        self.file_picker_event.set()

    # --- Logic Helpers ---
    def update_memo(self, data):
        config = load_config()
        memos = config.get("memos", [])
        
        if not data.get("id"):
            new_id = int(time.time() * 1000)
            data["id"] = new_id
            memos.append(data)
        else:
            found = False
            for i, m in enumerate(memos):
                if m.get("id") == data.get("id"):
                    memos[i] = data
                    found = True
                    break
            if not found:
                memos.append(data)
                
        config["memos"] = memos
        save_config(config)
        print(f"Memo saved: {data.get('id')}")

    def delete_memo_internal(self, memo_id):
        config = load_config()
        memos = config.get("memos", [])
        config["memos"] = [m for m in memos if m.get("id") != memo_id]
        save_config(config)
        print(f"Memo deleted: {memo_id}")

    def update_goals_internal(self, items):
        config = load_config()
        if "dailyGoals" not in config or not isinstance(config["dailyGoals"], dict):
             # Initialize with today's date to prevent frontend wipe
             today_str = datetime.now().strftime("%Y-%m-%d")
             config["dailyGoals"] = {"date": today_str, "items": []}
        
        # Ensure we don't save a broken structure that frontend wipes
        if not config["dailyGoals"].get("date"):
             config["dailyGoals"]["date"] = datetime.now().strftime("%Y-%m-%d")

        print(f"DEBUG: Saving {len(items)} items to config.")
        config["dailyGoals"]["items"] = items
        save_config(config)

    def update_pomodoro_internal(self, new_config):
        config = load_config()
        config["pomodoroConfig"] = new_config
        save_config(config)
        print("Pomodoro settings saved")


# Global instance
gui_manager = None


# ================= System Utilities =================

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading config: {e}")
            return DEFAULT_CONFIG
    return DEFAULT_CONFIG

def save_config(data):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def set_autostart(enable):
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    app_name = "LiquidWallpaperBackend"
    exe_path = sys.executable
    
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
        if enable:
            winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe_path)
            print("Auto-start enabled")
        else:
            try:
                winreg.DeleteValue(key, app_name)
                print("Auto-start disabled")
            except FileNotFoundError:
                pass 
        winreg.CloseKey(key)
    except Exception as e:
        print(f"Registry error: {e}")

# Media Keys using ctypes (Low level Windows API)
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
VK_MEDIA_PLAY_PAUSE = 0xB3
KEYEVENTF_KEYUP = 0x0002

def press_media_key(vk_code):
    user32 = ctypes.windll.user32
    # Press
    user32.keybd_event(vk_code, 0, 0, 0)
    # Release
    user32.keybd_event(vk_code, 0, KEYEVENTF_KEYUP, 0)
# Global Server State
SERVER_STATE = {
    "edit_mode": False
}

# ================= Plugin Routes =================
@app.route('/api/system/mode', methods=['POST'])
def set_system_mode():
    data = request.json
    mode = data.get('mode', 'runtime')
    SERVER_STATE['edit_mode'] = (mode == 'edit')
    return jsonify({"success": True, "mode": mode})

@app.route('/plugins/<path:filename>')
def serve_plugins(filename):
    return send_file(os.path.join(PLUGINS_DIR, filename))

@app.route('/api/plugins', methods=['GET'])
def list_plugins():
    plugins = plugin_manager.discover_plugins()
    return jsonify(plugins)

@app.route('/api/layout/update', methods=['POST'])
def update_layout():
    # Helper to load/save config safely
    config = load_config()
    
    if not config.get('editMode', False):
        return jsonify({"status": "error", "message": "Server is not in edit mode (editMode=False in config)"}), 403

    try:
        data = request.json
        new_layout = data.get('layout', [])
        
        valid, conflicts = plugin_manager.validate_layout_no_overlap(new_layout)
        
        if not valid:
            return jsonify({
                "status": "error",
                "message": "Layout overlap detected",
                "conflicts": conflicts
            }), 400
            
        # Helper to load/save config safely
        config = load_config()
        config['layout'] = new_layout
        save_config(config)
        
        return jsonify({"status": "success", "layout": new_layout})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
# ================= Routes =================

@app.route('/proxy/image', methods=['GET'])
def proxy_image():
    path = request.args.get('path', '')
    if not path or not os.path.exists(path):
        return "Image not found", 404
    
    # Check mime type
    mime_type, _ = mimetypes.guess_type(path)
    if not mime_type:
        mime_type = 'application/octet-stream'
        
    return send_file(path, mimetype=mime_type)

@app.route('/config', methods=['GET'])
def get_config():
    return jsonify(load_config())

@app.route('/config', methods=['POST'])
def update_config():
    data = request.json
    save_config(data)
    # Handle autostart logic
    set_autostart(data.get('autoStart', False))
    return jsonify({"success": True})

@app.route('/media/<action>', methods=['GET'])
def media_control(action):
    print(f"Media action: {action}")
    if action == 'play':
        press_media_key(VK_MEDIA_PLAY_PAUSE)
    elif action == 'next':
        press_media_key(VK_MEDIA_NEXT_TRACK)
    elif action == 'prev':
        press_media_key(VK_MEDIA_PREV_TRACK)
    return jsonify({"success": True})

@app.route('/launch', methods=['GET'])
def launch_app():
    target_path = request.args.get('path', '')
    if not target_path:
        return jsonify({"error": "Empty path"}), 400
    
    # Normalize path
    target_path = os.path.normpath(target_path)
    work_dir = os.path.dirname(target_path)
    
    print(f"Launching: {target_path} in {work_dir}")
    
    try:
        # Use subprocess.Popen to launch detached
        # shell=False is safer, but shell=True might be needed for file associations (URL, files)
        # However, for EXEs, direct execution is better. 
        # Using os.startfile for maximum Windows compatibility (handles URLs, docs, exes)
        os.startfile(target_path)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Launch failed: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/system/pick-file', methods=['GET'])
def pick_file():
    global gui_manager
    if not gui_manager:
        return jsonify({"error": "GUI not initialized"}), 500
        
    # Reset event
    gui_manager.file_picker_event.clear()
    gui_manager.pick_file_signal.emit() # Signal main thread
    
    # Wait for result
    gui_manager.file_picker_event.wait()
    
    path = gui_manager.file_picker_result
    return jsonify({"path": path})

# ================= Stats API =================
@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        return jsonify({"cpu": cpu, "ram": mem})
    except Exception as e:
        return jsonify({"cpu": 0, "ram": 0})

# ================= Memos API =================
@app.route('/api/memos', methods=['GET'])
def get_memos():
    config = load_config()
    return jsonify(config.get("memos", []))

@app.route('/api/memos', methods=['POST'])
def save_memo():
    data = request.json
    config = load_config()
    memos = config.get("memos", [])
    
    # Clean incoming data to ensure flags exist
    # If ddl changed or reminder enabled, reset shown flag
    
    memo_id = data.get("id")
    current_time_ms = int(time.time() * 1000)
    
    if not memo_id:
        # NEW MEMO
        memo_id = current_time_ms
        data['id'] = memo_id
        # Init reset flag
        data['reminderShown'] = False
        memos.append(data)
    else:
        # Update existing
        found = False
        for i, m in enumerate(memos):
            if m.get("id") == memo_id:
                # Check if crucial fields changed to reset reminder
                old_date = m.get("dueDate")
                new_date = data.get("dueDate")
                
                # Check logic: If user pushes date forward, or re-enables reminder, reset
                if (new_date != old_date) or (data.get("enableReminder") and not m.get("enableReminder")):
                    data['reminderShown'] = False
                else:
                    # Keep existing state if not provided in payload (though typical logic sends all)
                    # Use existing state if not explicitly reset above
                    data['reminderShown'] = m.get('reminderShown', False)
                
                memos[i] = data
                found = True
                break
        if not found:
            data['reminderShown'] = False
            memos.append(data)
            
    config["memos"] = memos
    save_config(config)
    return jsonify({"success": True, "memos": memos})

# ================= Background Reminder Thread =================
def reminder_worker():
    print("Background Reminder Worker Started")
    while True:
        try:
            config = load_config()
            memos = config.get("memos", [])
            updated = False
            now = datetime.now()
            
            for m in memos:
                # Check conditions: Has Date, Reminder Enabled, Not already shown, AND Not Done
                if m.get("dueDate") and m.get("enableReminder") and not m.get("reminderShown", False) and not m.get("done", False):
                    try:
                        # Parse "2026-01-20T16:45"
                        # The input type="datetime-local" format is ISO like without Z
                        ddl_str = m.get("dueDate")
                        ddl_dt = datetime.fromisoformat(ddl_str)
                        
                        # Trigger if NOW >= DDL
                        if now >= ddl_dt:
                            # Show Alert
                            title = m.get("title", "Memo Reminder")
                            content = m.get("content", m.get("text", "No Content"))
                            text_content = f"{title}\n\n{content}"
                            ctypes.windll.user32.MessageBoxW(0, text_content, "Wallpaper Engine Memo", 0x40 | 0x1)
                            
                            # Mark as shown
                            m['reminderShown'] = True
                            updated = True
                            
                    except Exception as e:
                        print(f"Date parse error: {e}")
                        
            if updated:
                config["memos"] = memos
                save_config(config)
                
        except Exception as e:
            print(f"Worker Error: {e}")
            
        time.sleep(5) # Check every 5 seconds

# Start Thread
t = threading.Thread(target=reminder_worker, daemon=True)
t.start()

@app.route('/api/memos/delete', methods=['POST'])
def delete_memo():
    data = request.json
    memo_id = data.get("id")
    config = load_config()
    memos = config.get("memos", [])
    
    config["memos"] = [m for m in memos if m.get("id") != memo_id]
    save_config(config)
    return jsonify({"success": True, "memos": config["memos"]})

@app.route('/api/memos/open_editor', methods=['POST'])
def open_editor():
    data = request.json
    global gui_manager
    if gui_manager:
        gui_manager.open_editor_signal.emit(data)
        return jsonify({"success": True})
    else:
        return jsonify({"error": "GUI Manager not active"}), 500

@app.route('/api/goals/open_editor', methods=['POST'])
def open_goals_editor():
    global gui_manager
    if gui_manager:
        config = load_config()
        items = config.get("dailyGoals", {}).get("items", [])
        
        gui_manager.open_goals_signal.emit(items)
        return jsonify({"success": True})
    else:
        return jsonify({"error": "GUI Manager not active"}), 500

@app.route('/api/pomodoro/open_editor', methods=['POST'])
def open_pomodoro_editor():
    global gui_manager
    if gui_manager:
        config = load_config()
        # Default config if missing
        pomo_config = config.get("pomodoroConfig", {
            "work": 25, 
            "rest": 5, 
            "presets": []
        })
        
        gui_manager.open_pomodoro_signal.emit(pomo_config)
        return jsonify({"success": True})
    else:
        return jsonify({"error": "GUI Manager not active"}), 500

@app.route('/api/system/wait_for_close', methods=['GET'])
def wait_for_close():
    target_type = request.args.get('type')
    global gui_manager
    if not gui_manager:
        return jsonify({"error": "No GUI"}), 500
    
    # Simple Polling within this request (Long Polling)
    # Check every 0.5s for 30s
    for _ in range(60):
        if not gui_manager.status.get(target_type, False):
            return jsonify({"closed": True})
        time.sleep(0.5)
        
    return jsonify({"closed": False}) # Timeout, still open

@app.route('/api/system/editor_status', methods=['GET'])
def get_editor_status():
    global gui_manager
    if gui_manager:
        return jsonify(list(gui_manager.open_editors))
    return jsonify([])

@app.route('/api/goals/update_items', methods=['POST'])
def update_goals_items():
    data = request.json
    new_items = data.get("items", [])
    
    config = load_config()
    if "dailyGoals" not in config or not isinstance(config["dailyGoals"], dict):
         config["dailyGoals"] = {"date": "", "items": []}
         
    config["dailyGoals"]["items"] = new_items
    save_config(config)
    return jsonify({"success": True})

@app.route('/system/stop', methods=['POST'])
def stop_server():
    """
    Shuts down the server and the PyQt application.
    Expected to be called from the frontend.
    """
    try:
        # Use os._exit(0) to forcefully terminate the process immediately.
        # This is necessary because app.quit() might just stop the event loop
        # but the Flask thread or other daemon threads might keep the process "zombie"
        # or there might be cleanup handlers delaying exit.
        # For a "kill switch" like this, _exit is appropriate.
        def kill():
            time.sleep(1) # Give time for the response to revert to client
            os._exit(0)
        
        # Run in a separate thread so we can return the response first
        threading.Thread(target=kill).start()
        
        return jsonify({"success": True, "message": "Server shutting down..."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 1. Initialize Qt Application (Must be in Main Thread)
    app_qt = QApplication(sys.argv)
    app_qt.setQuitOnLastWindowClosed(False) # Keep running when windows close
    
    # 2. Init GUI Manager
    gui_manager = GuiManager()
    
    # 3. Start Flask in Background Thread
    def run_flask():
        # debug=False, use_reloader=False is crucial for threading
        app.run(host='127.0.0.1', port=PORT, debug=False, use_reloader=False)
        
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    print(f"Backend & GUI Service Started on port {PORT}...")
    
    # 4. Start Qt Event Loop (Blocking)
    sys.exit(app_qt.exec())
