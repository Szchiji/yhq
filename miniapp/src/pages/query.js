/**
 * 查询页面
 */
function renderQuery() {
    const content = document.getElementById('page-content');
    if (!content) return;

    content.innerHTML = `
        <div class="container">
            <div class="card">
                <h2 style="margin-bottom:16px;">🔍 查询教师</h2>
                <div style="display:flex;gap:8px;margin-bottom:16px;">
                    <input type="text" id="search-input" placeholder="输入教师用户名..."
                        style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px;">
                    <button onclick="doSearch()" class="btn btn-primary">搜索</button>
                </div>
                <div id="search-results"></div>
            </div>
        </div>
    `;

    window.doSearch = async function () {
        const q = document.getElementById('search-input').value.trim();
        const resultsEl = document.getElementById('search-results');
        if (!q) return;

        resultsEl.innerHTML = '<p>搜索中...</p>';
        try {
            const data = await fetch(`/miniapp/api/search?q=${encodeURIComponent(q)}&limit=10`)
                .then(r => r.json())
                .catch(() => ({ results: [] }));

            const results = data.results || [];
            if (!results.length) {
                resultsEl.innerHTML = '<p style="color:#999;">未找到相关结果</p>';
                return;
            }
            resultsEl.innerHTML = results.map(item => `
                <div style="padding:12px 0;border-bottom:1px solid #eee;">
                    <strong>@${item.teacher_username || '未知'}</strong>
                </div>
            `).join('');
        } catch (e) {
            resultsEl.innerHTML = `<p style="color:#dc3545;">查询失败：${e.message}</p>`;
        }
    };
}

window.renderQuery = renderQuery;
