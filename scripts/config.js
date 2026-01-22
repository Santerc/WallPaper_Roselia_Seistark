export const BACKEND_URL = "http://127.0.0.1:35678";

// 全局配置对象
export const state = {
    currentConfig: { 
        apps: [], 
        memos: [], 
        dailyGoals: { date: "", items: [] }, 
        musicPath: "", 
        autoStart: false, 
        debug: false 
    },
    isDockOpen: false,
    isSettingsOpen: false,
    editingIndex: -1 // -1 表示添加新项
};

// 数据迁移助手
export function normalizeConfig(data) {
    // 如果需要，将旧的扁平格式转换为新的数组格式
    if (!data.apps) {
        data.apps = [];
        if (data.app1) data.apps.push({ name: "App Slot 01", path: data.app1 });
        if (data.app2) data.apps.push({ name: "App Slot 02", path: data.app2 });
        if (data.app3) data.apps.push({ name: "App Slot 03", path: data.app3 });
    }
    return data;
}
