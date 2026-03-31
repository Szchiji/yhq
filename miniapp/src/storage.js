/**
 * 本地存储工具
 */
class Storage {
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    remove(key) {
        localStorage.removeItem(key);
    }

    clear() {
        localStorage.clear();
    }
}

window.storage = new Storage();
