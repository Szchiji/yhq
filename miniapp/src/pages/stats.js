/**
 * 统计页面
 */
async function renderStats() {
    const content = document.getElementById('page-content');
    if (!content) return;

    content.innerHTML = '<div class="container"><div class="card"><p>加载中...</p></div></div>';

    try {
        const data = await fetch('/miniapp/api/ranking?limit=20')
            .then(r => r.json())
            .catch(() => ({ ranking: [] }));

        const ranking = data.ranking || [];
        const rows = ranking.map((item, i) => `
            <tr>
                <td style="padding:8px;">${i + 1}</td>
                <td style="padding:8px;">@${item.teacher_username || '未知'}</td>
                <td style="padding:8px;color:#28a745;">+${item.recommend_count || 0}</td>
                <td style="padding:8px;color:#dc3545;">${item.not_recommend_count || 0}</td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div class="container">
                <div class="card">
                    <h2 style="margin-bottom:16px;">📊 排行榜</h2>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f5f5f5;">
                                <th style="padding:8px;text-align:left;">排名</th>
                                <th style="padding:8px;text-align:left;">教师</th>
                                <th style="padding:8px;text-align:left;">好评</th>
                                <th style="padding:8px;text-align:left;">差评</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#999;">暂无数据</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<div class="container"><div class="card"><p>加载失败：${e.message}</p></div></div>`;
    }
}

window.renderStats = renderStats;
