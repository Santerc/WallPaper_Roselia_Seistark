import os
import sys
import json
import ctypes
import subprocess
import winreg
import asyncio
import base64
import threading
import time
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import mimetypes

# ── Windows SMTC (System Media Transport Controls) ──────────────────────────
# WinRT 要求运行在 STA（单线程公寓）线程上，不能直接在 Flask 路由里
# new_event_loop()，必须在专用线程里初始化 COM 后再跑 asyncio。
try:
    from winsdk.windows.media.control import \
        GlobalSystemMediaTransportControlsSessionManager as MediaManager
    from winsdk.windows.storage.streams import DataReader, Buffer, InputStreamOptions
    WINSDK_OK = True
except ImportError:
    WINSDK_OK = False
    print('[WARN] winsdk not installed; run: pip install winsdk')

# 全局缓存，后台线程写，Flask 路由读
_smtc_cache: dict = {'error': 'initializing'}
_smtc_lock  = threading.Lock()

async def _smtc_poll_once():
    """单次拉取 SMTC 数据，在专用 STA 线程中调用"""
    try:
        mgr = await MediaManager.request_async()
        cur = mgr.get_current_session()
        if not cur:
            return {'error': 'no active media session'}

        props    = await cur.try_get_media_properties_async()
        playback = cur.get_playback_info()
        timeline = cur.get_timeline_properties()

        # 封面
        thumb = None
        try:
            if props.thumbnail:
                stream = await props.thumbnail.open_read_async()
                sz  = stream.size
                buf = Buffer(sz)
                await stream.read_async(buf, sz, InputStreamOptions.READ_AHEAD)
                reader = DataReader.from_buffer(buf)
                raw    = bytearray(sz)
                reader.read_bytes(raw)
                thumb  = 'data:image/jpeg;base64,' + base64.b64encode(bytes(raw)).decode()
        except Exception as te:
            print(f'[SMTC] thumb: {te}')

        try:
            state_code = int(playback.playback_status)
        except Exception:
            state_code = 0
        state_str = {0:'closed',1:'opened',2:'changing',
                     3:'stopped',4:'playing',5:'paused'}.get(state_code, 'unknown')

        pos, dur = 0.0, 0.0
        try:
            pos = timeline.position.total_seconds()
            dur = timeline.max_seek_time.total_seconds()
        except Exception:
            pass

        return {
            'title':      props.title      or '',
            'artist':     props.artist     or '',
            'albumTitle': props.album_title or '',
            'thumbnail':  thumb,
            'state':      state_str,
            'stateCode':  state_code,
            'position':   round(pos, 2),
            'duration':   round(dur, 2),
        }
    except Exception as e:
        return {'error': str(e)}


def _smtc_background_thread():
    """
    专用 STA 线程：用 ctypes 初始化 COM STA，
    然后在此线程的 asyncio 事件循环中每 2 秒轮询 SMTC。
    """
    global _smtc_cache
    # 初始化 COM STA（COINIT_APARTMENTTHREADED = 0x2）
    COINIT_APARTMENTTHREADED = 0x2
    hr = ctypes.windll.ole32.CoInitializeEx(None, COINIT_APARTMENTTHREADED)
    if hr not in (0, 1):   # S_OK or S_FALSE(already init)
        print(f'[SMTC] CoInitializeEx failed: hr=0x{hr:08x}')

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def run():
        global _smtc_cache
        while True:
            result = await _smtc_poll_once()
            with _smtc_lock:
                _smtc_cache = result
            await asyncio.sleep(2)

    try:
        loop.run_until_complete(run())
    finally:
        ctypes.windll.ole32.CoUninitialize()

if WINSDK_OK:
    _t = threading.Thread(target=_smtc_background_thread, daemon=True, name='smtc-poll')
    _t.start()
    print('[SMTC] 后台轮询线程已启动')

