// ==========================================
// 1. 时钟和日期逻辑
// ==========================================
export function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    const dayStr = `${dayNames[now.getDay()]} | ${monthNames[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');

    if(clockEl) clockEl.innerText = `${hours}:${minutes}`;
    if(dateEl) dateEl.innerText = dayStr;
}

// 启动时钟循环
export function initClock() {
    setInterval(updateClock, 1000);
    updateClock();
}
