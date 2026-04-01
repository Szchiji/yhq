/**
 * 认证模块
 */
class Auth {
    constructor() {
        this.storageKey = 'report_system_token';
    }

    getToken() {
        return localStorage.getItem(this.storageKey);
    }

    setToken(token) {
        localStorage.setItem(this.storageKey, token);
        if (window.apiClient) {
            window.apiClient.setToken(token);
        }
    }

    clearToken() {
        localStorage.removeItem(this.storageKey);
    }

    isLoggedIn() {
        return !!this.getToken();
    }

    initFromStorage() {
        const token = this.getToken();
        if (token && window.apiClient) {
            window.apiClient.setToken(token);
        }
    }
}

window.auth = new Auth();
