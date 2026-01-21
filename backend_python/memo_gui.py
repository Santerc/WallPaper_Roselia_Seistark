import sys
import json
from dataclasses import dataclass
from typing import Optional, Callable, Dict, Any

from PyQt6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout,
    QTextEdit, QLineEdit, QPushButton, QLabel, QCheckBox,
    QGraphicsDropShadowEffect, QFrame, QDateEdit,
    QGraphicsOpacityEffect, QSpinBox
)
from PyQt6.QtCore import (
    Qt, QPoint, QDateTime, QDate, QTime, QSize
)
from PyQt6.QtGui import (
    QColor, QFont, QPalette, QBrush, QAction, QIcon, QPainter, QLinearGradient
)

# ================== 配置常量（使用dataclass管理，更清晰） ==================
@dataclass(frozen=True)  # 不可变配置，符合Pythonic
class AppStyle:
    """应用样式配置常量"""
    bg_color: str = "rgba(20, 20, 20, 0.95)"
    border_color: str = "rgba(162, 155, 254, 0.4)"
    accent_color: str = "#a29bfe"
    accent_glow: str = "#6c5ce7"
    text_color: str = "#ffffff"
    input_bg: str = "rgba(255, 255, 255, 0.05)"
    input_border: str = "rgba(255, 255, 255, 0.1)"

# 初始化样式配置
STYLE_CONFIG = AppStyle()

# ================== 样式表生成（函数化，避免硬编码） ==================
def generate_stylesheet(config: AppStyle) -> str:
    """根据配置生成样式表"""
    return f"""
/* Global Reset */
QWidget {{
    font-family: 'Segoe UI', sans-serif;
    color: {config.text_color};
    outline: none;
}}

QWidget#Root {{ background: transparent; }}

QFrame#MainFrame {{
    background-color: {config.bg_color};
    border: 1px solid {config.border_color};
    border-radius: 16px;
}}

QLabel {{
    font-size: 11px;
    font-weight: 600;
    color: {config.accent_color};
    letter-spacing: 1px;
    margin-bottom: 4px;
}}

/* Text Area */
QTextEdit {{
    background-color: {config.input_bg};
    border: 1px solid {config.input_border};
    border-radius: 8px;
    color: white;
    padding: 10px;
    font-size: 14px;
    selection-background-color: {config.accent_color};
}}

/* Single Line Inputs */
QLineEdit, QDateEdit, QSpinBox {{
    background-color: {config.input_bg};
    border: 1px solid {config.input_border};
    border-radius: 8px;
    color: white;
    padding: 4px 10px;
    font-size: 14px;
    min-height: 25px;
    selection-background-color: {config.accent_color};
}}

/* DISABLED STATE - VISUAL FEEDBACK */
QLineEdit:disabled, QDateEdit:disabled, QSpinBox:disabled {{
    background-color: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.2);
    border: 1px dashed rgba(255, 255, 255, 0.1);
}}

QTextEdit:focus, QLineEdit:focus, QDateEdit:focus, QSpinBox:focus {{
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid {config.accent_color};
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
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 {config.accent_color}, stop:1 {config.accent_glow});
    border: none;
    color: white;
}}
QPushButton#SaveBtn:hover {{
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 {config.accent_glow}, stop:1 {config.accent_color});
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
    background-color: {config.accent_color}; /* On track */
    border: 1px solid {config.accent_glow};
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
    border-top: 6px solid {config.accent_color};
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
    background-color: {config.accent_color}; 
}}
/* Arrows inside SpinBox buttons */
QSpinBox::up-arrow {{
    width: 8px; height: 8px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-bottom: 5px solid {config.accent_color};
}}
QSpinBox::down-arrow {{
    width: 8px; height: 8px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid {config.accent_color};
}}
QSpinBox::up-button:hover {{ background-color: rgba(255,255,255,0.2); }}
QSpinBox::down-button:hover {{ background-color: rgba(255,255,255,0.2); }}

/* Calendar Popups */
QCalendarWidget QWidget {{ background-color: #2d3436; color: white; }}
QCalendarWidget QToolButton {{ color: {config.accent_color}; background: transparent; border: none; font-weight: bold; }}
QCalendarWidget QSpinBox {{ background-color: rgba(0,0,0,0.2); color: white; }}
QCalendarWidget QAbstractItemView:enabled {{ 
    background-color: #2d3436; color: white; 
    selection-background-color: {config.accent_color}; 
    selection-color: white; 
}}
QCalendarWidget QAbstractItemView:disabled {{ color: #636e72; }}
"""

