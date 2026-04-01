/**
 * 应用入口
 */
(async function () {
    // 初始化认证
    window.auth.initFromStorage();

    // 隐藏加载画面，显示主内容
    const loading = document.getElementById('loading');
    const mainContent = document.getElementById('main-content');

    try {
        // 渲染头部和菜单
        if (window.renderHeader) window.renderHeader();
        if (window.renderMenu) window.renderMenu();

        // 根据 hash 路由渲染页面
        function route() {
            const hash = window.location.hash.slice(1) || 'home';
            const validPages = ['home', 'submit', 'query', 'stats', 'profile'];
            const pageName = validPages.includes(hash) ? hash : 'home';
            const pages = {
                home: window.renderHome,
                submit: window.renderSubmit,
                query: window.renderQuery,
                stats: window.renderStats,
                profile: window.renderProfile,
            };
            const render = pages[pageName];
            if (typeof render === 'function') render();
        }

        window.addEventListener('hashchange', route);
        route();

        if (loading) loading.style.display = 'none';
        if (mainContent) mainContent.style.display = 'block';
    } catch (e) {
        console.error('App initialization error:', e);
        if (loading) loading.innerHTML = '<p>加载失败，请刷新页面。</p>';
    }
})();
