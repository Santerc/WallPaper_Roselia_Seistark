import json
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, 
                             QLineEdit, QPushButton, QLabel, QFrame, 
                             QGraphicsDropShadowEffect, QListWidget, QListWidgetItem,
                             QScrollArea, QSizePolicy)
from PyQt6.QtCore import Qt, QPoint, pyqtSignal
from PyQt6.QtGui import QColor, QFont, QIcon

# ================== Style & Theme ==================
BG_COLOR = "rgba(20, 20, 20, 0.95)" 
BORDER_COLOR = "rgba(162, 155, 254, 0.4)" 
ACCENT_COLOR = "#a29bfe"  
TEXT_COLOR = "#ffffff"
INPUT_BG = "rgba(255, 255, 255, 0.05)"
INPUT_BORDER = "rgba(255, 255, 255, 0.1)"

STYLESHEET = f"""
QWidget {{
    font-family: 'Segoe UI', sans-serif;
    color: {TEXT_COLOR};
    outline: none;
}}
QFrame#MainFrame {{
    background-color: {BG_COLOR};
    border: 1px solid {BORDER_COLOR};
    border-radius: 16px;
}}
QLabel {{ font-weight: 600; color: {ACCENT_COLOR}; letter-spacing: 1px; }}
QLineEdit {{
    background-color: {INPUT_BG};
    border: 1px solid {INPUT_BORDER};
    border-radius: 6px;
    color: white;
    padding: 8px;
    font-size: 13px;
}}
QLineEdit:focus {{ border: 1px solid {ACCENT_COLOR}; }}
QPushButton {{
    background-color: {INPUT_BG};
    border: 1px solid {INPUT_BORDER};
    border-radius: 8px;
    padding: 6px 12px;
    font-weight: 600;
}}
QPushButton:hover {{ background-color: rgba(162, 155, 254, 0.15); border-color: {ACCENT_COLOR}; }}
QListWidget {{
    background: transparent;
    border: none;
}}
QListWidget::item {{
    background-color: {INPUT_BG};
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 5px;
}}
QListWidget::item:hover {{
    background-color: rgba(255,255,255,0.1);
}}
"""

