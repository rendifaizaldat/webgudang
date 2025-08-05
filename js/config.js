// config.js - Refactored with static properties and methods for consistency

class AppConfig {
  // Semua properti sekarang statis
  static API_ENDPOINTS = {
    SCRIPT_URL:
      "https://script.google.com/macros/s/AKfycbzL0CusSVjw4pNgevXAkYQ5oxTyyGcFMreSKOn-MIbiewvpgglFHQlprk6Kcr-fJPz6/exec", // Ganti dengan URL Deploy baru Anda jika ada
  };

  static CONSTANTS = {
    MAX_RETRY_ATTEMPTS: 3,
    REQUEST_TIMEOUT: 15000,
    CACHE_DURATION: 5 * 60 * 1000,
    DEBOUNCE_DELAY: 300,
    VIRTUAL_SCROLL_THRESHOLD: 100,
  };

  static STORAGE_KEYS = {
    USER: "warehouse_app_user",
    CART: "warehouse_app_cart",
    LAST_TRANSACTION: "warehouse_app_last_transaction",
    LAST_TRANSACTION_DATE: "warehouse_app_last_transaction_date",
    USER_FOR_INVOICE: "warehouse_app_user_for_invoice",
  };

  static ROUTES = {
    LOGIN: "index.html",
    CATALOG: "katalog.html",
    CART: "keranjang.html",
    INVOICE: "invoice.html",
    ADMIN: "admin.html",
  };

  // Properti `device` juga statis
  static device = {
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    hasTouch: false,
    supportsWebP: false,
    supportsAnimations: true,
  };

  // Semua metode sekarang statis
  static init() {
    this.detectDevice();
    this.setupGlobalErrorHandler();
  }

  static detectDevice() {
    const width = window.innerWidth;
    this.device.isMobile = width < 768;
    this.device.isTablet = width >= 768 && width < 1024;
    this.device.isDesktop = width >= 1024;
    this.device.hasTouch = "ontouchstart" in window;
    this.device.supportsAnimations = !window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }

  static setupGlobalErrorHandler() {
    window.addEventListener("error", (event) => {
      // Di sini kita tidak bisa menggunakan Logger karena bisa terjadi circular dependency
      // Cukup log ke console
      console.error("[GLOBAL JS ERROR]", {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        error: event.error,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("[UNHANDLED PROMISE REJECTION]", {
        reason: event.reason,
      });
      event.preventDefault();
    });
  }

  static getApiUrl(path) {
    // Memisahkan path utama dari parameter query
    const [mainPath, ...queryParams] = path.split("&");
    let url = `${this.API_ENDPOINTS.SCRIPT_URL}?path=${encodeURIComponent(
      mainPath
    )}`;

    if (queryParams.length > 0) {
      url += `&${queryParams.join("&")}`;
    }
    return url;
  }
}

// Panggil metode init statis secara langsung
AppConfig.init();
