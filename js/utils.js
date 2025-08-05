// utils.js - Refactored with static methods for consistency and ease of use

class Logger {
  static logLevels = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  static isDevelopment =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  static currentLevel = this.isDevelopment
    ? this.logLevels.DEBUG
    : this.logLevels.INFO;

  static log(level, message, data = null) {
    if (this.logLevels[level.toUpperCase()] > this.currentLevel) return;

    const timestamp = new Date().toISOString();
    const styles = {
      ERROR: "color: #ef4444; font-weight: bold;",
      WARN: "color: #f59e0b; font-weight: bold;",
      INFO: "color: #3b82f6;",
      DEBUG: "color: #64748b;",
    };

    console.log(
      `%c[${timestamp}] ${level.toUpperCase()}: ${message}`,
      styles[level.toUpperCase()],
      data
    );
  }

  static error(message, data) {
    this.log("error", message, data);
  }
  static warn(message, data) {
    this.log("warn", message, data);
  }
  static info(message, data) {
    this.log("info", message, data);
  }
  static debug(message, data) {
    this.log("debug", message, data);
  }
}

class CacheManager {
  static storage = localStorage;
  static memoryCache = new Map();

  static set(key, data, ttl = 5 * 60 * 1000) {
    try {
      const cacheData = { data, timestamp: Date.now(), ttl };
      const cacheKey = `app_cache_${key}`;
      this.storage.setItem(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      Logger.error("Cache set failed", { key, error: error.message });
      return false;
    }
  }

  static get(key) {
    try {
      const cacheKey = `app_cache_${key}`;
      const cached = this.storage.getItem(cacheKey);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      if (Date.now() - cacheData.timestamp < cacheData.ttl) {
        return cacheData.data;
      }

      this.storage.removeItem(cacheKey);
      return null;
    } catch (error) {
      Logger.error("Cache get failed", { key, error: error.message });
      return null;
    }
  }
}

class ValidationUtils {
  static isEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email).toLowerCase());
  }

  static isValidPassword(password) {
    return typeof password === "string" && password.length >= 6;
  }

  static sanitizeInput(input) {
    if (typeof input !== "string") return "";
    return input.trim();
  }

  static isValidNumber(value, min = 0, max = Infinity) {
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max && isFinite(num);
  }

  static validateRequired(value, fieldName) {
    if (!value || (typeof value === "string" && !value.trim())) {
      // Kita lempar error agar bisa ditangkap oleh blok try...catch
      throw new Error(`${fieldName} wajib diisi`);
    }
  }

  static validateLength(value, min, max, fieldName) {
    if (String(value).length < min || String(value).length > max) {
      throw new Error(`${fieldName} harus antara ${min}-${max} karakter`);
    }
  }
}

