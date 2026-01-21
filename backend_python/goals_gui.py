import json
from dataclasses import dataclass
from typing import List, Optional, Callable

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton,
    QLabel, QFrame, QGraphicsDropShadowEffect, QListWidget, QListWidgetItem
)
from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtGui import QColor


# ================== 配置常量（集中管理，便于修改） ==================
@dataclass(frozen=True)  # 不可变数据类，管理样式配置
class UIConfig:
    # 缩放比例（核心控制：输入框下方元素缩小为2/3）
    SCALE_FACTOR = 2/3
    
    # 颜色配置
    BG_COLOR = "rgba(20, 20, 20, 0.95)"
    BORDER_COLOR = "rgba(162, 155, 254, 0.4)"
    ACCENT_COLOR = "#a29bfe"
    TEXT_COLOR = "#ffffff"
    INPUT_BG = "rgba(255, 255, 255, 0.05)"
    INPUT_BORDER = "rgba(255, 255, 255, 0.1)"
    
    # 基础尺寸（原尺寸）
    BASE_WINDOW_SIZE = (700, 650)
    BASE_LIST_ITEM_HEIGHT = 90
    BASE_CHECK_BTN_SIZE = (36, 36)
    BASE_DEL_BTN_SIZE = (36, 36)
    BASE_LIST_TEXT_HEIGHT = 50
    
    # 缩放后尺寸（自动计算，无需手动改）
    @property
    def SCALED_LIST_ITEM_HEIGHT(self) -> int:
        return int(self.BASE_LIST_ITEM_HEIGHT * self.SCALE_FACTOR)
    
    @property
    def SCALED_CHECK_BTN_SIZE(self) -> tuple[int, int]:
        return (int(self.BASE_CHECK_BTN_SIZE[0] * self.SCALE_FACTOR),
                int(self.BASE_CHECK_BTN_SIZE[1] * self.SCALE_FACTOR))
    
    @property
    def SCALED_DEL_BTN_SIZE(self) -> tuple[int, int]:
        return (int(self.BASE_DEL_BTN_SIZE[0] * self.SCALE_FACTOR),
                int(self.BASE_DEL_BTN_SIZE[1] * self.SCALE_FACTOR))
    
    @property
    def SCALED_LIST_TEXT_HEIGHT(self) -> int:
        return int(self.BASE_LIST_TEXT_HEIGHT * self.SCALE_FACTOR)

# 初始化配置实例
UI_CONFIG = UIConfig()

# ================== 样式表（基于配置动态生成） ==================
def get_stylesheet() -> str:
    """生成统一的样式表，基于UI_CONFIG配置"""
    return f"""
    QWidget {{
        font-family: 'Segoe UI', sans-serif;
        color: {UI_CONFIG.TEXT_COLOR};
        outline: none;
    }}
    QFrame#MainFrame {{
        background-color: {UI_CONFIG.BG_COLOR};
        border: 1px solid {UI_CONFIG.BORDER_COLOR};
        border-radius: 16px;
    }}
    QLabel {{ 
        font-weight: 600; 
        color: {UI_CONFIG.ACCENT_COLOR}; 
        letter-spacing: 1px; 
    }}
    QLineEdit {{
        background-color: {UI_CONFIG.INPUT_BG};
        border: 1px solid {UI_CONFIG.INPUT_BORDER};
        border-radius: 6px;
        color: white;
        padding: 8px;
        font-size: 13px;
    }}
    QLineEdit:focus {{ 
        border: 1px solid {UI_CONFIG.ACCENT_COLOR}; 
    }}
    QPushButton {{
        background-color: {UI_CONFIG.INPUT_BG};
        border: 1px solid {UI_CONFIG.INPUT_BORDER};
        border-radius: 8px;
        padding: 6px 12px;
        font-weight: 600;
    }}
    QPushButton:hover {{ 
        background-color: rgba(162, 155, 254, 0.15); 
        border-color: {UI_CONFIG.ACCENT_COLOR}; 
    }}
    QListWidget {{
        background: transparent;
        border: none;
    }}
    QListWidget::item {{
        background-color: {UI_CONFIG.INPUT_BG};
        border-radius: 6px;
        padding: 8px;
        margin-bottom: 5px;
    }}
    QListWidget::item:hover {{
        background-color: rgba(255,255,255,0.1);
    }}
    """

