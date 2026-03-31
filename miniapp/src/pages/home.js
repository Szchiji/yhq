/**
 * 首页
 */
async function renderHome() {
    const content = document.getElementById('page-content');
    if (!content) return;

    content.innerHTML = '<div class="container"><div class="card"><p>加载中...</p></div></div>';

    try {
        const data = await window.apiClient.getRanking(5).catch(() => ({ ranking: [] }));
        const ranking = data.ranking || [];

        const rankingHtml = ranking.length > 0
            ? ranking.map((item, i) => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;">
                    <span>${['🥇','🥈','🥉'][i] || (i+1)+'.'} @${item.teacher_username || '未知'}</span>
                    <span style="color:#28a745;">+${item.recommend_count || 0}</span>
                </div>
            `).join('')
            : '<p style="color:#999;">暂无数据</p>';

        content.innerHTML = `
            <div class="container">
                <div class="card">
                    <h2 style="margin-bottom:16px;">📊 Report System</h2>
                    <p style="color:#666;margin-bottom:24px;">企业级报告管理系统</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
                        <a href="#query" class="btn btn-primary" style="text-align:center;">🔍 搜索教师</a>
                        <a href="#submit" class="btn btn-success" style="text-align:center;">📝 提交报告</a>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:12px;">🏆 好评榜 Top 5</h3>
                    ${rankingHtml}
                    <div style="text-align:center;margin-top:12px;">
                        <a href="#stats" style="color:#2d6cdf;">查看完整排行榜 →</a>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="container"><div class="card"><p>加载失败：${e.message}</p></div></div>`;
    }
}

window.renderHome = renderHome;