# ── 窗口标题回退：解析常见播放器的窗口标题 ──────────────────────────────────
# 当 SMTC 不可用时（老版本播放器未注册 SMTC），通过枚举窗口标题提取曲目信息

import re as _re

# 播放器进程名 → 解析规则
# 格式: (regex, source_tag)
# cloudmusic 标题两种格式：
#   "曲名 - 歌手 - 网易云音乐"（暂停时）
#   "曲名 - 歌手"              （播放时）
_PLAYER_RULES = {
    'cloudmusic': (_re.compile(r'^(.+?)\s*-\s*(.+?)(?:\s*-\s*网易云音乐)?$'), 'netease'),
    'wmsxwd':     (_re.compile(r'^(.+?)\s*[-–]\s*(.+)'),                       'wmsxwd'),
    'qqmusic':    (_re.compile(r'^(.+?)\s*-\s*(.+?)(?:\s*-\s*QQ音乐)?$'),      'qqmusic'),
    'kugou':      (_re.compile(r'^(.+?)\s*-\s*(.+?)(?:\s*-\s*酷狗.*)?$'),      'kugou'),
    'music':      (_re.compile(r'^(.+?)\s*-\s*(.+)'),                          'generic'),
}

# 这些标题不含曲目信息，直接过滤掉
_TITLE_BLACKLIST = {'网易云音乐', 'QQ音乐', '酷狗音乐', '桌面歌词', 'wmsxwd', ''}

def _get_info_from_window_title():
    """枚举所有窗口，匹配已知播放器进程，解析标题"""
    import ctypes as _ct
    EnumWindows      = _ct.windll.user32.EnumWindows
    GetWindowText    = _ct.windll.user32.GetWindowTextW
    GetWindowTextLen = _ct.windll.user32.GetWindowTextLengthW
    IsWindowVisible  = _ct.windll.user32.IsWindowVisible
    GetWindowThreadProcessId = _ct.windll.user32.GetWindowThreadProcessId

    results = []

    @_ct.WINFUNCTYPE(_ct.c_bool, _ct.c_void_p, _ct.c_long)
    def callback(hwnd, _):
        if not IsWindowVisible(hwnd):
            return True
        length = GetWindowTextLen(hwnd)
        if length == 0:
            return True
        buf = _ct.create_unicode_buffer(length + 1)
        GetWindowText(hwnd, buf, length + 1)
        title = buf.value.strip()
        if not title:
            return True

        # 获取 PID → 进程名
        pid = _ct.c_ulong()
        GetWindowThreadProcessId(hwnd, _ct.byref(pid))
        try:
            proc = psutil.Process(pid.value)
            pname = proc.name().lower().replace('.exe', '')
        except Exception:
            return True

        for key, (pat, src) in _PLAYER_RULES.items():
            if key in pname:
                if title in _TITLE_BLACKLIST:
                    return True
                m = pat.match(title)
                if m:
                    results.append({
                        'title':  m.group(1).strip(),
                        'artist': m.group(2).strip(),
                        'source': src,
                        'raw':    title,
                    })
                    return True   # 找到一个就停止，避免 generic 规则重复匹配
        return True

    EnumWindows(callback, 0)
    return results[0] if results else None


try:
    import psutil
except ImportError:
    print("Installing psutil...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
    import psutil
from datetime import datetime

# PyQt Imports for Integrated GUI Support
from PyQt6.QtWidgets import QApplication, QFileDialog
from PyQt6.QtCore import QObject, pyqtSignal, pyqtSlot
from memo_gui import MemoWindow
from goals_gui import GoalsWindow
from pomo_gui import PomodoroSettingsWindow

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
    "dailyGoals": {"date": "", "items": []}, # New Daily Goals
    "musicPath": "",
    "autoStart": False,
    "debug": False # Debug toggle
}

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


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

