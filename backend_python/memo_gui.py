import sys
import json
import requests
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout, 
                             QTextEdit, QLineEdit, QPushButton, QLabel, QCheckBox, 
                             QGraphicsDropShadowEffect, QFrame, QDateEdit, QCalendarWidget, 
                             QGraphicsOpacityEffect, QAbstractSpinBox, QSpinBox)
from PyQt6.QtCore import Qt, QPoint, QDateTime, QDate, QTime, QSize
from PyQt6.QtGui import QColor, QFont, QPalette, QBrush, QAction, QIcon, QPainter, QLinearGradient

# Configuration
SERVER_URL = "http://127.0.0.1:35678/api/memos"

# ================== Style & Theme ==================
# ... (Colors unchanged)
BG_COLOR = "rgba(20, 20, 20, 0.95)" 
BORDER_COLOR = "rgba(162, 155, 254, 0.4)" 
ACCENT_COLOR = "#a29bfe"  
ACCENT_GLOW = "#6c5ce7"   
TEXT_COLOR = "#ffffff"
INPUT_BG = "rgba(255, 255, 255, 0.05)"
INPUT_BORDER = "rgba(255, 255, 255, 0.1)"

STYLESHEET = f"""
/* Global Reset */
QWidget {{
    font-family: 'Segoe UI', sans-serif;
    color: {TEXT_COLOR};
    outline: none;
}}

QWidget#Root {{ background: transparent; }}

QFrame#MainFrame {{
    background-color: {BG_COLOR};
    border: 1px solid {BORDER_COLOR};
    border-radius: 16px;
}}

QLabel {{
    font-size: 11px;
    font-weight: 600;
    color: {ACCENT_COLOR};
    letter-spacing: 1px;
    margin-bottom: 4px;
}}

/* Text Area */
QTextEdit {{
    background-color: {INPUT_BG};
    border: 1px solid {INPUT_BORDER};
    border-radius: 8px;
    color: white;
    padding: 10px;
    font-size: 14px;
    selection-background-color: {ACCENT_COLOR};
}}

/* Single Line Inputs */
/* Single Line Inputs */
QLineEdit, QDateEdit, QSpinBox {{
    background-color: {INPUT_BG};
    border: 1px solid {INPUT_BORDER};
    border-radius: 8px;
    color: white;
    padding: 4px 10px;
    font-size: 14px;
    min-height: 25px;
    selection-background-color: {ACCENT_COLOR};
}}

/* DISABLED STATE - VISUAL FEEDBACK */
QLineEdit:disabled, QDateEdit:disabled, QSpinBox:disabled {{
    background-color: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.2);
    border: 1px dashed rgba(255, 255, 255, 0.1);
}}

QTextEdit:focus, QLineEdit:focus, QDateEdit:focus, QSpinBox:focus {{
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid {ACCENT_COLOR};
}}

/* Buttons */
QPushButton {{
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #e0e0e0;
    padding: 8px 16px;
    font-weight: 600;
    font-size: 12px;
}}
QPushButton:hover {{
    background-color: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
}}
QPushButton#SaveBtn {{
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 {ACCENT_COLOR}, stop:1 {ACCENT_GLOW});
    border: none;
    color: white;
}}
QPushButton#SaveBtn:hover {{
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 {ACCENT_GLOW}, stop:1 {ACCENT_COLOR});
    border: 1px solid rgba(255,255,255,0.2);
}}
QPushButton#CloseBtn {{
    background-color: transparent;
    border: none;
    border-radius: 15px; 
    color: rgba(255, 255, 255, 0.5);
    font-size: 16px;
}}
QPushButton#CloseBtn:hover {{
    background-color: rgba(255, 100, 100, 0.2);
    color: #ff7675;
}}

QPushButton#DeleteBtn {{
    background-color: rgba(255, 80, 80, 0.1);
    border: 1px solid rgba(255, 80, 80, 0.3);
    color: #ff7675;
    min-width: 60px;
}}
QPushButton#DeleteBtn:hover {{
    background-color: #d63031; 
    border: 1px solid #ff7675;
    color: white;
}}

/* Checkbox -> Toggle Switch Look */
QCheckBox {{
    spacing: 12px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
}}
QCheckBox::indicator {{
    width: 36px;
    height: 18px;
    border-radius: 9px;
    background-color: #2d3436; /* Off track */
    border: 1px solid rgba(255, 255, 255, 0.2);
}}
QCheckBox::indicator:hover {{
    border-color: rgba(255, 255, 255, 0.5);
}}
QCheckBox::indicator:checked {{
    background-color: {ACCENT_COLOR}; /* On track */
    border: 1px solid {ACCENT_GLOW};
    /* We simulate the knob position by using an image or just relying on color shift 
       for pure CSS within Qt limits without external assets. */
}}

/* --- Date Edit Specifics --- */
QDateEdit::drop-down {{
    subcontrol-origin: padding;
    subcontrol-position: center right;
    width: 25px;
    height: 100%; /* Full height */
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    border-top-right-radius: 8px; 
    border-bottom-right-radius: 8px;
    background: rgba(0,0,0,0.1);
}}
QDateEdit::drop-down:hover {{ background-color: rgba(255, 255, 255, 0.15); }}
QDateEdit::down-arrow {{
    width: 12px; height: 12px;
    image: none; /* remove stock arrow */
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid {ACCENT_COLOR};
    margin: 0;
}}
QDateEdit::up-button, QDateEdit::down-button {{ width: 0px; }}

/* --- SpinBox (for Time) Specifics --- */
QSpinBox {{
    padding-right: 25px; /* Make room for wider buttons */
}}
QSpinBox::up-button {{
    subcontrol-origin: border;
    subcontrol-position: top right;
    width: 25px; 
    height: 16px; /* Taller */
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    border-top-right-radius: 8px;
    background: rgba(0,0,0,0.1);
}}
QSpinBox::down-button {{
    subcontrol-origin: border;
    subcontrol-position: bottom right;
    width: 25px;
    height: 16px; /* Taller */
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    border-top: 0px solid transparent; /* Remove double border look */
    border-bottom-right-radius: 8px;
    background: rgba(0,0,0,0.1);
}}
QSpinBox::up-button:hover, QSpinBox::down-button:hover {{ 
    background-color: {ACCENT_COLOR}; 
}}
/* Arrows inside SpinBox buttons - make them white on hover generally or just simple shapes */
QSpinBox::up-arrow {{
    width: 8px; height: 8px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 5px solid {ACCENT_COLOR};
}}
QSpinBox::down-arrow {{
    width: 8px; height: 8px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid {ACCENT_COLOR};
}}
/* Invert arrow color when hovering button for better contrast if background becomes accent color? 
   Actually, keeping it simple is safer. Let's just make buttons bg slightly lighter on hover. */
QSpinBox::up-button:hover {{ background-color: rgba(255,255,255,0.2); }}
QSpinBox::down-button:hover {{ background-color: rgba(255,255,255,0.2); }}


/* Calendar Popups */
QCalendarWidget QWidget {{ background-color: #2d3436; color: white; }}
QCalendarWidget QToolButton {{ color: {ACCENT_COLOR}; background: transparent; border: none; font-weight: bold; }}
QCalendarWidget QSpinBox {{ background-color: rgba(0,0,0,0.2); color: white; }}
QCalendarWidget QAbstractItemView:enabled {{ 
    background-color: #2d3436; color: white; 
    selection-background-color: {ACCENT_COLOR}; 
    selection-color: white; 
}}
QCalendarWidget QAbstractItemView:disabled {{ color: #636e72; }}
"""