# ================== 可拖拽标题栏组件 ==================
class DraggableTitleBar(QWidget):
    def __init__(self, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.parent_window = parent  # 重命名，语义更清晰
        self._setup_layout()
        self._setup_widgets()

    def _setup_layout(self) -> None:
        """初始化布局（模块化拆分）"""
        layout = QHBoxLayout()
        layout.setContentsMargins(15, 10, 15, 5)
        self.setLayout(layout)

    def _setup_widgets(self) -> None:
        """初始化标题栏组件"""
        # 标题标签
        title_label = QLabel("DAILY GOALS EDITOR")
        title_label.setStyleSheet(f"font-size: 13px; color: {UI_CONFIG.ACCENT_COLOR};")
        
        # 关闭按钮
        close_btn = QPushButton("×")
        close_btn.setFixedSize(30, 30)
        close_btn.setStyleSheet("""
            QPushButton { 
                background: transparent; border: none; font-size: 20px; color: #aaa; 
            }
            QPushButton:hover { color: #ff7675; }
        """)
        close_btn.clicked.connect(self.parent_window.close)
        
        # 添加组件到布局
        layout = self.layout()
        layout.addWidget(title_label)
        layout.addStretch()
        layout.addWidget(close_btn)

    # 鼠标事件：实现拖拽
    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.MouseButton.LeftButton:
            self.parent_window.old_pos = event.globalPosition().toPoint()

    def mouseMoveEvent(self, event) -> None:
        if event.buttons() == Qt.MouseButton.LeftButton and self.parent_window.old_pos:
            current_pos = event.globalPosition().toPoint()
            delta = QPoint(current_pos - self.parent_window.old_pos)
            self.parent_window.move(self.parent_window.x() + delta.x(), 
                                    self.parent_window.y() + delta.y())
            self.parent_window.old_pos = current_pos
            
    def mouseReleaseEvent(self, event) -> None:
         self.parent_window.old_pos = None

# ================== 目标数据类型（类型提示） ==================
GoalItem = dict[str, str | bool]  # 目标项类型别名

# ================== 主窗口 ==================
class GoalsWindow(QWidget):
    def __init__(self, items: List[GoalItem], save_callback: Optional[Callable] = None):
        super().__init__()
        self.items = items.copy() if items else []  # 深拷贝，避免外部修改影响
        self.save_callback = save_callback
        self.old_pos = None
        
        # 窗口基础配置
        self._setup_window()
        # 初始化布局和组件
        self._setup_layout()
        # 初始化UI
        self._setup_ui()

    def _setup_window(self) -> None:
        """窗口基础配置（模块化）"""
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Window)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.resize(*UI_CONFIG.BASE_WINDOW_SIZE)  # 解包元组，更简洁

    def _setup_layout(self) -> None:
        """初始化主布局"""
        # 主布局
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(20, 20, 20, 20)
        self.setLayout(main_layout)

        # 主框架（带阴影）
        self.frame = QFrame()
        self.frame.setObjectName("MainFrame")
        frame_layout = QVBoxLayout()
        frame_layout.setContentsMargins(0, 0, 0, 25)
        self.frame.setLayout(frame_layout)
        main_layout.addWidget(self.frame)

        # 阴影效果
        shadow = QGraphicsDropShadowEffect()
        shadow.setBlurRadius(35)
        shadow.setColor(QColor(UI_CONFIG.ACCENT_COLOR))
        shadow.setOffset(0, 0)
        self.frame.setGraphicsEffect(shadow)

        # 应用样式表
        self.setStyleSheet(get_stylesheet())

    def _setup_ui(self) -> None:
        """初始化所有UI组件"""
        frame_layout = self.frame.layout()
        
        # 1. 标题栏
        title_bar = DraggableTitleBar(self)
        frame_layout.addWidget(title_bar)
        
        # 2. 内容区域
        content_layout = QVBoxLayout()
        content_layout.setContentsMargins(20, 0, 20, 0)
        content_layout.setSpacing(15)
        
        # 2.1 新增目标输入行
        self._setup_new_item_input(content_layout)
        
        # 2.2 目标列表
        self.list_widget = QListWidget()
        content_layout.addWidget(self.list_widget)
        self.populate_list()
        
        # 2.3 保存按钮
        self._setup_save_button(content_layout)
        
        # 添加内容布局到主框架
        frame_layout.addLayout(content_layout)

    def _setup_new_item_input(self, parent_layout: QVBoxLayout) -> None:
        """初始化新增目标输入行"""
        input_row = QHBoxLayout()
        
        # 输入框
        self.new_input = QLineEdit()
        self.new_input.setPlaceholderText("Add new goal...")
        self.new_input.setFixedHeight(40)
        self.new_input.setStyleSheet("font-size: 14px; padding: 0 10px;")
        self.new_input.returnPressed.connect(self.add_item)
        
        # 添加按钮
        add_btn = QPushButton("+")
        add_btn.setFixedSize(40, 40)
        add_btn.setStyleSheet(f"""
            background-color: {UI_CONFIG.ACCENT_COLOR}; color: black; 
            border-radius: 8px; font-size: 20px; font-weight: bold;
        """)
        add_btn.clicked.connect(self.add_item)
        
        input_row.addWidget(self.new_input)
        input_row.addWidget(add_btn)
        parent_layout.addLayout(input_row)

    def _setup_save_button(self, parent_layout: QVBoxLayout) -> None:
        """初始化保存按钮"""
        save_btn = QPushButton("SAVE CHANGES")
        save_btn.setFixedHeight(45)
        save_btn.setStyleSheet(f"""
            background-color: {UI_CONFIG.ACCENT_COLOR}; color: black; border: none;
            border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px;
        """)
        save_btn.clicked.connect(self.save_and_close)
        parent_layout.addWidget(save_btn)

    # ================== 列表操作 ==================
    def populate_list(self) -> None:
        """填充目标列表"""
        self.list_widget.clear()
        for idx, item in enumerate(self.items):
            self._create_list_item(item, idx)

    def _create_list_item(self, item_data: GoalItem, index: int) -> None:
        """创建单个列表项（私有方法，下划线命名）"""
        # 列表项容器
        item_widget = QWidget()
        layout = QHBoxLayout()
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(15)
        
        # 1. 完成状态按钮（缩放后尺寸）
        is_done = item_data.get("done", False)
        check_btn = QPushButton("✔" if is_done else "")
        check_btn.setFixedSize(*UI_CONFIG.SCALED_CHECK_BTN_SIZE)  # 缩放
        check_btn.setCheckable(True)
        check_btn.setChecked(is_done)
        
        # 动态设置按钮样式
        bg_color = UI_CONFIG.ACCENT_COLOR if is_done else "transparent"
        text_color = "black" if is_done else "transparent"
        check_btn.setStyleSheet(f"""
            QPushButton {{
                background: {bg_color}; border: 2px solid {UI_CONFIG.ACCENT_COLOR}; 
                border-radius: 8px; color: {text_color}; 
                font-weight: bold; font-size: {int(20 * UI_CONFIG.SCALE_FACTOR)}px;
            }}
            QPushButton:hover {{ border-color: white; }}
        """)
        check_btn.clicked.connect(lambda: self.toggle_item_done(index))
        
        # 2. 目标文本框（缩放后高度）
        text_edit = QLineEdit(item_data.get("text", ""))
        text_edit.setFixedHeight(UI_CONFIG.SCALED_LIST_TEXT_HEIGHT)  # 缩放
        
        # 文本框样式（完成状态加删除线）
        base_style = """
            background: transparent; border: none; 
            font-size: {font_size}px; color: white; 
            border-bottom: 1px solid rgba(255,255,255,0.1);
        """.format(font_size=int(20 * UI_CONFIG.SCALE_FACTOR))  # 字体也缩放
        
        if is_done:
            base_style += "color: rgba(255,255,255,0.5); text-decoration: line-through;"
        text_edit.setStyleSheet(base_style)
        text_edit.textChanged.connect(lambda t: self.update_item_text(index, t))
        
        # 3. 删除按钮（缩放后尺寸）
        del_btn = QPushButton("×")
        del_btn.setFixedSize(*UI_CONFIG.SCALED_DEL_BTN_SIZE)  # 缩放
        del_btn.setStyleSheet(f"""
            QPushButton {{ 
                background: rgba(255, 118, 117, 0.2); color: #ff7675; 
                border: 1px solid #ff7675; border-radius: 8px; 
                font-size: {int(24 * UI_CONFIG.SCALE_FACTOR)}px; line-height: 24px;
            }}
            QPushButton:hover {{ background: #ff7675; color: white; }}
        """)
        del_btn.clicked.connect(lambda: self.remove_item(index))
        
        # 组装布局
        layout.addWidget(check_btn)
        layout.addWidget(text_edit)
        layout.addWidget(del_btn)
        item_widget.setLayout(layout)
        
        # 设置列表项尺寸（缩放后）
        list_item = QListWidgetItem(self.list_widget)
        size_hint = item_widget.sizeHint()
        size_hint.setHeight(UI_CONFIG.SCALED_LIST_ITEM_HEIGHT)  # 缩放
        list_item.setSizeHint(size_hint)
        self.list_widget.setItemWidget(list_item, item_widget)

    # ================== 事件处理 ==================
    def toggle_item_done(self, index: int) -> None:
        """切换目标完成状态"""
        if 0 <= index < len(self.items):
            self.items[index]["done"] = not self.items[index].get("done", False)
            self.populate_list()

    def add_item(self) -> None:
        """添加新目标"""
        text = self.new_input.text().strip()
        if text:
            self.items.append({"text": text, "done": False})
            self.new_input.clear()
            self.populate_list()

    def remove_item(self, index: int) -> None:
        """删除目标"""
        if 0 <= index < len(self.items):
            self.items.pop(index)
            self.populate_list()

    def update_item_text(self, index: int, text: str) -> None:
        """更新目标文本"""
        if 0 <= index < len(self.items):
            self.items[index]["text"] = text

    def save_and_close(self) -> None:
        """保存并关闭窗口"""
        if callable(self.save_callback):  # 类型检查，更健壮
            self.save_callback(self.items)
        self.close()

# # ================== 测试入口 ==================
# if __name__ == "__main__":
#     import sys
#     from PyQt6.QtWidgets import QApplication

#     # 测试数据
#     TEST_GOALS = [
#         {"text": "学习Pythonic代码风格", "done": True},
#         {"text": "调整UI缩放比例", "done": False}
#     ]

#     # 保存回调函数
#     def save_goals(goals: List[GoalItem]) -> None:
#         """保存目标到JSON文件"""
#         with open("goals.json", "w", encoding="utf-8") as f:
#             json.dump(goals, f, ensure_ascii=False, indent=2)
#         print("目标已保存：", goals)

#     # 启动应用
#     app = QApplication(sys.argv)
#     window = GoalsWindow(TEST_GOALS, save_goals)
#     window.show()
#     sys.exit(app.exec())
