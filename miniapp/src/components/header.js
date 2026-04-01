/**
 * 头部组件
 */
function renderHeader() {
    const header = document.getElementById('header');
    if (!header) return;
    header.innerHTML = `
        <div style="background:#2d6cdf;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">📊</span>
            <span style="font-size:18px;font-weight:600;">Report System</span>
        </div>
    `;
}

window.renderHeader = renderHeader;
