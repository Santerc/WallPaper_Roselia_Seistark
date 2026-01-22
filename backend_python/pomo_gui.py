from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QListWidget, QListWidgetItem, 
                             QSpinBox, QFrame, QGraphicsDropShadowEffect, 
                             QLineEdit, QAbstractItemView, QStyledItemDelegate)
from PyQt6.QtCore import Qt, QPoint, QRect, QSize, pyqtSignal
from PyQt6.QtGui import QColor, QPainter, QBrush, QLinearGradient, QAction

class RoseliaSpinBox(QSpinBox):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setStyleSheet("""
            QSpinBox {
                background-color: rgba(30, 20, 40, 0.6);
                border: 1px solid rgba(162, 155, 254, 0.3);
                border-radius: 8px;
                color: #ecf0f1;
                font-family: 'Segoe UI', sans-serif;
                font-size: 24px;
                font-weight: 300;
                padding: 10px;
                selection-background-color: #6c5ce7;
            }
            QSpinBox:hover {
                border: 1px solid rgba(162, 155, 254, 0.8);
                background-color: rgba(30, 20, 40, 0.8);
            }
            QSpinBox:focus {
                border: 1px solid #a29bfe;
                background-color: rgba(30, 20, 40, 1.0);
            }
        """)

# Custom Widget for List Items to allow inline editing
class PresetItemWidget(QWidget):
    # Signal to notify parent of changes or selection
    # (name, work, rest, is_selected)
    on_click = pyqtSignal(object) 
    on_delete = pyqtSignal(object)
    on_change = pyqtSignal(int, dict)

    def __init__(self, row_index, data, parent_list):
        super().__init__()
        self.row_index = row_index
        self.data = data
        self.parent_list = parent_list # Reference to main window logical handler ideally
        
        self.layout = QHBoxLayout()
        self.layout.setContentsMargins(5, 2, 5, 2)
        self.layout.setSpacing(10)
        self.setLayout(self.layout)

        # Name Edit
        self.name_edit = QLineEdit(data.get('name', 'Unititled'))
        self.name_edit.setStyleSheet("""
            QLineEdit {
                background: transparent;
                border: none;
                color: #ddd;
                font-weight: bold;
                font-family: 'Segoe UI';
            }
            QLineEdit:focus {
                border-bottom: 1px solid #a29bfe;
            }
        """)
        self.name_edit.editingFinished.connect(self.save_changes)
        
        # Values Display / Edit (Simplified to text for compact view, or small spins)
        # Using simplified approach: Name (Work/Rest)
        # But user wants to edit Work/Rest too.
        # Let's use small spinboxes for W/R inline? It might be crowded.
        # Better: Work: [25] Rest: [5]
        
        style_spin = """
            QSpinBox {
                background: rgba(0,0,0,0.3);
                border: none;
                color: #a29bfe;
                border-radius: 4px;
                padding: 0px 2px;
            }
        """
        
        self.spin_w = QSpinBox()
        self.spin_w.setRange(1, 120)
        self.spin_w.setValue(data.get('work', 25))
        self.spin_w.setFixedWidth(40)
        self.spin_w.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        self.spin_w.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.spin_w.setStyleSheet(style_spin)
        self.spin_w.valueChanged.connect(self.save_changes)
        
        self.spin_r = QSpinBox()
        self.spin_r.setRange(1, 60)
        self.spin_r.setValue(data.get('rest', 5))
        self.spin_r.setFixedWidth(40)
        self.spin_r.setButtonSymbols(QSpinBox.ButtonSymbols.NoButtons)
        self.spin_r.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.spin_r.setStyleSheet(style_spin)
        self.spin_r.valueChanged.connect(self.save_changes)

        # Layout Assembly
        self.layout.addWidget(self.name_edit, 1) # Expand name
        
        lbl_w = QLabel("W:")
        lbl_w.setStyleSheet("color: rgba(255,255,255,0.4); font-size: 10px;")
        self.layout.addWidget(lbl_w)
        self.layout.addWidget(self.spin_w)
        
        lbl_r = QLabel("R:")
        lbl_r.setStyleSheet("color: rgba(255,255,255,0.4); font-size: 10px;")
        self.layout.addWidget(lbl_r)
        self.layout.addWidget(self.spin_r)
        
        # Apply Button (Load this preset) - hidden logic, clicking anywhere does it?
        # User said "Double click... edit name...". 
        # Actually user wants to edit IN PLACE.
        
        # Delete Btn
        btn_del = QPushButton("×")
        btn_del.setFixedSize(20, 20)
        btn_del.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_del.setStyleSheet("background: transparent; color: #666; font-weight: bold; border: none;")
        btn_del.clicked.connect(lambda: self.on_delete.emit(self.row_index))
        self.layout.addWidget(btn_del)

        # Click handling for "Loading" the preset into main view?
        # The user seems to view the list AS the configuration.
        # But we still have the big spinner at top.
        # Let's make clicking the widget "Apply" the values to big spinner.
        
    def save_changes(self):
        new_data = {
            'name': self.name_edit.text(),
            'work': self.spin_w.value(),
            'rest': self.spin_r.value()
        }
        self.on_change.emit(self.row_index, new_data)

    def mousePressEvent(self, event):
        super().mousePressEvent(event)
        # Notify parent to load this preset
        self.on_click.emit(self.data)


