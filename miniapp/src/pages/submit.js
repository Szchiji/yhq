/**
 * 提交报告页面
 */
function renderSubmit() {
    const content = document.getElementById('page-content');
    if (!content) return;

    content.innerHTML = `
        <div class="container">
            <div class="card">
                <h2 style="margin-bottom:16px;">📝 提交报告</h2>
                <p style="color:#666;margin-bottom:16px;">请通过 Telegram 机器人提交报告。</p>
                <p style="color:#999;font-size:14px;">点击下方按钮打开机器人对话</p>
                <div style="margin-top:16px;">
                    <a href="https://t.me/" class="btn btn-primary" target="_blank">
                        打开 Telegram 机器人
                    </a>
                </div>
            </div>
        </div>
    `;
}

window.renderSubmit = renderSubmit;