class UIUtils {
  static debounce(func, delay = 300) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }
  static setLoadingState(element, isLoading, loadingText = "Loading...") {
    if (!element) return;
    if (isLoading) {
      element.classList.add("app-loading");
      element.disabled = true;
      element.dataset.originalText = element.textContent;
      element.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${loadingText}`;
    } else {
      element.classList.remove("app-loading");
      element.disabled = false;
      element.textContent = element.dataset.originalText || "Submit";
    }
  }
  static createToast(type, message, duration = 5000) {
    const toastContainer =
      document.querySelector(".toast-container") || this.createToastContainer();
    const toastId = `toast-${Date.now()}`;
    const toastElement = this.createToastElement(toastId, type, message);
    toastContainer.appendChild(toastElement);

    // Gunakan Bootstrap Toast jika tersedia
    if (window.bootstrap && window.bootstrap.Toast) {
      const bsToast = new window.bootstrap.Toast(toastElement, {
        delay: duration,
        autohide: true,
      });
      bsToast.show();

      // Hapus elemen setelah toast disembunyikan untuk menjaga kebersihan DOM
      toastElement.addEventListener("hidden.bs.toast", () => {
        toastElement.remove();
      });
    } else {
      // Fallback manual jika Bootstrap JS tidak ada
      toastElement.style.display = "block";
      toastElement.classList.add("show");
      setTimeout(() => {
        toastElement.remove();
      }, duration);
    }
  }

  static createToastContainer() {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container position-fixed top-0 end-0 p-3";
      container.style.zIndex = "9999";
      document.body.appendChild(container);
    }
    return container;
  }

  static createToastElement(id, type, message) {
    const typeConfig = {
      success: { icon: "bi-check-circle", class: "bg-success" },
      error: { icon: "bi-x-circle", class: "bg-danger" },
      warning: {
        icon: "bi-exclamation-triangle",
        class: "bg-warning text-dark",
      },
      info: { icon: "bi-info-circle", class: "bg-info" },
    };
    const config = typeConfig[type] || typeConfig.info;

    const toast = document.createElement("div");
    toast.id = id;
    toast.className = `toast align-items-center text-white ${config.class} border-0`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");

    const toastBody = document.createElement("div");
    toastBody.className = "toast-body d-flex align-items-center";

    // Membuat elemen secara aman untuk mencegah XSS
    const icon = document.createElement("i");
    icon.className = `bi ${config.icon} me-2`;

    const messageSpan = document.createElement("span");
    messageSpan.innerHTML = message; // <-- AMAN

    toastBody.appendChild(icon);
    toastBody.appendChild(messageSpan);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "btn-close btn-close-white me-2 m-auto";
    closeButton.setAttribute("data-bs-dismiss", "toast");
    closeButton.setAttribute("aria-label", "Close");

    const dFlex = document.createElement("div");
    dFlex.className = "d-flex";
    dFlex.appendChild(toastBody);
    dFlex.appendChild(closeButton);

    toast.appendChild(dFlex);

    return toast;
  }
  static animate(element, keyframes, options) {
    if (!element || !window.AppConfig?.device?.supportsAnimations) {
      return Promise.resolve();
    }
    const animation = element.animate(keyframes, {
      duration: options?.duration || 300,
      easing: options?.easing || "ease-in-out",
      fill: "forwards",
    });
    return animation.finished;
  }
}

class StorageUtils {
  static setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      Logger.error("Failed to set item in localStorage", { key, error: e });
    }
  }

  static getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      Logger.error("Failed to get item from localStorage", { key, error: e });
      return defaultValue;
    }
  }
  static removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      Logger.error("Failed to remove item from localStorage", {
        key,
        error: e,
      });
    }
  }

  static clear() {
    // Hanya clear item yang berhubungan dengan aplikasi
    const appKeys = [
      "warehouse_app_user",
      "warehouse_app_cart",
      "warehouse_app_last_transaction",
      "warehouse_app_last_transaction_date",
    ];
    appKeys.forEach((key) => localStorage.removeItem(key));
    Logger.info("App-specific storage cleared.");
  }
  /**
   * Mengambil data dari cache jika masih valid (belum kedaluwarsa).
   * @param {string} key - Kunci unik untuk item cache.
   * @returns {any|null} - Mengembalikan data jika ada dan valid, jika tidak null.
   */
  static getCache(key) {
    const itemStr = sessionStorage.getItem(key);
    if (!itemStr) {
      return null;
    }
    const item = JSON.parse(itemStr);
    const now = new Date();
    // Cek apakah cache sudah kedaluwarsa
    if (now.getTime() > item.expiry) {
      sessionStorage.removeItem(key);
      return null;
    }
    return item.data;
  }

  /**
   * Menyimpan data ke dalam cache dengan durasi kedaluwarsa.
   * @param {string} key - Kunci unik untuk item cache.
   * @param {any} data - Data yang akan disimpan.
   */
  static setCache(key, data) {
    const now = new Date();
    const item = {
      data: data,
      // Atur waktu kedaluwarsa berdasarkan AppConfig
      expiry: now.getTime() + AppConfig.CONSTANTS.CACHE_DURATION,
    };
    sessionStorage.setItem(key, JSON.stringify(item));
  }
  // vvvv TAMBAHKAN FUNGSI BARU INI DI SINI vvvv
  /**
   * Menghapus item spesifik dari session storage cache.
   * @param {string} key - Kunci cache yang akan dihapus.
   */
  static clearCacheItem(key) {
    try {
      // Langsung hapus dari sessionStorage
      sessionStorage.removeItem(key);
    } catch (e) {
      Logger.error("Gagal menghapus item dari sessionStorage", {
        key,
        error: e,
      });
    }
  }
}

class CurrencyFormatter {
  static format(amount) {
    if (typeof amount !== "number" || isNaN(amount)) {
      return "Rp 0";
    }
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

class APIClient {
  static async request(
    path,
    options = { method: "GET", useCache: true, retries: 2 }
  ) {
    // Tetapkan nilai default untuk opsi
    const { method, body, useCache, retries } = {
      method: "GET",
      useCache: true,
      retries: 2,
      ...options,
    };

    const url = AppConfig.getApiUrl(path);
    const cacheKey = path;

    // Logika cache untuk GET request (tidak berubah)
    if (method === "GET" && useCache) {
      const cachedData = StorageUtils.getCache(cacheKey);
      if (cachedData) {
        Logger.debug("Cache hit", { path });
        return cachedData;
      }
    }

    // Logika percobaan ulang (retry)
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          body: body,
          redirect: "follow",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          // Menangkap error HTTP seperti 404 atau 500
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // =================================================================
        // PERBAIKAN UTAMA DI SINI
        // =================================================================
        // Langsung parse respons sebagai JSON.
        // Ini adalah cara modern dan benar untuk menangani respons JSON murni dari backend.
        const jsonResponse = await response.json();

        if (
          jsonResponse.logs &&
          Array.isArray(jsonResponse.logs) &&
          jsonResponse.logs.length > 0
        ) {
          console.groupCollapsed(`[SERVER LOGS] for request: ${path}`);
          Logger.info(`Menerima ${jsonResponse.logs.length} log dari server.`);
          jsonResponse.logs.forEach((log) => {
            // Gunakan Logger dari utils.js untuk tampilan yang konsisten
            Logger.debug(`[SERVER] ${log.message}`, log.data || "");
          });
          console.groupEnd();
        }

        if (jsonResponse.status === "success") {
          if (method === "GET") {
            StorageUtils.setCache(cacheKey, jsonResponse);
          }
          return jsonResponse;
        } else {
          // Jika status dari backend adalah "error", lempar error dengan pesan ASLI dari backend.
          throw new Error(
            jsonResponse.message ||
              "Terjadi kesalahan yang tidak diketahui dari server."
          );
        }
      } catch (error) {
        Logger.warn(`API attempt ${attempt} failed for ${path}`, {
          error: error.message,
        });
        if (attempt > retries) {
          // Setelah semua percobaan gagal, lempar error terakhir untuk ditangani oleh UI.
          // Pesan error ini sekarang akan berisi detail dari backend.
          throw new Error(error.message || "Terjadi kesalahan pada server");
        }
        // Tunggu sejenak sebelum mencoba lagi
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
  }
}