class PomodoroSettingsWindow(QWidget):
    def __init__(self, current_config, on_save_callback):
        super().__init__()
        self.setObjectName("MainWindow")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setGeometry(0, 0, 420, 500) # Slightly wider for inline edits
        self.center_window()
        
        self.config = current_config 
        self.on_save = on_save_callback
        self.drag_pos = None

        # Deep Copy Presets effectively
        self.presets = [p.copy() for p in self.config.get('presets', [])]
        if not self.presets:
            self.presets = [
                {'name': 'Classic', 'work': 25, 'rest': 5},
                {'name': 'Long', 'work': 45, 'rest': 15}
            ]

        # Main Layout
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(10, 10, 10, 10)
        self.setLayout(main_layout)

        # Background Frame
        self.bg_frame = QFrame()
        self.bg_frame.setObjectName("BgFrame")
        self.bg_frame.setStyleSheet("""
            QFrame#BgFrame {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1, 
                                          stop:0 #1a0f2e, stop:0.4 #2d1b4e, stop:1 #1a0f2e);
                border: 1px solid rgba(162, 155, 254, 0.4);
                border-radius: 12px;
            }
            QLabel {
                font-family: 'Segoe UI', sans-serif;
            }
        """)
        
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(20)
        shadow.setColor(QColor(0, 0, 0, 150))
        shadow.setOffset(0, 5)
        self.bg_frame.setGraphicsEffect(shadow)
        main_layout.addWidget(self.bg_frame)
        
        content_layout = QVBoxLayout(self.bg_frame)
        content_layout.setContentsMargins(20, 15, 20, 20)
        content_layout.setSpacing(15)

        # --- Header ---
        header_box = QHBoxLayout()
        title = QLabel("TIMER SETTINGS")
        title.setStyleSheet("color: #a29bfe; font-weight: bold; letter-spacing: 2px;")
        header_box.addWidget(title)
        header_box.addStretch()
        btn_close = QPushButton("×")
        btn_close.setFixedSize(30, 30)
        btn_close.clicked.connect(self.close)
        btn_close.setStyleSheet("background: transparent; color: white; border: none; font-size: 20px;")
        header_box.addWidget(btn_close)
        content_layout.addLayout(header_box)

        # --- Main Spinner (Current Session) ---
        # This reflects what will be applied, often loaded from preset
        spin_container = QHBoxLayout()
        
        self.main_work = RoseliaSpinBox()
        self.main_work.setRange(1, 120)
        self.main_work.setValue(self.config.get('work', 25))
        
        self.main_rest = RoseliaSpinBox()
        self.main_rest.setRange(1, 60)
        self.main_rest.setValue(self.config.get('rest', 5))
        
        lbl_div = QLabel(":")
        lbl_div.setStyleSheet("color: rgba(255,255,255,0.3); font-size: 30px;")

        spin_container.addWidget(self.create_labeled_spin("WORK", self.main_work))
        spin_container.addWidget(lbl_div)
        spin_container.addWidget(self.create_labeled_spin("REST", self.main_rest))
        
        content_layout.addLayout(spin_container)

        # --- Presets Section ---
        p_header = QHBoxLayout()
        lbl_p = QLabel("PRESETS")
        lbl_p.setStyleSheet("color: rgba(255,255,255,0.5); font-size: 11px; font-weight: bold;")
        p_header.addWidget(lbl_p)
        p_header.addStretch()
        
        btn_add = QPushButton("+")
        btn_add.setFixedSize(24, 24)
        btn_add.setToolTip("Add current settings as new preset")
        btn_add.clicked.connect(self.add_preset_from_current)
        btn_add.setStyleSheet("""
            QPushButton {
                background: rgba(108, 92, 231, 0.3);
                border: 1px solid #6c5ce7;
                border-radius: 12px;
                color: white; padding-bottom: 2px;
            }
            QPushButton:hover { background: #6c5ce7; }
        """)
        p_header.addWidget(btn_add)
        
        content_layout.addLayout(p_header)

        # List Widget
        self.list_widget = QListWidget()
        self.list_widget.setStyleSheet("""
            QListWidget {
                background: rgba(0,0,0,0.2);
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.05);
                outline: none;
            }
            QListWidget::item {
                border-bottom: 1px solid rgba(255,255,255,0.02);
            }
            QListWidget::item:hover {
                background: transparent; /* Handled by internal widget */
            }
            QListWidget::item:selected {
                background: transparent;
            }
        """)
        self.list_widget.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        content_layout.addWidget(self.list_widget)
        
        self.render_presets()

        # --- Footer ---
        btn_apply = QPushButton("APPLY")
        btn_apply.clicked.connect(self.save_and_close)
        btn_apply.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #6c5ce7, stop:1 #a29bfe);
                color: white; font-weight: bold; border-radius: 18px; height: 36px;
                font-size: 14px; letter-spacing: 1px;
            }
            QPushButton:hover { background: #6c5ce7; }
        """)
        content_layout.addWidget(btn_apply)
        
    def create_labeled_spin(self, label_text, spinbox):
        w = QWidget()
        l = QVBoxLayout()
        l.setContentsMargins(0,0,0,0)
        lb = QLabel(label_text)
        lb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lb.setStyleSheet("color: rgba(255,255,255,0.4); font-size: 10px; font-weight: bold;")
        l.addWidget(spinbox)
        l.addWidget(lb)
        w.setLayout(l)
        return w

    def render_presets(self):
        self.list_widget.clear()
        for i, data in enumerate(self.presets):
            item = QListWidgetItem(self.list_widget)
            item.setSizeHint(QSize(0, 50))
            
            # Create Custom Widget
            widget = PresetItemWidget(i, data, self)
            widget.on_click.connect(self.load_preset_to_main)
            widget.on_change.connect(self.update_preset_data)
            widget.on_delete.connect(self.delete_preset)
            
            self.list_widget.setItemWidget(item, widget)

    def load_preset_to_main(self, data):
        self.main_work.setValue(data['work'])
        self.main_rest.setValue(data['rest'])
        # Optional: Flash visual feedback?

    def update_preset_data(self, idx, new_data):
        if 0 <= idx < len(self.presets):
            self.presets[idx] = new_data
            
    def delete_preset(self, idx):
        if 0 <= idx < len(self.presets):
            self.presets.pop(idx)
            self.render_presets()

    def add_preset_from_current(self):
        # Add new item to top or bottom? Bottom usually.
        # Auto-focus name edit?
        new_p = {
            'name': 'New Preset',
            'work': self.main_work.value(),
            'rest': self.main_rest.value()
        }
        self.presets.append(new_p)
        self.render_presets()
        
        # Scroll to bottom
        self.list_widget.scrollToBottom()
        # Ideally focus the name edit of the last item
        item = self.list_widget.item(self.list_widget.count()-1)
        widget = self.list_widget.itemWidget(item)
        if widget:
            widget.name_edit.setFocus()
            widget.name_edit.selectAll()

    def save_and_close(self):
        new_config = {
            'work': self.main_work.value(),
            'rest': self.main_rest.value(),
            'presets': self.presets
        }
        if self.on_save:
            self.on_save(new_config)
        self.close()

    def center_window(self):
        try:
             from PyQt6.QtGui import QGuiApplication
             screen = QGuiApplication.primaryScreen().availableGeometry()
             size = self.geometry()
             self.move((screen.width() - size.width()) // 2, 
                       (screen.height() - size.height()) // 2)
        except: pass

    # Dragging
    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.LeftButton:
            self.drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() == Qt.MouseButton.LeftButton and self.drag_pos:
            self.move(event.globalPosition().toPoint() - self.drag_pos)
            event.accept()

if __name__ == "__main__":
    import sys
    from PyQt6.QtWidgets import QApplication
    app = QApplication(sys.argv)
    cfg = {'work': 25, 'rest': 5}
    w = PomodoroSettingsWindow(cfg, lambda x: print(x))
    w.show()
    sys.exit(app.exec())