class DraggableTitleBar(QWidget):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self.layout = QHBoxLayout()
        self.layout.setContentsMargins(20, 15, 20, 5) # Matches frame padding
        self.setLayout(self.layout)

        # Title with Icon look
        self.title_label = QLabel("MEMO EDITOR")
        self.title_label.setStyleSheet(f"font-size: 11px; font-weight: 800; letter-spacing: 2px; color: rgba(162, 155, 254, 0.8); background: transparent; border: none;")
        
        self.close_btn = QPushButton("✕")
        self.close_btn.setObjectName("CloseBtn")
        self.close_btn.setFixedSize(30, 30)
        self.close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.close_btn.clicked.connect(self.parent.close)

        self.layout.addWidget(self.title_label)
        self.layout.addStretch()
        self.layout.addWidget(self.close_btn)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.parent.old_pos = event.globalPosition().toPoint()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton and self.parent.old_pos:
            current_pos = event.globalPosition().toPoint()
            delta = QPoint(current_pos - self.parent.old_pos)
            self.parent.move(self.parent.x() + delta.x(), self.parent.y() + delta.y())
            self.parent.old_pos = current_pos
            
    def mouseReleaseEvent(self, event):
         self.parent.old_pos = None

class MemoWindow(QWidget):
    def __init__(self, memo_data):
        super().__init__()
        self.memo_data = memo_data
        self.memo_id = memo_data.get('id', 0)
        self.old_pos = None
        
        # 1. Window Flags: Frameless, Translucent, Tool (no taskbar icon optionally)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Window)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.resize(420, 560) # Slightly larger

        # 2. Main Layout
        # We need a layout on the main widget to hold the frame
        self.main_layout = QVBoxLayout()
        # Padding is crucial for Drop Shadow to be visible
        self.main_layout.setContentsMargins(20, 20, 20, 20) 
        self.setLayout(self.main_layout)

        # 3. The Visual Frame (The "Card")
        self.frame = QFrame()
        self.frame.setObjectName("MainFrame")
        
        # Inner Layout of the card
        self.frame_layout = QVBoxLayout()
        self.frame_layout.setContentsMargins(0, 0, 0, 25) # Bottom padding
        self.frame_layout.setSpacing(15)
        self.frame.setLayout(self.frame_layout)
        
        # Add frame to main layout
        self.main_layout.addWidget(self.frame)

        # 4. Drop Shadow (The Glow)
        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(35)
        shadow.setColor(QColor(ACCENT_COLOR)) # Purple Glow
        shadow.setOffset(0, 0) # Center glow
        self.frame.setGraphicsEffect(shadow)

        # 5. Build Content
        self.setup_ui()
        
        # 6. Apply Styles
        self.setStyleSheet(STYLESHEET)

    def setup_ui(self):
        # -- Title Bar --
        self.title_bar = DraggableTitleBar(self)
        self.frame_layout.addWidget(self.title_bar)

        # -- Content Container --
        content_container = QVBoxLayout()
        content_container.setContentsMargins(25, 0, 25, 0)
        content_container.setSpacing(15)
        self.frame_layout.addLayout(content_container)

        # -- Text Area --
        content_container.addWidget(QLabel("MEMO CONTENT"))
        self.text_edit = QTextEdit()
        self.text_edit.setPlainText(self.memo_data.get('text', ''))
        self.text_edit.setPlaceholderText("Write something here...")
        content_container.addWidget(self.text_edit)

        # -- Deadline Section --
        content_container.addSpacing(5)
        
        # Header + Checkbox
        h_layout = QHBoxLayout()
        h_layout.addWidget(QLabel("DEADLINE"))
        h_layout.addStretch()
        self.enable_date_chk = QCheckBox("Set Date")
        self.enable_date_chk.setCursor(Qt.CursorShape.PointingHandCursor)
        self.enable_date_chk.toggled.connect(self.toggle_date_inputs)
        h_layout.addWidget(self.enable_date_chk)
        content_container.addLayout(h_layout)
        
        content_container.addSpacing(10) # Breathable vertical gap

        # Date & Time Inputs (Explicit Separate Inputs)
        dt_layout = QHBoxLayout()
        dt_layout.setSpacing(20) # More horizontal breathing room
        
        # 1. Date Edit (Standard)
        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("yyyy-MM-dd")
        self.date_edit.setCursor(Qt.CursorShape.IBeamCursor)
        
        # 2. Time SpinBoxes (Hour : Minute) - Foolproof
        self.hour_spin = QSpinBox()
        self.hour_spin.setRange(0, 23)
        self.hour_spin.setPrefix(" ") # Padding
        self.hour_spin.setSuffix(" h")
        self.hour_spin.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hour_spin.setCursor(Qt.CursorShape.PointingHandCursor) # Suggests scroll/click
        
        self.min_spin = QSpinBox()
        self.min_spin.setRange(0, 59)
        self.min_spin.setPrefix(" ") # Padding
        self.min_spin.setSuffix(" m")
        self.min_spin.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.min_spin.setCursor(Qt.CursorShape.PointingHandCursor)

        # Init Data
        raw_date = self.memo_data.get('dueDate', '')
        has_date = False
        default_dt = QDateTime.currentDateTime().addSecs(3600)
        
        if raw_date:
            dt = QDateTime.fromString(raw_date, Qt.DateFormat.ISODate)
            if dt.isValid():
                default_dt = dt
                has_date = True
        
        self.date_edit.setDate(default_dt.date())
        self.hour_spin.setValue(default_dt.time().hour())
        self.min_spin.setValue(default_dt.time().minute())
        
        self.enable_date_chk.setChecked(has_date)
        self.toggle_date_inputs(has_date) # Apply initial state

        # Add to Layout: Date (2), Hour (1), Min (1)
        dt_layout.addWidget(self.date_edit, 5)
        dt_layout.addWidget(self.hour_spin, 2)
        dt_layout.addWidget(self.min_spin, 2)
        content_container.addLayout(dt_layout)

        # -- Reminder Section --
        content_container.addSpacing(5)
        self.reminder_check = QCheckBox("Enable Reminder Notification")
        self.reminder_check.setCursor(Qt.CursorShape.PointingHandCursor)
        self.reminder_check.setChecked(self.memo_data.get('enableReminder', False))
        content_container.addWidget(self.reminder_check)

        # -- Bottom Buttons --
        content_container.addSpacing(20)
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(15)
        
        self.cancel_btn = QPushButton("CANCEL")
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.clicked.connect(self.close)
        
        self.save_btn = QPushButton("SAVE")
        self.save_btn.setObjectName("SaveBtn")
        self.save_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.save_btn.clicked.connect(self.save)
        
        # Layout: [Delete] ...Stretch... [Cancel][Save]
        if self.memo_id:
            self.delete_btn = QPushButton("DELETE")
            self.delete_btn.setObjectName("DeleteBtn")
            self.delete_btn.setCursor(Qt.CursorShape.PointingHandCursor)
            self.delete_btn.clicked.connect(self.delete_memo)
            btn_layout.addWidget(self.delete_btn)

        btn_layout.addStretch()
        btn_layout.addWidget(self.cancel_btn)
        btn_layout.addWidget(self.save_btn)
        
        content_container.addLayout(btn_layout)

    def toggle_date_inputs(self, checked):
        self.date_edit.setEnabled(checked)
        self.hour_spin.setEnabled(checked)
        self.min_spin.setEnabled(checked)

    def delete_memo(self):
        if not self.memo_id:
            return
            
        payload = {"id": self.memo_id}
        try:
            # SERVER_URL is .../api/memos, so append /delete
            url = SERVER_URL + "/delete"
            requests.post(url, json=payload, timeout=2)
            self.close()
        except Exception as e:
            print(f"Error deleting memo: {e}")
            self.text_edit.setPlaceholderText(f"Error deleting: {e}")

    def save(self):
        # 1. Gather Data
        text = self.text_edit.toPlainText()
        date_str = None
        
        if self.enable_date_chk.isChecked():
            d = self.date_edit.date()
            # Combine Custom Time Inputs
            t = QTime(self.hour_spin.value(), self.min_spin.value())
            # Construct ISO String: yyyy-MM-ddTHH:mm:00
            date_str = f"{d.toString('yyyy-MM-dd')}T{t.toString('HH:mm')}:00"
            
        reminder = self.reminder_check.isChecked()

        payload = {
            "id": self.memo_id if self.memo_id else None,
            "text": text,
            "dueDate": date_str,
            "enableReminder": reminder
        }
        
        # 2. Send to Backend
        try:
            requests.post(SERVER_URL, json=payload, timeout=2)
            self.close()
        except Exception as e:
            print(f"Error saving memo: {e}")
            # Optional: Show error in UI
            self.text_edit.setPlaceholderText(f"Error saving: {e}")

# Entry point wrapper for server.py
def run_editor(json_data_str=None):
    app = QApplication.instance()
    if not app:
        app = QApplication(sys.argv)
    else:
        # If app exists (unlikely in subprocess mode but good practice)
        pass

    # Parse Data
    memo_data = {}
    if json_data_str:
        try:
            memo_data = json.loads(json_data_str)
        except Exception as e:
            print(f"JSON Parse Error: {e}")
            
    window = MemoWindow(memo_data)
    window.show()
    
    if not QApplication.instance().receivers(QApplication.instance().lastWindowClosed):
        # Ensure clean exit
        pass
        
    app.exec()

if __name__ == "__main__":
    # Test Mode
    # python memo_gui.py '{"text": "Test Memo"}'
    input_str = sys.argv[1] if len(sys.argv) > 1 else None
    run_editor(input_str)