# ================== 可拖拽标题栏组件 ==================
class DraggableTitleBar(QWidget):
    """可拖拽的窗口标题栏"""
    def __init__(self, parent: QWidget):
        super().__init__(parent)
        self._parent = parent
        self._init_ui()

    def _init_ui(self) -> None:
        """初始化UI组件"""
        layout = QHBoxLayout()
        layout.setContentsMargins(20, 15, 20, 5)
        self.setLayout(layout)

        # 标题标签
        title_label = QLabel("MEMO EDITOR")
        title_label.setStyleSheet(
            "font-size: 11px; font-weight: 800; letter-spacing: 2px; "
            "color: rgba(162, 155, 254, 0.8); background: transparent; border: none;"
        )

        # 关闭按钮
        close_btn = QPushButton("✕")
        close_btn.setObjectName("CloseBtn")
        close_btn.setFixedSize(30, 30)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.clicked.connect(self._parent.close)

        layout.addWidget(title_label)
        layout.addStretch()
        layout.addWidget(close_btn)

    def mousePressEvent(self, event) -> None:
        """鼠标按下事件 - 记录初始位置"""
        if event.button() == Qt.MouseButton.LeftButton:
            self._parent.old_pos = event.globalPosition().toPoint()

    def mouseMoveEvent(self, event) -> None:
        """鼠标移动事件 - 拖拽窗口"""
        if event.buttons() == Qt.MouseButton.LeftButton and self._parent.old_pos:
            current_pos = event.globalPosition().toPoint()
            delta = QPoint(current_pos - self._parent.old_pos)
            self._parent.move(self._parent.x() + delta.x(), self._parent.y() + delta.y())
            self._parent.old_pos = current_pos

    def mouseReleaseEvent(self, event) -> None:
        """鼠标释放事件 - 清空位置记录"""
        self._parent.old_pos = None

