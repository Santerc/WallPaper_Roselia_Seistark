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

# ================= Configuration =================
PORT = 35678
# Determine working directory (handle PyInstaller frozen state)
if getattr(sys, 'frozen', False):
    WORKING_DIR = os.path.dirname(sys.executable)
else:
    WORKING_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_FILE = os.path.join(WORKING_DIR, 'user_config.json')

DEFAULT_CONFIG = {
    "apps": [], # New format
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

if __name__ == '__main__':
    print(f"Starting Python Backend on port {PORT}...")
    # host='0.0.0.0' allows external access, but '127.0.0.1' is safer for local wallpaper
    app.run(host='127.0.0.1', port=PORT)
