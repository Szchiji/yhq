/**
 * 通知工具
 */
class Notify {
    show(message, type = 'info', duration = 3000) {
        const el = document.createElement('div');
        el.className = `notification notification-${type}`;
        el.textContent = message;
        el.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            padding: 12px 20px; border-radius: 6px; color: #fff;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration);
    }

    success(msg) { this.show(msg, 'success'); }
    error(msg) { this.show(msg, 'error'); }
    info(msg) { this.show(msg, 'info'); }
}

window.notify = new Notify();
