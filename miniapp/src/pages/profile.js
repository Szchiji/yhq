/**
 * 个人资料页面
 */
function renderProfile() {
    const content = document.getElementById('page-content');
    if (!content) return;

    const isLoggedIn = window.auth && window.auth.isLoggedIn();

    content.innerHTML = `
        <div class="container">
            <div class="card">
                <h2 style="margin-bottom:16px;">👤 个人资料</h2>
                ${isLoggedIn ? `
                    <p style="margin-bottom:16px;">您已登录</p>
                    <button onclick="window.auth.clearToken();window.location.reload();" class="btn btn-danger">
                        退出登录
                    </button>
                ` : `
                    <p style="color:#666;margin-bottom:16px;">请通过 Telegram 机器人获取访问令牌后登录。</p>
                    <div style="display:flex;gap:8px;margin-bottom:12px;">
                        <input type="text" id="token-input" placeholder="输入访问令牌..."
                            style="flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;">
                        <button onclick="loginWithToken()" class="btn btn-primary">登录</button>
                    </div>
                `}
            </div>
        </div>
    `;

    window.loginWithToken = function () {
        const token = document.getElementById('token-input').value.trim();
        if (!token) return;
        window.auth.setToken(token);
        window.notify.success('登录成功！');
        renderProfile();
    };
}

window.renderProfile = renderProfile;
