/**
 * API 客户端
 */
const API_BASE = window.API_BASE || '';

class ApiClient {
    constructor(baseUrl = API_BASE) {
        this.baseUrl = baseUrl;
        this.token = null;
    }

    setToken(token) {
        this.token = token;
    }

    async request(method, path, data = null) {
        const url = `${this.baseUrl}/api/v1${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        const options = { method, headers };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }
        return response.json();
    }

    get(path) { return this.request('GET', path); }
    post(path, data) { return this.request('POST', path, data); }
    put(path, data) { return this.request('PUT', path, data); }
    delete(path) { return this.request('DELETE', path); }

    // 报告 API
    async getRanking(limit = 10) {
        return this.get(`/reports/ranking?limit=${limit}`);
    }

    async getStats() {
        return this.get('/reports/stats');
    }

    async getPendingReports(page = 1) {
        return this.get(`/reports/?page=${page}`);
    }

    async approveReport(id) {
        return this.post(`/reports/${id}/approve`);
    }

    async rejectReport(id, reason = '') {
        return this.post(`/reports/${id}/reject?reason=${encodeURIComponent(reason)}`);
    }
}

window.apiClient = new ApiClient();