# ── 媒体控制：SendInput + KEYEVENTF_EXTENDEDKEY ───────────────────────────────
VK_MEDIA_PLAY_PAUSE = 0xB3
VK_MEDIA_NEXT_TRACK = 0xB0
VK_MEDIA_PREV_TRACK = 0xB1
KEYEVENTF_KEYUP      = 0x0002
KEYEVENTF_EXTENDEDKEY = 0x0001
INPUT_KEYBOARD       = 1

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ('wVk',         ctypes.c_ushort),
        ('wScan',       ctypes.c_ushort),
        ('dwFlags',     ctypes.c_ulong),
        ('time',        ctypes.c_ulong),
        ('dwExtraInfo', ctypes.POINTER(ctypes.c_ulong)),
    ]

class _INPUT_UNION(ctypes.Union):
    _fields_ = [('ki', KEYBDINPUT)]

class INPUT(ctypes.Structure):
    _fields_ = [('type', ctypes.c_ulong), ('union', _INPUT_UNION)]

_user32 = ctypes.windll.user32

def send_media_key(vk):
    """用 SendInput + KEYEVENTF_EXTENDEDKEY 发送媒体键（不依赖焦点）"""
    def _make(flags):
        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp.union.ki.wVk = vk
        inp.union.ki.wScan = 0
        inp.union.ki.dwFlags = flags
        inp.union.ki.time = 0
        inp.union.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
        return inp
    press   = _make(KEYEVENTF_EXTENDEDKEY)
    release = _make(KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP)
    arr = (INPUT * 2)(press, release)
    _user32.SendInput(2, arr, ctypes.sizeof(INPUT))




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

@app.route('/media/status', methods=['GET'])
def media_status():
    """返回当前系统媒体信息：优先 SMTC，回退到窗口标题解析"""
    # ── 1. 尝试 SMTC（winsdk 后台缓存） ──────────────────
    if WINSDK_OK:
        with _smtc_lock:
            cached = dict(_smtc_cache)
        if 'error' not in cached:
            cached['source'] = 'smtc'
            return jsonify(cached)

    # ── 2. 回退：窗口标题解析 ─────────────────────────────
    info = _get_info_from_window_title()
    if info:
        info['source']    = info.get('source', 'window_title')
        info['state']     = 'playing'
        info['stateCode'] = 4
        info['thumbnail'] = None
        # 用本地计时器估算进度（曲名变化时服务端重置计时）
        title_key = info.get('title', '')
        now = time.time()
        if not hasattr(media_status, '_wt_title') or media_status._wt_title != title_key:
            media_status._wt_title   = title_key
            media_status._wt_start   = now
        elapsed = now - media_status._wt_start
        info['position'] = round(elapsed, 2)
        info['duration'] = 0.0   # 窗口标题无法得知总时长
        return jsonify(info)

    # ── 3. 均无数据 ────────────────────────────────────────
    smtc_err = _smtc_cache.get('error', 'smtc not available') if WINSDK_OK else 'winsdk not installed'
    return jsonify({'error': f'no media found (smtc: {smtc_err}, window: no match)'})


@app.route('/media/debug', methods=['GET'])
def media_debug():
    """诊断接口：返回 SMTC 缓存 + 窗口标题扫描结果"""
    info = _get_info_from_window_title()
    return jsonify({
        'smtc_cache':    _smtc_cache if WINSDK_OK else 'winsdk not installed',
        'window_title':  info,
    })


_ACTION_VK = {
    'play':  VK_MEDIA_PLAY_PAUSE,
    'next':  VK_MEDIA_NEXT_TRACK,
    'prev':  VK_MEDIA_PREV_TRACK,
}

@app.route('/media/<action>', methods=['GET'])
def media_control(action):
    vk = _ACTION_VK.get(action)
    if vk:
        send_media_key(vk)
        print(f'[MEDIA] keybd_event vk=0x{vk:02X} action={action}')
    else:
        print(f'[MEDIA] unknown action: {action}')
    return jsonify({'success': True, 'action': action})

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