class DraggableTitleBar(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.layout = QHBoxLayout()
        self.layout.setContentsMargins(15, 10, 15, 5)
        self.setLayout(self.layout)

        self.title_label = QLabel("DAILY GOALS EDITOR")
        self.title_label.setStyleSheet(f"font-size: 13px; color: {ACCENT_COLOR};")
        
        self.close_btn = QPushButton("×")
        self.close_btn.setFixedSize(30, 30)
        self.close_btn.setStyleSheet("""
            QPushButton { 
                background: transparent; border: none; font-size: 20px; color: #aaa; 
            }
            QPushButton:hover { color: #ff7675; }
        """)
        self.close_btn.clicked.connect(lambda: self.parent.close())

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

class GoalsWindow(QWidget):
    def __init__(self, items, save_callback=None):
        super().__init__()
        self.items = items or [] # List of {"text": "...", "done": bool}
        self.save_callback = save_callback
        self.old_pos = None
        
        # Window Flags
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Window)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.resize(700, 650) # Increased Width to prevent cutoff

        # Layout
        self.main_layout = QVBoxLayout()
        self.main_layout.setContentsMargins(20, 20, 20, 20)
        self.setLayout(self.main_layout)

        # Frame
        self.frame = QFrame()
        self.frame.setObjectName("MainFrame")
        self.frame_layout = QVBoxLayout()
        self.frame_layout.setContentsMargins(0, 0, 0, 25)
        self.frame.setLayout(self.frame_layout)
        self.main_layout.addWidget(self.frame)

        # Shadow
        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(35)
        shadow.setColor(QColor(ACCENT_COLOR))
        shadow.setOffset(0, 0)
        self.frame.setGraphicsEffect(shadow)

        self.setStyleSheet(STYLESHEET)
        self.setup_ui()

    def setup_ui(self):
        # Title Bar
        self.title_bar = DraggableTitleBar(self)
        self.frame_layout.addWidget(self.title_bar)
        
        # Content
        content = QVBoxLayout()
        content.setContentsMargins(20, 0, 20, 0)
        content.setSpacing(15)
        
        # New Item Input (Top)
        input_row = QHBoxLayout()
        self.new_input = QLineEdit()
        self.new_input.setPlaceholderText("Add new goal...")
        self.new_input.setFixedHeight(40) # Taller input
        self.new_input.setStyleSheet("font-size: 14px; padding: 0 10px;")
        self.new_input.returnPressed.connect(self.add_item)
        
        add_btn = QPushButton("+")
        add_btn.setFixedSize(40, 40)
        add_btn.setStyleSheet(f"""
            background-color: {ACCENT_COLOR}; color: black; 
            border-radius: 8px; font-size: 20px; font-weight: bold;
        """)
        add_btn.clicked.connect(self.add_item)
        
        input_row.addWidget(self.new_input)
        input_row.addWidget(add_btn)
        content.addLayout(input_row)
        
        # List Area
        self.list_widget = QListWidget()
        content.addWidget(self.list_widget)
        self.populate_list()
        
        # Save Button (Bottom)
        save_btn = QPushButton("SAVE CHANGES")
        save_btn.setFixedHeight(45)
        save_btn.setStyleSheet(f"""
            background-color: {ACCENT_COLOR}; color: black; border: none;
            border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px;
        """)
        save_btn.clicked.connect(self.save_and_close)
        content.addWidget(save_btn)
        
        self.frame_layout.addLayout(content)

    def populate_list(self):
        self.list_widget.clear()
        for i, item in enumerate(self.items):
            self.create_list_item(item, i)

    def create_list_item(self, item_data, index):
        item_widget = QWidget()
        layout = QHBoxLayout()
        layout.setContentsMargins(10, 8, 10, 8) # More vertical margin
        layout.setSpacing(15)
        
        # Done Checkbox (Visual in Editor)
        # We allow toggling done in editor too
        val = item_data.get("done", False)
        check_btn = QPushButton("✔" if val else "")
        check_btn.setFixedSize(36, 36) # Larger Checkbox
        check_btn.setCheckable(True)
        check_btn.setChecked(val)
        # Style dependent on state
        bg = ACCENT_COLOR if val else "transparent"
        border = ACCENT_COLOR
        fg = "black" if val else "transparent"
        
        check_btn.setStyleSheet(f"""
            QPushButton {{
                background: {bg}; border: 2px solid {border}; 
                border-radius: 8px; color: {fg}; font-weight: bold; font-size: 20px;
            }}
            QPushButton:hover {{ border-color: white; }}
        """)
        check_btn.clicked.connect(lambda: self.toggle_item_done(index))
        
        # Text Input
        label = QLineEdit(item_data.get("text", "")) 
        label.setFixedHeight(50) # Much Taller Input (was 30)
        label.setStyleSheet("""
            background: transparent; border: none; 
            font-size: 20px; color: white; border-bottom: 1px solid rgba(255,255,255,0.1);
        """)
        if val:
             label.setStyleSheet(label.styleSheet() + "color: rgba(255,255,255,0.5); text-decoration: line-through;")
             
        label.textChanged.connect(lambda t: self.update_item_text(index, t))
        
        # Delete Button
        del_btn = QPushButton("×")
        del_btn.setFixedSize(36, 36) # Larger delete button
        del_btn.setStyleSheet("""
            QPushButton { 
                background: rgba(255, 118, 117, 0.2); color: #ff7675; 
                border: 1px solid #ff7675; border-radius: 8px; font-size: 24px; line-height: 24px;
            }
            QPushButton:hover { background: #ff7675; color: white; }
        """)
        del_btn.clicked.connect(lambda: self.remove_item(index))
        
        layout.addWidget(check_btn)
        layout.addWidget(label)
        layout.addWidget(del_btn)
        item_widget.setLayout(layout)
        
        list_item = QListWidgetItem(self.list_widget)
        # Increase size hint for the row
        sz = item_widget.sizeHint()
        sz.setHeight(70) 
        list_item.setSizeHint(sz)
        
        self.list_widget.setItemWidget(list_item, item_widget)
    
    def toggle_item_done(self, index):
        if 0 <= index < len(self.items):
            self.items[index]["done"] = not self.items[index].get("done", False)
            # Re-render to update style
            self.populate_list()
            # Restore Scroll? For now just simple re-render. Since list is small.

    def add_item(self):
        text = self.new_input.text().strip()
        if text:
            self.items.append({"text": text, "done": False})
            self.new_input.clear()
            self.populate_list()

    def remove_item(self, index):
        if 0 <= index < len(self.items):
            self.items.pop(index)
            self.populate_list()

    def update_item_text(self, index, text):
        if 0 <= index < len(self.items):
            self.items[index]["text"] = text

    def save_and_close(self):
        if self.save_callback:
            self.save_callback(self.items)
        self.close()