# ================== 主备忘录窗口 ==================
class MemoWindow(QWidget):
    """备忘录编辑窗口"""
    def __init__(
        self, 
        memo_data: Dict[str, Any],
        save_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
        delete_callback: Optional[Callable[[int], None]] = None
    ):
        super().__init__()
        self.memo_data = memo_data
        self.memo_id = memo_data.get('id', 0)
        self.save_callback = save_callback
        self.delete_callback = delete_callback
        self.old_pos = None

        self._init_window()
        self._init_layout()
        self._setup_ui()
        self._apply_styles()

    def _init_window(self) -> None:
        """初始化窗口属性"""
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Window)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.resize(420, 560)

    def _init_layout(self) -> None:
        """初始化布局结构"""
        # 主布局（用于阴影显示的外边距）
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(20, 20, 20, 20)
        self.setLayout(main_layout)

        # 主视觉框架
        self.frame = QFrame()
        self.frame.setObjectName("MainFrame")
        
        # 框架内布局
        frame_layout = QVBoxLayout()
        frame_layout.setContentsMargins(0, 0, 0, 25)
        frame_layout.setSpacing(15)
        self.frame.setLayout(frame_layout)
        
        # 添加阴影效果
        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(35)
        shadow.setColor(QColor(STYLE_CONFIG.accent_color))
        shadow.setOffset(0, 0)
        self.frame.setGraphicsEffect(shadow)

        main_layout.addWidget(self.frame)

    def _setup_ui(self) -> None:
        """构建UI内容"""
        frame_layout = self.frame.layout()
        
        # 添加标题栏
        title_bar = DraggableTitleBar(self)
        frame_layout.addWidget(title_bar)

        # 内容容器
        content_container = QVBoxLayout()
        content_container.setContentsMargins(25, 0, 25, 0)
        content_container.setSpacing(15)
        frame_layout.addLayout(content_container)

        # 标题输入
        content_container.addWidget(QLabel("TITLE"))
        self.title_edit = QLineEdit()
        self.title_edit.setText(self.memo_data.get('title', ''))
        self.title_edit.setPlaceholderText("Enter title...")
        content_container.addWidget(self.title_edit)

        # 内容编辑区
        content_container.addWidget(QLabel("CONTENT"))
        self.text_edit = QTextEdit()
        self.text_edit.setPlainText(self.memo_data.get('content', self.memo_data.get('text', '')))
        self.text_edit.setPlaceholderText("Write details here...")
        content_container.addWidget(self.text_edit)

        # 截止日期区域
        self._setup_deadline_section(content_container)

        # 提醒开关
        content_container.addSpacing(5)
        self.reminder_check = QCheckBox("Enable Reminder Notification")
        self.reminder_check.setCursor(Qt.CursorShape.PointingHandCursor)
        self.reminder_check.setChecked(self.memo_data.get('enableReminder', False))
        content_container.addWidget(self.reminder_check)

        # 底部按钮区
        self._setup_bottom_buttons(content_container)

    def _setup_deadline_section(self, parent_layout: QVBoxLayout) -> None:
        """设置截止日期区域"""
        parent_layout.addSpacing(5)
        
        # 标题 + 复选框
        h_layout = QHBoxLayout()
        h_layout.addWidget(QLabel("DEADLINE"))
        h_layout.addStretch()
        self.enable_date_chk = QCheckBox("Set Date")
        self.enable_date_chk.setCursor(Qt.CursorShape.PointingHandCursor)
        self.enable_date_chk.toggled.connect(self.toggle_date_inputs)
        h_layout.addWidget(self.enable_date_chk)
        parent_layout.addLayout(h_layout)
        
        parent_layout.addSpacing(10)

        # 日期和时间输入
        dt_layout = QHBoxLayout()
        dt_layout.setSpacing(20)
        
        # 日期选择器
        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("yyyy-MM-dd")
        self.date_edit.setCursor(Qt.CursorShape.IBeamCursor)
        
        # 小时选择器
        self.hour_spin = QSpinBox()
        self.hour_spin.setRange(0, 23)
        self.hour_spin.setPrefix(" ")
        self.hour_spin.setSuffix(" h")
        self.hour_spin.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.hour_spin.setCursor(Qt.CursorShape.PointingHandCursor)
        
        # 分钟选择器
        self.min_spin = QSpinBox()
        self.min_spin.setRange(0, 59)
        self.min_spin.setPrefix(" ")
        self.min_spin.setSuffix(" m")
        self.min_spin.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.min_spin.setCursor(Qt.CursorShape.PointingHandCursor)

        # 初始化日期时间数据
        self._init_datetime_values()

        # 添加到布局
        dt_layout.addWidget(self.date_edit, 5)
        dt_layout.addWidget(self.hour_spin, 2)
        dt_layout.addWidget(self.min_spin, 2)
        parent_layout.addLayout(dt_layout)

    def _init_datetime_values(self) -> None:
        """初始化日期时间值"""
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
        self.toggle_date_inputs(has_date)

    def _setup_bottom_buttons(self, parent_layout: QVBoxLayout) -> None:
        """设置底部按钮区域"""
        parent_layout.addSpacing(20)
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(15)
        
        # 取消按钮
        cancel_btn = QPushButton("CANCEL")
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.clicked.connect(self.close)
        
        # 保存按钮
        save_btn = QPushButton("SAVE")
        save_btn.setObjectName("SaveBtn")
        save_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        save_btn.clicked.connect(self.save)
        
        # 如果有备忘录ID，显示删除按钮
        if self.memo_id:
            delete_btn = QPushButton("DELETE")
            delete_btn.setObjectName("DeleteBtn")
            delete_btn.setCursor(Qt.CursorShape.PointingHandCursor)
            delete_btn.clicked.connect(self.delete_memo)
            btn_layout.addWidget(delete_btn)

        btn_layout.addStretch()
        btn_layout.addWidget(cancel_btn)
        btn_layout.addWidget(save_btn)
        
        parent_layout.addLayout(btn_layout)

    def _apply_styles(self) -> None:
        """应用样式表"""
        self.setStyleSheet(generate_stylesheet(STYLE_CONFIG))

    def toggle_date_inputs(self, checked: bool) -> None:
        """切换日期输入框的启用状态"""
        self.date_edit.setEnabled(checked)
        self.hour_spin.setEnabled(checked)
        self.min_spin.setEnabled(checked)

    def delete_memo(self) -> None:
        """删除备忘录"""
        if not self.memo_id or not self.delete_callback:
            return
            
        try:
            self.delete_callback(self.memo_id)
            self.close()
        except Exception as e:
            error_msg = f"Error deleting memo: {str(e)}"
            print(error_msg)
            self.text_edit.setPlaceholderText(error_msg)

    def save(self) -> None:
        """保存备忘录"""
        # 收集表单数据
        payload = self._collect_form_data()
        
        # 调用保存回调
        if self.save_callback:
            try:
                self.save_callback(payload)
                self.close()
            except Exception as e:
                error_msg = f"Error saving memo: {str(e)}"
                print(error_msg)
                self.text_edit.setPlaceholderText(error_msg)

    def _collect_form_data(self) -> Dict[str, Any]:
        """收集表单数据并返回标准化的payload"""
        title = self.title_edit.text().strip()
        content = self.text_edit.toPlainText().strip()
        date_str = None
        
        if self.enable_date_chk.isChecked():
            date = self.date_edit.date()
            time = QTime(self.hour_spin.value(), self.min_spin.value())
            date_str = f"{date.toString('yyyy-MM-dd')}T{time.toString('HH:mm')}:00"
            
        return {
            "id": self.memo_id if self.memo_id else None,
            "title": title,
            "content": content,
            "text": content,  # 兼容旧版字段
            "dueDate": date_str,
            "enableReminder": self.reminder_check.isChecked()
        }

# ================== 运行入口 ==================
def run_editor(json_data_str: Optional[str] = None) -> None:
    """运行备忘录编辑器
    
    Args:
        json_data_str: 可选的JSON字符串，用于初始化备忘录数据
    """
    # 获取或创建应用实例
    app = QApplication.instance() or QApplication(sys.argv)

    # 解析初始化数据
    memo_data = {}
    if json_data_str:
        try:
            memo_data = json.loads(json_data_str)
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON data: {e}")
            
    # 测试用的mock回调
    def mock_save(data: Dict[str, Any]) -> None:
        """模拟保存回调"""
        print(f"[MOCK SAVE] Memo saved: {json.dumps(data, indent=2)}")
        
    def mock_delete(memo_id: int) -> None:
        """模拟删除回调"""
        print(f"[MOCK DELETE] Memo deleted (ID: {memo_id})")

    # 创建并显示窗口
    window = MemoWindow(memo_data, mock_save, mock_delete)
    window.show()
    
    # 运行应用
    app.exec()

if __name__ == "__main__":
    # 支持命令行传入JSON测试数据
    input_json = sys.argv[1] if len(sys.argv) > 1 else None
    run_editor(input_json)