/**
 * 管理员页面
 */
async function renderAdmin() {
    const content = document.getElementById('page-content');
    if (!content) return;

    if (!window.auth || !window.auth.isLoggedIn()) {
        content.innerHTML = `
            <div class="container">
                <div class="card">
                    <h2>🔒 管理员面板</h2>
                    <p style="color:#999;margin-top:16px;">请先登录</p>
                </div>
            </div>
        `;
        return;
    }

    content.innerHTML = '<div class="container"><div class="card"><p>加载中...</p></div></div>';

    try {
        const [stats, rateStats] = await Promise.all([
            window.apiClient.getStats().catch(() => ({})),
            window.apiClient.get('/admin/stats').catch(() => ({})),
        ]);

        content.innerHTML = `
            <div class="container">
                <div class="card">
                    <h2 style="margin-bottom:16px;">🔧 管理员面板</h2>
                    <pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;">
${JSON.stringify(stats, null, 2)}
                    </pre>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="container"><div class="card"><p>加载失败：${e.message}</p></div></div>`;
    }
}

window.renderAdmin = renderAdmin;
