import os
import sys
import json
import ctypes
import subprocess
import winreg
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tkinter as tk
from tkinter import filedialog
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

# ================= Configuration =================
PORT = 35678
# Determine working directory (handle PyInstaller frozen state)
if getattr(sys, 'frozen', False):
    WORKING_DIR = os.path.dirname(sys.executable)
else:
    WORKING_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_FILE = os.path.join(WORKING_DIR, 'user_config.json')

DEFAULT_CONFIG = {
    "apps": [], 
    "memos": [], # Stores {id, text, due_date, done}
    "musicPath": "",
    "autoStart": False
}

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

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
    file_filter_str = request.args.get('filter', 'All Files (*.*)|*.*')
    
    # Convert "BitMap (*.bmp;*.dib)|*.bmp;*.dib" -> [("BitMap", "*.bmp;*.dib")]
    # Simple parsing logic for tkinter
    file_types = []
    if '|' in file_filter_str:
        parts = file_filter_str.split('|')
        for i in range(0, len(parts), 2):
            if i+1 < len(parts):
                desc = parts[i]
                exts = parts[i+1] # ".exe;.bat"
                # Tkinter expects ("Description", "*.ext") or ("Description", (".ext1", ".ext2"))
                # But a simple string "*.exe" usually works or space separated
                exts_fixed = exts.replace(';', ' ') 
                file_types.append((desc, exts_fixed))
    
    # Run Tkinter in a separate thread context or just quickly initialize
    root = tk.Tk()
    root.withdraw() # Hide main window
    root.attributes('-topmost', True) # Bring to front
    
    file_path = filedialog.askopenfilename(filetypes=file_types)
    
    root.destroy()
    
    return jsonify({"path": file_path})

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
                # Check conditions: Has Date, Reminder Enabled, Not already shown
                if m.get("dueDate") and m.get("enableReminder") and not m.get("reminderShown", False):
                    try:
                        # Parse "2026-01-20T16:45"
                        # The input type="datetime-local" format is ISO like without Z
                        ddl_str = m.get("dueDate")
                        ddl_dt = datetime.fromisoformat(ddl_str)
                        
                        # Trigger if NOW >= DDL
                        if now >= ddl_dt:
                            # Show Alert
                            text_content = m.get("text", "No Content")
                            ctypes.windll.user32.MessageBoxW(0, f"Memo Reminder:\n\n{text_content}", "Wallpaper Engine Memo", 0x40 | 0x1)
                            
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
    # Launch subprocess detached
    # Passing data as JSON string argument
    data_str = json.dumps(data)
    
    try:
        # Determine executable path: 
        # If frozen (PyInstaller), sys.executable is the EXE.
        # If script, sys.executable is python.exe, and we need to pass the script path.
        if getattr(sys, 'frozen', False):
            # EXE Mode: output.exe --gui "{\"json\":...}"
            cmd = [sys.executable, "--gui", data_str]
        else:
            # Script Mode: python server.py --gui "{\"json\":...}"
            cmd = [sys.executable, __file__, "--gui", data_str]

        subprocess.Popen(cmd, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # --- GUI Launch Logic ---
    if len(sys.argv) > 1 and sys.argv[1] == '--gui':
        try:
            # Import strictly inside the guard to prevent early PyQt init during server startup
            from memo_gui import run_editor
            
            # Data is the last argument or second argument
            data_arg = sys.argv[-1] if len(sys.argv) > 2 else "{}"
            run_editor(data_arg)
        except Exception as e:
            with open("gui_error.log", "w") as f:
                f.write(str(e))
        sys.exit(0)
    # ------------------------

    print(f"Starting Python Backend on port {PORT}...")
    # host='0.0.0.0' allows external access, but '127.0.0.1' is safer for local wallpaper
    app.run(host='127.0.0.1', port=PORT)
