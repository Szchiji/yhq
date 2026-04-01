/**
 * 菜单组件
 */
function renderMenu() {
    const menu = document.getElementById('menu');
    if (!menu) return;

    const items = [
        { hash: 'home', icon: '🏠', label: '首页' },
        { hash: 'query', icon: '🔍', label: '查询' },
        { hash: 'submit', icon: '📝', label: '提交' },
        { hash: 'stats', icon: '📊', label: '统计' },
        { hash: 'profile', icon: '👤', label: '我的' },
    ];

    menu.innerHTML = items.map(item => `
        <a href="#${item.hash}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;align-items:center;padding:4px 12px;font-size:12px;gap:2px;">
            <span style="font-size:20px;">${item.icon}</span>
            <span>${item.label}</span>
        </a>
    `).join('');
}

window.renderMenu = renderMenu;
