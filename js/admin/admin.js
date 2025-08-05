// admin.js - Enhanced Admin Panel with Complete Security & Functionality

// =================================================================
// ENHANCED SECURITY & VALIDATION UTILITIES
// =================================================================

class SecurityValidator {
  static validateInput(value, type = "string", options = {}) {
    const {
      min = 0,
      max = Infinity,
      required = false,
      pattern = null,
    } = options;

    if (required && (value === undefined || value === null || value === "")) {
      return { valid: false, error: "Field is required" };
    }

    if (!required && (value === undefined || value === null || value === "")) {
      return { valid: true };
    }

    switch (type) {
      case "string":
        if (typeof value !== "string")
          return { valid: false, error: "Must be a string" };
        if (value.length < min)
          return { valid: false, error: `Minimum length is ${min}` };
        if (value.length > max)
          return { valid: false, error: `Maximum length is ${max}` };
        if (pattern && !pattern.test(value))
          return { valid: false, error: "Invalid format" };
        break;

      case "number":
        const num = Number(value);
        if (isNaN(num)) return { valid: false, error: "Must be a number" };
        if (num < min)
          return { valid: false, error: `Minimum value is ${min}` };
        if (num > max)
          return { valid: false, error: `Maximum value is ${max}` };
        break;

      case "integer":
        const int = Number(value);
        if (isNaN(int) || !Number.isInteger(int))
          return { valid: false, error: "Must be an integer" };
        if (int < min)
          return { valid: false, error: `Minimum value is ${min}` };
        if (int > max)
          return { valid: false, error: `Maximum value is ${max}` };
        break;

      case "email":
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value))
          return { valid: false, error: "Invalid email format" };
        break;

      case "date":
        const date = new Date(value);
        if (isNaN(date.getTime()))
          return { valid: false, error: "Invalid date" };
        break;
    }

    return { valid: true };
  }

  static sanitizeInput(input) {
    if (typeof input !== "string") return input;
    return input.replace(/[<>\"'&]/g, (match) => {
      const entities = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "&": "&amp;",
      };
      return entities[match];
    });
  }

  static validateBarangMasukData(data) {
    const errors = [];
    const vendorValidation = SecurityValidator.validateInput(
      data.nama_vendor,
      "string",
      { required: true, min: 2, max: 100 }
    );
    if (!vendorValidation.valid)
      errors.push(`Vendor: ${vendorValidation.error}`);
    const notaValidation = SecurityValidator.validateInput(
      data.no_nota_vendor,
      "string",
      { required: true, min: 3, max: 50 }
    );
    if (!notaValidation.valid) errors.push(`No Nota: ${notaValidation.error}`);
    const itemValidation = SecurityValidator.validateInput(
      data.nama_barang,
      "string",
      { required: true, min: 2, max: 100 }
    );
    if (!itemValidation.valid)
      errors.push(`Nama Barang: ${itemValidation.error}`);
    const qtyValidation = SecurityValidator.validateInput(data.qty, "number", {
      required: true,
      min: 0.01,
      max: 999999,
    });
    if (!qtyValidation.valid) errors.push(`Quantity: ${qtyValidation.error}`);
    const hargaValidation = SecurityValidator.validateInput(
      data.harga,
      "number",
      { required: true, min: 1, max: 999999999 }
    );
    if (!hargaValidation.valid) errors.push(`Harga: ${hargaValidation.error}`);
    return { valid: errors.length === 0, errors };
  }
}

// =================================================================
// ENHANCED ADMIN STATE MANAGEMENT
// =================================================================

class AdminState {
  constructor() {
    this.data = {
      piutang: [],
      hutang: [],
      inventaris: [],
      vendors: [],
      barangMasukList: [],
      dashboard: {
        summary: {},
        recentActivities: [],
        alerts: [],
      },
    };
    this.user = null;
    this.listeners = new Set();
    this.isLoading = false;
    this.lastSync = null;
    this.analytics = new AdminAnalytics();
    this.currentNotaSession = null;
  }

  setData(key, value) {
    if (this.data.hasOwnProperty(key)) {
      this.data[key] = Array.isArray(value) ? [...value] : value;
      this.lastSync = Date.now();
      this.analytics.updateDataMetrics(key, value);
      this.notifyListeners("data-updated", { key, value });
    }
  }

  getData(key) {
    return this.data[key];
  }

  startNotaSession(vendor, noNota, tanggalNota, tanggalJatuhTempo) {
    if (this.data.barangMasukList.length > 0) {
      throw new Error(
        "Selesaikan nota sebelumnya terlebih dahulu atau reset form"
      );
    }
    const validation = SecurityValidator.validateInput(vendor, "string", {
      required: true,
      min: 2,
    });
    if (!validation.valid) {
      throw new Error(`Vendor tidak valid: ${validation.error}`);
    }
    const notaValidation = SecurityValidator.validateInput(noNota, "string", {
      required: true,
      min: 3,
    });
    if (!notaValidation.valid) {
      throw new Error(`No Nota tidak valid: ${notaValidation.error}`);
    }
    this.currentNotaSession = {
      vendor: SecurityValidator.sanitizeInput(vendor),
      noNota: SecurityValidator.sanitizeInput(noNota),
      tanggalNota,
      tanggalJatuhTempo,
      startTime: Date.now(),
    };
    this.analytics.recordActivity(
      "nota_session_started",
      this.currentNotaSession
    );
    this.notifyListeners("nota-session-started", this.currentNotaSession);
  }

  endNotaSession() {
    if (this.currentNotaSession) {
      this.analytics.recordActivity("nota_session_ended", {
        ...this.currentNotaSession,
        duration: Date.now() - this.currentNotaSession.startTime,
        itemCount: this.data.barangMasukList.length,
      });
    }
    this.currentNotaSession = null;
    this.notifyListeners("nota-session-ended");
  }

  getCurrentNotaSession() {
    return this.currentNotaSession;
  }

  addBarangMasuk(item) {
    if (!this.currentNotaSession) {
      throw new Error("Silakan isi informasi vendor dan nota terlebih dahulu");
    }
    const enhancedItem = {
      ...item,
      nama_vendor: this.currentNotaSession.vendor,
      no_nota_vendor: this.currentNotaSession.noNota,
    };
    const validation = SecurityValidator.validateBarangMasukData(enhancedItem);
    if (!validation.valid) {
      throw new Error("Data tidak valid: " + validation.errors.join(", "));
    }
    const existingItem = this.data.barangMasukList.find(
      (existing) => existing.id_barang === item.id_barang
    );
    if (existingItem) {
      const confirmMerge = confirm(
        `Barang "${item.nama_barang}" sudah ada dalam daftar. Gabungkan quantity?`
      );
      if (confirmMerge) {
        return this.updateBarangMasukQuantity(
          existingItem.id,
          item.qty,
          item.harga
        );
      } else {
        return false;
      }
    }
    const finalItem = {
      ...enhancedItem,
      id: `BM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      total: Number(item.qty) * Number(item.harga),
    };
    this.data.barangMasukList.push(finalItem);
    this.notifyListeners("barang-masuk-added", { item: finalItem });
    this.analytics.recordActivity("barang_masuk_added", finalItem);
    return true;
  }

  updateBarangMasukQuantity(itemId, additionalQty, newHarga) {
    const index = this.data.barangMasukList.findIndex(
      (item) => item.id === itemId
    );
    if (index === -1) return false;
    const item = this.data.barangMasukList[index];
    const totalQty = Number(item.qty) + Number(additionalQty);
    const finalHarga = newHarga || item.harga;
    const updates = {
      qty: totalQty,
      harga: finalHarga,
      total: totalQty * finalHarga,
      lastModified: new Date().toISOString(),
    };
    return this.updateBarangMasuk(index, updates);
  }

  removeBarangMasuk(index) {
    if (index >= 0 && index < this.data.barangMasukList.length) {
      const removed = this.data.barangMasukList.splice(index, 1)[0];
      this.notifyListeners("barang-masuk-removed", { index, item: removed });
      this.analytics.recordActivity("barang_masuk_removed", removed);
      return true;
    }
    return false;
  }

  updateBarangMasuk(index, updates) {
    if (index >= 0 && index < this.data.barangMasukList.length) {
      const item = this.data.barangMasukList[index];
      if (updates.qty !== undefined) {
        const qtyValidation = SecurityValidator.validateInput(
          updates.qty,
          "number",
          { min: 0.01 }
        );
        if (!qtyValidation.valid) {
          throw new Error(`Quantity tidak valid: ${qtyValidation.error}`);
        }
      }
      if (updates.harga !== undefined) {
        const hargaValidation = SecurityValidator.validateInput(
          updates.harga,
          "number",
          { min: 1 }
        );
        if (!hargaValidation.valid) {
          throw new Error(`Harga tidak valid: ${hargaValidation.error}`);
        }
      }
      Object.assign(item, updates, {
        total: (updates.qty || item.qty) * (updates.harga || item.harga),
        lastModified: new Date().toISOString(),
      });
      this.notifyListeners("barang-masuk-updated", { index, item });
      this.analytics.recordActivity("barang_masuk_updated", { index, updates });
      return true;
    }
    return false;
  }

  clearBarangMasuk() {
    const count = this.data.barangMasukList.length;
    this.data.barangMasukList = [];
    this.endNotaSession();
    this.notifyListeners("barang-masuk-cleared");
    this.analytics.recordActivity("barang_masuk_cleared", { count });
  }

  updateItemStatus(type, id, status) {
    const allowedStatuses = ["lunas", "belum lunas", "dibatalkan"];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      throw new Error("Status tidak valid");
    }
    const dataKey = type === "piutang" ? "piutang" : "hutang";
    const items = this.getData(dataKey);
    const index = items.findIndex((item) => {
      return type === "piutang"
        ? item.id_invoice === id
        : item.no_nota_vendor === id;
    });
    if (index !== -1) {
      items[index].status = status;
      items[index].lastUpdated = new Date().toISOString();
      this.setData(dataKey, items);
      this.analytics.recordActivity("status_updated", { type, id, status });
      return true;
    }
    return false;
  }

  updateBuktiTransfer(type, id, buktiUrl) {
    const dataKey = type === "piutang" ? "piutang" : "hutang";
    const items = this.getData(dataKey);
    const index = items.findIndex((item) => {
      return type === "piutang"
        ? item.id_invoice === id
        : item.no_nota_vendor === id;
    });
    if (index !== -1) {
      items[index].bukti_transfer = buktiUrl;
      items[index].lastUpdated = new Date().toISOString();
      this.setData(dataKey, items);
      this.analytics.recordActivity("file_uploaded", { type, id });
      return true;
    }
    return false;
  }

  updateStokProduk(productId, newStok) {
    const validation = SecurityValidator.validateInput(newStok, "integer", {
      min: 0,
    });
    if (!validation.valid) {
      throw new Error(`Stok tidak valid: ${validation.error}`);
    }
    const inventaris = this.getData("inventaris");
    const index = inventaris.findIndex((item) => item.id === productId);
    if (index !== -1) {
      const oldStok = inventaris[index].stok_awal;
      inventaris[index].stok_awal = Number(newStok);
      inventaris[index].stok_akhir = Number(newStok);
      inventaris[index].lastUpdated = new Date().toISOString();
      this.setData("inventaris", inventaris);
      this.analytics.recordActivity("stok_updated", {
        productId,
        oldStok,
        newStok,
      });
      return true;
    }
    return false;
  }

  searchData(query, dataType, filters = {}) {
    const data = this.getData(dataType);
    if (!data || !query) return data;
    const lowercaseQuery = SecurityValidator.sanitizeInput(query.toLowerCase());
    let filteredData = data.filter((item) => {
      return Object.values(item).some((value) =>
        String(value).toLowerCase().includes(lowercaseQuery)
      );
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") {
        filteredData = filteredData.filter((item) => {
          if (key === "status") {
            return (
              (item.status || "belum lunas").toLowerCase() ===
              value.toLowerCase()
            );
          }
          return String(item[key]).toLowerCase().includes(value.toLowerCase());
        });
      }
    });
    return filteredData;
  }

  getSummaryData() {
    const inventaris = this.getData("inventaris");
    const piutang = this.getData("piutang");
    const hutang = this.getData("hutang");
    const summary = {
      totalProduk: inventaris.length,
      produkHabis: inventaris.filter((p) => Number(p.stok_akhir) <= 0).length,
      produkStokRendah: inventaris.filter((p) => {
        const stok = Number(p.stok_akhir);
        return stok > 0 && stok <= 5;
      }).length,
      totalPiutang: piutang
        .filter((p) => (p.status || "belum lunas").toLowerCase() !== "lunas")
        .reduce((sum, p) => sum + (Number(p.total_tagihan) || 0), 0),
      totalHutang: hutang
        .filter((h) => (h.status || "belum lunas").toLowerCase() !== "lunas")
        .reduce((sum, h) => sum + (Number(h.total_tagihan) || 0), 0),
      piutangOverdue: this.getOverdueItems(piutang),
      hutangOverdue: this.getOverdueItems(hutang),
      totalTransaksi: piutang.length,
      rata2Transaksi:
        piutang.length > 0
          ? piutang.reduce(
              (sum, p) => sum + (Number(p.total_tagihan) || 0),
              0
            ) / piutang.length
          : 0,
    };
    summary.trends = this.calculateTrends();
    return summary;
  }

  getOverdueItems(items) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return items.filter((item) => {
      const itemDate = new Date(item.timestamp);
      const isNotLunas =
        (item.status || "belum lunas").toLowerCase() !== "lunas";
      return isNotLunas && itemDate < thirtyDaysAgo;
    });
  }

  calculateTrends() {
    const piutang = this.getData("piutang");
    const hutang = this.getData("hutang");
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const thisMonthPiutang = piutang.filter(
      (p) => new Date(p.timestamp) >= thisMonth
    );
    const lastMonthPiutang = piutang.filter((p) => {
      const date = new Date(p.timestamp);
      return date >= lastMonth && date < thisMonth;
    });
    const thisMonthHutang = hutang.filter(
      (h) => new Date(h.timestamp) >= thisMonth
    );
    const lastMonthHutang = hutang.filter((h) => {
      const date = new Date(h.timestamp);
      return date >= lastMonth && date < thisMonth;
    });
    return {
      piutangGrowth: this.calculateGrowthRate(
        lastMonthPiutang.length,
        thisMonthPiutang.length
      ),
      hutangGrowth: this.calculateGrowthRate(
        lastMonthHutang.length,
        thisMonthHutang.length
      ),
      transaksiGrowth: this.calculateGrowthRate(
        lastMonthPiutang.length,
        thisMonthPiutang.length
      ),
    };
  }

  calculateGrowthRate(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  getDashboardDetails() {
    const inventaris = this.getData("inventaris");
    const piutang = this.getData("piutang");
    const hutang = this.getData("hutang");
    const produkHabis = inventaris
      .filter((p) => Number(p.stok_akhir) <= 0)
      .slice(0, 10);
    const produkStokRendah = inventaris
      .filter((p) => {
        const stok = Number(p.stok_akhir);
        return stok > 0 && stok <= 5;
      })
      .slice(0, 10);
    const hutangJatuhTempo = hutang
      .filter((h) => (h.status || "belum lunas").toLowerCase() !== "lunas")
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(0, 10);
    const piutangJatuhTempo = piutang
      .filter((p) => (p.status || "belum lunas").toLowerCase() !== "lunas")
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(0, 10);
    const recentActivities = this.analytics.getRecentActivities(20);
    const alerts = this.generateAlerts();
    return {
      produkHabis,
      produkStokRendah,
      hutangJatuhTempo,
      piutangJatuhTempo,
      recentActivities,
      alerts,
    };
  }

  generateAlerts() {
    const alerts = [];
    const summary = this.getSummaryData();
    if (summary.produkHabis > 0) {
      alerts.push({
        type: "danger",
        title: "Stok Habis",
        message: `${summary.produkHabis} produk kehabisan stok`,
        action: "Lihat Produk",
        target: "#master-produk",
        priority: "high",
      });
    }
    if (summary.produkStokRendah > 0) {
      alerts.push({
        type: "warning",
        title: "Stok Rendah",
        message: `${summary.produkStokRendah} produk stok hampir habis`,
        action: "Periksa Stok",
        target: "#master-produk",
        priority: "medium",
      });
    }
    if (summary.piutangOverdue.length > 0) {
      alerts.push({
        type: "info",
        title: "Piutang Jatuh Tempo",
        message: `${summary.piutangOverdue.length} piutang perlu ditagih`,
        action: "Lihat Piutang",
        target: "#piutang-outlet",
        priority: "medium",
      });
    }
    if (summary.hutangOverdue.length > 0) {
      alerts.push({
        type: "warning",
        title: "Hutang Jatuh Tempo",
        message: `${summary.hutangOverdue.length} hutang perlu dibayar`,
        action: "Lihat Hutang",
        target: "#hutang-vendor",
        priority: "high",
      });
    }
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return alerts
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
      .slice(0, 5);
  }

  getAnalytics() {
    return this.analytics.getReport();
  }

  setUser(user) {
    this.user = user;
    this.analytics.setUser(user);
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.notifyListeners("loading-changed", { loading });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(event, data = null) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (error) {
        Logger.error("Admin state listener error", {
          event,
          error: error.message,
        });
      }
    });
  }
}

// =================================================================
// ENHANCED ANALYTICS WITH BETTER INSIGHTS
// =================================================================

class AdminAnalytics {
  constructor() {
    this.activities = [];
    this.dataMetrics = new Map();
    this.user = null;
    this.sessionStart = Date.now();
    this.performanceMetrics = new Map();
  }

  setUser(user) {
    this.user = user;
    this.recordActivity("session_started", {
      user: user.email,
      role: user.role,
    });
  }

  recordActivity(type, data = {}) {
    const activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: JSON.stringify(data),
      timestamp: new Date().toISOString(),
      user: this.user?.email || "unknown",
    };
    this.activities.unshift(activity);
    if (this.activities.length > 200) {
      this.activities = this.activities.slice(0, 200);
    }
    Logger.info("Admin activity recorded", activity);
  }

  recordPerformance(operation, duration, success = true) {
    const metric = {
      operation,
      duration,
      success,
      timestamp: Date.now(),
    };
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    const metrics = this.performanceMetrics.get(operation);
    metrics.push(metric);
    if (metrics.length > 50) {
      metrics.splice(0, metrics.length - 50);
    }
  }

  updateDataMetrics(dataType, data) {
    const metrics = {
      count: Array.isArray(data) ? data.length : 1,
      lastUpdate: Date.now(),
      size: JSON.stringify(data).length,
    };
    this.dataMetrics.set(dataType, metrics);
  }

  getRecentActivities(limit = 10) {
    return this.activities.slice(0, limit).map((activity) => ({
      ...activity,
      timeAgo: this.getTimeAgo(new Date(activity.timestamp)),
      icon: this.getActivityIcon(activity.type),
      color: this.getActivityColor(activity.type),
    }));
  }

  getActivityIcon(type) {
    const icons = {
      session_started: "bi-person-check",
      login: "bi-person-check",
      logout: "bi-person-x",
      nota_session_started: "bi-receipt",
      nota_session_ended: "bi-receipt-cutoff",
      barang_masuk_added: "bi-box-arrow-in-down",
      barang_masuk_removed: "bi-trash",
      barang_masuk_updated: "bi-pencil",
      barang_masuk_cleared: "bi-x-circle",
      status_updated: "bi-check-circle",
      stok_updated: "bi-boxes",
      file_uploaded: "bi-upload",
      data_exported: "bi-download",
      search_performed: "bi-search",
      error: "bi-exclamation-triangle",
    };
    return icons[type] || "bi-info-circle";
  }

  getActivityColor(type) {
    const colors = {
      session_started: "success",
      login: "success",
      logout: "secondary",
      nota_session_started: "info",
      nota_session_ended: "info",
      barang_masuk_added: "primary",
      barang_masuk_removed: "warning",
      barang_masuk_updated: "info",
      barang_masuk_cleared: "danger",
      status_updated: "success",
      stok_updated: "primary",
      file_uploaded: "success",
      data_exported: "info",
      search_performed: "secondary",
      error: "danger",
    };
    return colors[type] || "secondary";
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString("id-ID");
  }

  getPerformanceInsights() {
    const insights = {};
    this.performanceMetrics.forEach((metrics, operation) => {
      const durations = metrics.map((m) => m.duration);
      const successRate =
        metrics.filter((m) => m.success).length / metrics.length;
      insights[operation] = {
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        successRate: successRate * 100,
        totalCalls: metrics.length,
      };
    });
    return insights;
  }

  getReport() {
    const sessionDuration = Date.now() - this.sessionStart;
    return {
      totalActivities: this.activities.length,
      sessionDuration: Math.floor(sessionDuration / 1000 / 60),
      dataMetrics: Object.fromEntries(this.dataMetrics),
      topActivities: this.getTopActivities(),
      recentActivities: this.getRecentActivities(5),
      performanceInsights: this.getPerformanceInsights(),
      userInfo: {
        email: this.user?.email,
        role: this.user?.role,
        sessionStart: new Date(this.sessionStart).toISOString(),
      },
    };
  }

  getTopActivities() {
    const activityCounts = {};
    this.activities.forEach((activity) => {
      activityCounts[activity.type] = (activityCounts[activity.type] || 0) + 1;
    });
    return Object.entries(activityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
  }
}

// =================================================================
// REFACTORED ADMIN RENDERER
// =================================================================

class AdminRenderer {
  constructor(state) {
    this.state = state;
    this.charts = new Map();
    this.animationController = new AdminAnimationController();
    this.searchFilters = new Map();
  }

  renderSummaryCards(data) {
    const container = document.getElementById("summary-cards");
    if (!container) return;

    const cards = [
      {
        title: "Total Produk",
        value: data.totalProduk,
        icon: "bi-boxes",
        color: "primary",
        trend: null,
      },
      {
        title: "Produk Habis",
        value: data.produkHabis,
        icon: "bi-exclamation-triangle",
        color: data.produkHabis > 0 ? "danger" : "success",
        trend: null,
        alert: data.produkHabis > 0,
      },
      {
        title: "Stok Rendah",
        value: data.produkStokRendah,
        icon: "bi-exclamation-circle",
        color: data.produkStokRendah > 0 ? "warning" : "success",
        trend: null,
        alert: data.produkStokRendah > 0,
      },
      {
        title: "Piutang Outlet",
        value: CurrencyFormatter.format(data.totalPiutang),
        icon: "bi-cash-coin",
        color: "warning",
        trend: data.trends?.piutangGrowth,
      },
      {
        title: "Hutang Vendor",
        value: CurrencyFormatter.format(data.totalHutang),
        icon: "bi-credit-card",
        color: "info",
        trend: data.trends?.hutangGrowth,
      },
      {
        title: "Total Transaksi",
        value: data.totalTransaksi,
        icon: "bi-graph-up",
        color: "success",
        trend: data.trends?.transaksiGrowth,
      },
    ];

    container.innerHTML = cards
      .map(
        (card, index) => `
      <div class="col-lg-2 col-md-4 col-sm-6 mb-4">
        <div class="card glass-card h-100 summary-card ${
          card.alert ? "border-" + card.color : ""
        }" style="animation-delay: ${index * 0.1}s">
          <div class="card-body text-center">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <i class="bi ${card.icon} fs-2 text-${card.color} ${
          card.alert ? "pulse-animation" : ""
        }"></i>
              ${
                card.trend !== null && card.trend !== undefined
                  ? `
                <div class="trend-indicator ${
                  card.trend >= 0 ? "positive" : "negative"
                }">
                  <i class="bi bi-arrow-${card.trend >= 0 ? "up" : "down"}"></i>
                  <small>${Math.abs(card.trend).toFixed(1)}%</small>
                </div>
              `
                  : ""
              }
            </div>
            <h6 class="card-subtitle mb-2 text-muted small">${card.title}</h6>
            <h4 class="card-title fw-bold text-${card.color} mb-0">${
          card.value
        }</h4>
            ${
              card.alert
                ? `<small class="text-${card.color}"><i class="bi bi-exclamation-circle"></i> Perlu Perhatian</small>`
                : ""
            }
          </div>
        </div>
      </div>
    `
      )
      .join("");

    this.animationController.animateCards(
      container.querySelectorAll(".summary-card")
    );
  }

  renderGenericTable(config) {
    const {
      dataType,
      searchTerm = "",
      statusFilter = "all",
      tbodyId,
      columns,
      rowGenerator,
      emptyMessage = "Tidak ada data",
    } = config;

    const data = this.state.searchData(searchTerm, dataType, {
      status: statusFilter,
    });
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${columns}" class="text-center text-muted py-4">
            <i class="bi bi-search me-2"></i>
            ${
              searchTerm
                ? `Tidak ada hasil untuk "${searchTerm}"`
                : emptyMessage
            }
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map(rowGenerator).join("");
    this.animateTableRows(tbody);
  }

  renderPiutangTable(searchTerm = "", statusFilter = "all") {
    const dataType = "piutang";
    const tbodyId = "piutang-table-body";
    const columns = 7;
    const emptyMessage = "Tidak ada data piutang";

    const data = this.state.searchData(searchTerm, dataType, {
      status: statusFilter,
    });
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${columns}" class="text-center text-muted py-4"><i class="bi bi-search me-2"></i>${
        searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : emptyMessage
      }</td></tr>`;
      return;
    }

    // --- LOGIKA BARU UNTUK PENGELOMPOKAN ---
    const groupedByOutlet = data.reduce((acc, item) => {
      const outlet = item.nama_outlet || "Lain-lain";
      if (!acc[outlet]) {
        acc[outlet] = { items: [], total: 0 };
      }
      acc[outlet].items.push(item);
      acc[outlet].total += Number(item.total_tagihan) || 0;
      return acc;
    }, {});

    let html = "";
    for (const outletName in groupedByOutlet) {
      const group = groupedByOutlet[outletName];
      // Tambahkan baris header untuk setiap grup
      html += `
      <tr class="table-group-header">
        <td colspan="${columns}" class="bg-light fw-bold">
          <i class="bi bi-shop me-2"></i>${outletName}
          <span class="badge bg-primary float-end">${CurrencyFormatter.format(
            group.total
          )}</span>
        </td>
      </tr>
    `;

      // Tambahkan baris data untuk setiap item di grup
      group.items.forEach((p) => {
        const isOverdue = this.isOverdue(p.timestamp);
        const statusClass = this.getStatusBadgeClass(p.status);
        html += `
        <tr class="table-row ${isOverdue ? "table-warning" : ""}">
          <td><span class="fw-semibold">${p.id_invoice}</span></td>
          <td>${this.formatDate(p.timestamp)}</td>
          <td>${p.nama_outlet}</td>
          <td class="text-end fw-bold">${CurrencyFormatter.format(
            p.total_tagihan
          )}</td>
          <td><span class="badge ${statusClass} rounded-pill">${
          p.status || "Belum Lunas"
        }</span></td>
          <td>${this.renderBuktiTransfer(
            p.bukti_transfer,
            p.id_invoice,
            "piutang"
          )}</td>
          <td>
            <div class="form-check form-switch">
              <input class="form-check-input status-toggle" type="checkbox" ${
                this.isLunas(p.status) ? "checked" : ""
              } data-type="piutang" data-id="${p.id_invoice}">
            </div>
          </td>
        </tr>
      `;
      });
    }

    tbody.innerHTML = html;
    this.animateTableRows(tbody);
  }

  renderHutangTable(searchTerm = "", statusFilter = "all") {
    this.renderGenericTable({
      dataType: "hutang",
      searchTerm,
      statusFilter,
      tbodyId: "hutang-table-body",
      columns: 7,
      emptyMessage: "Tidak ada data hutang",
      rowGenerator: (h) => {
        const isOverdue = this.isOverdue(h.timestamp);
        const statusClass = this.getStatusBadgeClass(h.status);

        return `
          <tr class="table-row ${isOverdue ? "table-danger" : ""}">
            <td>
              <div class="d-flex align-items-center">
                <i class="bi bi-receipt me-2 text-info"></i>
                <div>
                  <span class="fw-semibold">${h.no_nota_vendor}</span>
                  ${
                    isOverdue
                      ? '<br><small class="text-danger"><i class="bi bi-clock"></i> Overdue</small>'
                      : ""
                  }
                </div>
              </div>
            </td>
            <td>${this.formatDate(h.timestamp)}</td>
            <td>
              <div class="d-flex align-items-center">
                <i class="bi bi-truck me-2 text-secondary"></i>
                ${h.nama_vendor}
              </div>
            </td>
            <td class="text-end fw-bold">${CurrencyFormatter.format(
              h.total_tagihan
            )}</td>
            <td>
              <span class="badge ${statusClass} rounded-pill">
                <i class="bi ${
                  this.isLunas(h.status) ? "bi-check-circle" : "bi-clock"
                } me-1"></i>
                ${h.status || "Belum Lunas"}
              </span>
            </td>
            <td>${this.renderBuktiTransfer(
              h.bukti_transfer,
              h.no_nota_vendor,
              "hutang"
            )}</td>
            <td>
              <div class="form-check form-switch">
                <input class="form-check-input status-toggle" type="checkbox" ${
                  this.isLunas(h.status) ? "checked" : ""
                } data-type="hutang" data-id="${h.no_nota_vendor}">
                <label class="form-check-label small text-muted">Lunas</label>
              </div>
            </td>
          </tr>
        `;
      },
    });
  }

  renderInventarisTable(searchTerm = "") {
    this.renderGenericTable({
      dataType: "inventaris",
      searchTerm,
      tbodyId: "inventaris-table-body",
      columns: 6,
      emptyMessage: "Tidak ada data inventaris",
      rowGenerator: (item) => {
        const stokStatus = this.getStokStatus(item.stok_akhir);

        return `
          <tr class="table-row">
            <td>
              <div class="d-flex align-items-center">
                <i class="bi bi-box me-2 text-primary"></i>
                <span class="fw-semibold">${item.id}</span>
              </div>
            </td>
            <td>
              <div>
                ${item.nama}
                ${
                  stokStatus.alert
                    ? `<br><small class="text-${stokStatus.color}"><i class="bi ${stokStatus.icon}"></i> ${stokStatus.message}</small>`
                    : ""
                }
              </div>
            </td>
            <td>
              <span class="badge bg-light text-dark border">${item.unit}</span>
            </td>
            <td>
              <input type="number" 
                     class="form-control form-control-sm stok-input" 
                     value="${item.stok_awal}" 
                     min="0" 
                     style="width: 100px"
                     data-product-id="${item.id}"
                     data-original-value="${item.stok_awal}">
            </td>
            <td>
              <span class="fw-bold text-${stokStatus.color}">
                ${item.stok_akhir}
                ${
                  stokStatus.alert
                    ? ` <i class="bi ${stokStatus.icon}"></i>`
                    : ""
                }
              </span>
            </td>
            <td>
              <button class="btn btn-sm btn-primary save-stok-btn" 
                      data-product-id="${item.id}" 
                      disabled>
                <i class="bi bi-check me-1"></i>Simpan
              </button>
            </td>
          </tr>
        `;
      },
    });
  }

  getSpecificErrorMessage(error, context = "general") {
    if (error.code) {
      return this.getErrorMessageByCode(error.code, error.message);
    }
    const message = error.message || error.toString();
    if (
      message.includes("stok tidak mencukupi") ||
      message.includes("INSUFFICIENT_STOCK")
    ) {
      return {
        type: "warning",
        title: "Stok Tidak Mencukupi",
        message: message,
        actionable: true,
        suggestion: "Periksa stok produk atau kurangi jumlah pesanan.",
      };
    }
    if (
      message.includes("tidak valid") ||
      message.includes("VALIDATION_ERROR")
    ) {
      return {
        type: "error",
        title: "Data Tidak Valid",
        message: message,
        actionable: true,
        suggestion:
          "Periksa kembali data yang diisi dan pastikan sesuai format.",
      };
    }
    if (
      message.includes("tidak diizinkan") ||
      message.includes("UNAUTHORIZED")
    ) {
      return {
        type: "error",
        title: "Akses Ditolak",
        message: "Anda tidak memiliki izin untuk melakukan operasi ini.",
        actionable: false,
        suggestion:
          "Hubungi administrator untuk mendapatkan akses yang diperlukan.",
      };
    }
    if (message.includes("sudah ada") || message.includes("duplikat")) {
      return {
        type: "warning",
        title: "Data Sudah Ada",
        message: message,
        actionable: true,
        suggestion: "Gunakan nomor atau ID yang berbeda.",
      };
    }
    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("timeout")
    ) {
      return {
        type: "error",
        title: "Masalah Koneksi",
        message: "Terjadi masalah koneksi. Silakan coba lagi.",
        actionable: true,
        suggestion:
          "Periksa koneksi internet Anda dan coba lagi dalam beberapa saat.",
      };
    }
    return {
      type: "error",
      title: "Terjadi Kesalahan",
      message: message || "Terjadi kesalahan yang tidak diketahui.",
      actionable: false,
      suggestion: "Jika masalah berlanjut, hubungi tim support.",
    };
  }

  getErrorMessageByCode(code, originalMessage) {
    const errorMap = {
      INSUFFICIENT_STOCK: {
        type: "warning",
        title: "Stok Tidak Mencukupi",
        message: originalMessage,
        actionable: true,
        suggestion: "Periksa ketersediaan stok atau kurangi jumlah pesanan.",
      },
      PRODUCT_NOT_FOUND: {
        type: "error",
        title: "Produk Tidak Ditemukan",
        message: originalMessage,
        actionable: true,
        suggestion: "Periksa kembali ID produk yang dimasukkan.",
      },
      VALIDATION_ERROR: {
        type: "error",
        title: "Data Tidak Valid",
        message: originalMessage,
        actionable: true,
        suggestion: "Periksa format dan kelengkapan data yang diisi.",
      },
      UNAUTHORIZED: {
        type: "error",
        title: "Akses Ditolak",
        message: "Anda tidak memiliki izin untuk operasi ini.",
        actionable: false,
        suggestion: "Hubungi administrator untuk mendapatkan akses.",
      },
      RATE_LIMIT_EXCEEDED: {
        type: "warning",
        title: "Terlalu Banyak Permintaan",
        message: "Anda telah mencapai batas maksimal permintaan.",
        actionable: true,
        suggestion: "Tunggu beberapa menit sebelum mencoba lagi.",
      },
      FILE_TOO_LARGE: {
        type: "error",
        title: "File Terlalu Besar",
        message: originalMessage,
        actionable: true,
        suggestion: "Gunakan file dengan ukuran lebih kecil (maksimal 2MB).",
      },
      INVALID_FILE_TYPE: {
        type: "error",
        title: "Tipe File Tidak Valid",
        message: originalMessage,
        actionable: true,
        suggestion: "Gunakan file format JPG atau PNG.",
      },
      SYSTEM_BUSY: {
        type: "info",
        title: "Sistem Sedang Sibuk",
        message: originalMessage,
        actionable: true,
        suggestion: "Coba lagi dalam beberapa saat.",
      },
    };
    return (
      errorMap[code] || {
        type: "error",
        title: "Kesalahan Sistem",
        message: originalMessage || "Terjadi kesalahan yang tidak diketahui.",
        actionable: false,
        suggestion: "Hubungi tim support jika masalah berlanjut.",
      }
    );
  }

  createEnhancedToast(error, context = "general") {
    const errorInfo = this.getSpecificErrorMessage(error, context);
    let toastContent = `
      <div class="d-flex align-items-start">
        <div class="flex-grow-1">
          <strong>${errorInfo.title}</strong>
          <div class="mt-1">${errorInfo.message}</div>
          ${
            errorInfo.suggestion
              ? `<small class="text-muted mt-1 d-block"><i class="bi bi-lightbulb me-1"></i>${errorInfo.suggestion}</small>`
              : ""
          }
        </div>
      </div>
    `;
    if (errorInfo.actionable && context !== "silent") {
      toastContent += `
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-primary me-2" onclick="location.reload()">
            <i class="bi bi-arrow-clockwise me-1"></i>Coba Lagi
          </button>
          ${
            errorInfo.type === "warning"
              ? `
            <button class="btn btn-sm btn-outline-secondary" onclick="this.closest('.toast').querySelector('.btn-close').click()">
              <i class="bi bi-x me-1"></i>Tutup
            </button>
          `
              : ""
          }
        </div>
      `;
    }
    const duration = errorInfo.type === "error" ? 8000 : 5000;
    UIUtils.createToast(errorInfo.type, toastContent, duration);
  }

  getStokStatus(stok) {
    const stokNum = Number(stok);
    if (stokNum <= 0) {
      return {
        color: "danger",
        icon: "bi-exclamation-triangle",
        message: "Habis",
        alert: true,
      };
    } else if (stokNum <= 5) {
      return {
        color: "warning",
        icon: "bi-exclamation-circle",
        message: "Rendah",
        alert: true,
      };
    }
    return {
      color: "success",
      icon: "bi-check-circle",
      message: "Aman",
      alert: false,
    };
  }

  isOverdue(timestamp) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(timestamp) < thirtyDaysAgo;
  }

  animateTableRows(tbody) {
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, index) => {
      row.style.animationDelay = `${index * 0.05}s`;
      row.classList.add("table-row-enter");
    });
  }

  formatDate(timestamp) {
    try {
      return new Date(timestamp).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "Invalid Date";
    }
  }

  getStatusBadgeClass(status) {
    return this.isLunas(status) ? "bg-success" : "bg-warning";
  }

  isLunas(status) {
    return (status || "").toLowerCase() === "lunas";
  }

  renderBuktiTransfer(buktiTransfer, id, type) {
    if (buktiTransfer) {
      return `
        <a href="${buktiTransfer}" target="_blank" class="btn btn-sm btn-outline-info">
          <i class="bi bi-eye me-1"></i>Lihat
        </a>
      `;
    } else {
      return `
        <button class="btn btn-sm btn-outline-secondary upload-bukti-btn"
                data-id="${id}" 
                data-type="${type}" 
                data-bs-toggle="modal" 
                data-bs-target="#uploadModal">
          <i class="bi bi-upload me-1"></i>Upload
        </button>
      `;
    }
  }

  renderBarangMasukPreview() {
    const barangMasukList = this.state.getData("barangMasukList");
    const tbody = document.getElementById("tabelBarangMasukPreview");
    const currentSession = this.state.getCurrentNotaSession();
    if (!tbody) return;
    const sessionInfo = document.getElementById("nota-session-info");
    if (sessionInfo) {
      if (currentSession) {
        sessionInfo.innerHTML = `
          <div class="alert alert-info">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>Nota Aktif:</strong> ${currentSession.noNota} - ${currentSession.vendor}
              </div>
              <button class="btn btn-sm btn-outline-danger" id="resetNotaSession">
                <i class="bi bi-x-circle me-1"></i>Reset
              </button>
            </div>
          </div>
        `;
      } else {
        sessionInfo.innerHTML = "";
      }
    }
    tbody.innerHTML = "";
    if (barangMasukList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-4 text-muted">
            <i class="bi bi-inbox fs-3 d-block mb-2"></i>
            ${
              currentSession
                ? "Belum ada barang yang ditambahkan untuk nota ini"
                : "Silakan isi informasi vendor dan nota terlebih dahulu"
            }
          </td>
        </tr>
      `;
      const saveButton = document.getElementById("simpanSemuaBtn");
      if (saveButton) saveButton.disabled = true;
      return;
    }
    const fragment = document.createDocumentFragment();
    barangMasukList.forEach((item, idx) => {
      const tr = document.createElement("tr");
      tr.className = "table-row";
      tr.innerHTML = `
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-box me-2 text-primary"></i>
            <div>
              <div class="fw-semibold">${item.nama_barang}</div>
              <small class="text-muted">${item.nama_vendor} - ${
        item.no_nota_vendor
      }</small>
            </div>
          </div>
        </td>
        <td class="text-center">
          <span class="badge bg-primary rounded-pill">${item.qty}</span>
        </td>
        <td class="text-end">${CurrencyFormatter.format(item.harga)}</td>
        <td class="text-end fw-bold text-success">${CurrencyFormatter.format(
          item.total
        )}</td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary edit-barang-btn" data-index="${idx}" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger remove-barang-btn" data-index="${idx}" title="Hapus">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      `;
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
    const total = barangMasukList.reduce((sum, item) => sum + item.total, 0);
    const totalElement = document.getElementById("barang-masuk-total");
    if (totalElement) {
      totalElement.innerHTML = `
        <div class="alert alert-success mb-0">
          <div class="row">
            <div class="col-md-6">
              <strong>Total: ${CurrencyFormatter.format(total)}</strong>
            </div>
            <div class="col-md-6 text-md-end">
              <small>Jumlah item: ${barangMasukList.length}</small>
            </div>
          </div>
        </div>
      `;
    }
    const saveButton = document.getElementById("simpanSemuaBtn");
    if (saveButton) saveButton.disabled = false;
    this.animateTableRows(tbody);
  }

  renderTable(tbodyId, data, rowGenerator, emptyStateHtml = null) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!data || data.length === 0) {
      tbody.innerHTML =
        emptyStateHtml ||
        '<tr><td colspan="10" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Tidak ada data</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(rowGenerator).join("");
    this.animateTableRows(tbody);
  }

  renderDashboardDetails(details) {
    this.renderTable(
      "dashboard-produk-habis-body",
      details.produkHabis,
      (p) =>
        `<tr><td><i class="bi bi-box text-danger me-2"></i>${p.id}</td><td>${p.nama}</td></tr>`,
      '<tr><td colspan="2" class="text-center text-success"><i class="bi bi-check-circle me-2"></i>Semua produk tersedia!</td></tr>'
    );
    this.renderTable(
      "dashboard-produk-stok-rendah-body",
      details.produkStokRendah,
      (p) =>
        `<tr><td><i class="bi bi-exclamation-triangle text-warning me-2"></i>${p.id}</td><td>${p.nama}</td><td><span class="badge bg-warning">${p.stok_akhir}</span></td></tr>`,
      '<tr><td colspan="3" class="text-center text-success"><i class="bi bi-check-circle me-2"></i>Stok aman!</td></tr>'
    );
    this.renderTable(
      "dashboard-hutang-vendor-body",
      details.hutangJatuhTempo,
      (h) => `<tr>
        <td>${this.formatDate(h.timestamp)}</td>
        <td><i class="bi bi-truck me-2"></i>${h.nama_vendor}</td>
        <td class="text-end fw-bold">${CurrencyFormatter.format(
          h.total_tagihan
        )}</td>
      </tr>`,
      '<tr><td colspan="3" class="text-center text-success"><i class="bi bi-check-circle me-2"></i>Tidak ada hutang!</td></tr>'
    );
    this.renderTable(
      "dashboard-piutang-outlet-body",
      details.piutangJatuhTempo,
      (p) => `<tr>
        <td>${this.formatDate(p.timestamp)}</td>
        <td><i class="bi bi-shop me-2"></i>${p.nama_outlet}</td>
        <td class="text-end fw-bold">${CurrencyFormatter.format(
          p.total_tagihan
        )}</td>
      </tr>`,
      '<tr><td colspan="3" class="text-center text-success"><i class="bi bi-check-circle me-2"></i>Tidak ada piutang!</td></tr>'
    );
    this.renderRecentActivities(details.recentActivities);
    this.renderAlerts(details.alerts);
  }

  renderRecentActivities(activities) {
    const container = document.getElementById("recent-activities");
    if (!container || !activities.length) return;
    container.innerHTML = `
      <div class="card glass-card">
        <div class="card-header">
          <h6 class="mb-0"><i class="bi bi-clock-history me-2"></i>Aktivitas Terbaru</h6>
        </div>
        <div class="card-body p-0">
          <div class="list-group list-group-flush">
            ${activities
              .map(
                (activity) => `
              <div class="list-group-item border-0">
                <div class="d-flex align-items-center">
                  <div class="flex-shrink-0">
                    <i class="bi ${activity.icon} text-${
                  activity.color
                } fs-5"></i>
                  </div>
                  <div class="flex-grow-1 ms-3">
                    <div class="fw-semibold">${this.getActivityDescription(
                      activity
                    )}</div>
                    <small class="text-muted">${activity.timeAgo}</small>
                  </div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  renderAlerts(alerts) {
    const container = document.getElementById("dashboard-alerts");
    if (!container || !alerts.length) return;
    container.innerHTML = `
      <div class="card glass-card">
        <div class="card-header">
          <h6 class="mb-0"><i class="bi bi-bell me-2"></i>Peringatan</h6>
        </div>
        <div class="card-body p-0">
          ${alerts
            .map(
              (alert) => `
            <div class="alert alert-${alert.type} border-0 rounded-0 mb-0">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <strong>${alert.title}</strong>
                  <div class="small">${alert.message}</div>
                </div>
                <a href="${alert.target}" class="btn btn-sm btn-outline-${alert.type} alert-action-btn">
                    ${alert.action}
                </a>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  getActivityDescription(activity) {
    const descriptions = {
      session_started: "Memulai sesi admin",
      nota_session_started: `Memulai nota: ${JSON.parse(activity.data).noNota}`,
      nota_session_ended: "Menyelesaikan nota",
      barang_masuk_added: `Menambah barang masuk: ${
        JSON.parse(activity.data).nama_barang || "Item"
      }`,
      barang_masuk_removed: "Menghapus item barang masuk",
      barang_masuk_updated: "Mengubah item barang masuk",
      barang_masuk_cleared: "Menghapus semua barang masuk",
      status_updated: `Update status ${JSON.parse(activity.data).type}: ${
        JSON.parse(activity.data).id
      }`,
      stok_updated: `Update stok: ${JSON.parse(activity.data).productId}`,
      file_uploaded: `Upload bukti: ${JSON.parse(activity.data).type}`,
      search_performed: `Pencarian: ${JSON.parse(activity.data).query}`,
      login: "Admin login",
      logout: "Admin logout",
    };
    try {
      return descriptions[activity.type] || `Aktivitas: ${activity.type}`;
    } catch (e) {
      return `Aktivitas: ${activity.type}`;
    }
  }

  renderVendorOptions(vendors) {
    const vendorSelect = document.getElementById("vendorSelect");
    if (!vendorSelect) return;
    vendorSelect.innerHTML =
      '<option value="" selected disabled>Pilih Vendor...</option>';
    vendors.forEach((vendor) => {
      if (vendor && vendor.nama_vendor) {
        const option = document.createElement("option");
        option.value = vendor.nama_vendor;
        option.textContent = vendor.nama_vendor;
        vendorSelect.appendChild(option);
      }
    });
  }

  renderSearchAndFilter(containerId, dataType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const filterOptions = this.getFilterOptions(dataType);
    container.innerHTML = `
      <div class="card glass-card mb-4">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <div class="input-group">
                <span class="input-group-text"><i class="bi bi-search"></i></span>
                <input type="text" class="form-control" id="${dataType}-search" placeholder="Cari ${dataType}...">
              </div>
            </div>
            <div class="col-md-3">
              <select class="form-select" id="${dataType}-status-filter">
                <option value="all">Semua Status</option>
                ${filterOptions
                  .map(
                    (option) =>
                      `<option value="${option.value}">${option.label}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="col-md-3">
              <button class="btn btn-outline-secondary w-100" id="${dataType}-clear-filter">
                <i class="bi bi-x-circle me-1"></i>Reset Filter
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getFilterOptions(dataType) {
    const commonOptions = [
      { value: "lunas", label: "Lunas" },
      { value: "belum lunas", label: "Belum Lunas" },
      { value: "dibatalkan", label: "Dibatalkan" },
    ];
    switch (dataType) {
      case "piutang":
      case "hutang":
        return commonOptions;
      default:
        return [];
    }
  }
  renderAnalytics() {
    const analyticsContent = document.getElementById("analytics-content");
    if (!analyticsContent) return;

    const report = this.state.getAnalytics();
    if (!report) {
      analyticsContent.innerHTML =
        '<p class="text-muted">Gagal memuat data analytics.</p>';
      return;
    }

    const topActivities = report.topActivities
      .map(
        (act) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${act.type.replace(/_/g, " ")}
            <span class="badge bg-primary rounded-pill">${act.count}</span>
        </li>
    `
      )
      .join("");

    const performanceInsights = Object.entries(report.performanceInsights)
      .map(
        ([op, data]) => `
        <tr>
            <td>${op}</td>
            <td class="text-end">${data.avgDuration.toFixed(2)} ms</td>
            <td class="text-end">${data.totalCalls}</td>
            <td class="text-end">${data.successRate.toFixed(1)}%</td>
        </tr>
    `
      )
      .join("");

    analyticsContent.innerHTML = `
        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card glass-card h-100">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-person-circle me-2"></i>Info Sesi</h6></div>
                    <div class="card-body">
                        <p><strong>User:</strong> ${report.userInfo.email}</p>
                        <p><strong>Role:</strong> ${report.userInfo.role}</p>
                        <p class="mb-0"><strong>Durasi Sesi:</strong> ${
                          report.sessionDuration
                        } menit</p>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card glass-card h-100">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-activity me-2"></i>Aktivitas Teratas</h6></div>
                    <ul class="list-group list-group-flush">
                        ${
                          topActivities ||
                          '<li class="list-group-item">Belum ada aktivitas.</li>'
                        }
                    </ul>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card glass-card h-100">
                    <div class="card-header"><h6 class="mb-0"><i class="bi bi-lightning-charge me-2"></i>Performa API</h6></div>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Operasi</th>
                                    <th class="text-end">Rata2 Waktu</th>
                                    <th class="text-end">Panggilan</th>
                                    <th class="text-end">Sukses</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${
                                  performanceInsights ||
                                  '<tr><td colspan="4" class="text-muted text-center">Belum ada data.</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
  }
}

// =================================================================
// ENHANCED ANIMATION CONTROLLER
// =================================================================

class AdminAnimationController {
  constructor() {
    this.addAnimationStyles();
  }

  animateCards(cards) {
    if (!AppConfig.device.supportsAnimations) return;
    cards.forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      setTimeout(() => {
        card.style.transition =
          "all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, index * 100);
    });
  }

  addAnimationStyles() {
    if (document.getElementById("admin-animations")) return;
    const styles = document.createElement("style");
    styles.id = "admin-animations";
    styles.textContent = `
      .summary-card {
        transform: translateY(20px);
        opacity: 0;
        animation: cardEnter 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
      }
      @keyframes cardEnter {
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      .table-row-enter {
        animation: rowSlideIn 0.4s ease-out forwards;
        opacity: 0;
        transform: translateX(-20px);
      }
      @keyframes rowSlideIn {
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      .table-row:hover {
        background-color: rgba(99, 102, 241, 0.05);
        transform: scale(1.01);
        transition: all 0.2s ease;
      }
      .pulse-animation {
        animation: pulse 2s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
          transform: scale(1.05);
        }
      }
      .trend-indicator {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 1rem;
        font-weight: 600;
        animation: fadeInUp 0.6s ease-out;
      }
      .trend-indicator.positive {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }
      .trend-indicator.negative {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .glass-card {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: all 0.3s ease;
      }
      .glass-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      }
      .status-toggle:checked {
        background-color: var(--bs-success);
        border-color: var(--bs-success);
      }
      .btn-group-sm .btn {
        transition: all 0.2s ease;
      }
      .btn-group-sm .btn:hover {
        transform: scale(1.1);
      }
      .stok-input.changed {
        border-color: #ffc107;
        background-color: #fff3cd;
        transition: all 0.3s ease;
      }
      .save-stok-btn:disabled {
        opacity: 0.5;
      }
      .upload-bukti-btn:hover {
        transform: translateY(-1px);
      }
      .alert {
        animation: slideInDown 0.5s ease-out;
      }
      @keyframes slideInDown {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .form-control:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 0.2rem rgba(99, 102, 241, 0.25);
      }
      .btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        border: none;
        transition: all 0.3s ease;
      }
      .btn-primary:hover {
        background: linear-gradient(135deg, #5856eb 0%, #7c3aed 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
      }
    `;
    document.head.appendChild(styles);
  }
}
// Enhanced Modal Manager
class AdminModalManager {
  constructor(state) {
    this.state = state;
    this.currentEditIndex = null;
    this.initializeModals();
  }

  initializeModals() {
    this.createEditBarangMasukModal();
  }

  createEditBarangMasukModal() {
    const existingModal = document.getElementById("editBarangMasukModal");
    if (existingModal) return;
    const modalHTML = `
      <div class="modal fade" id="editBarangMasukModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-pencil me-2"></i>Edit Barang Masuk
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editBarangMasukForm">
                <div class="mb-3">
                  <label for="editNamaBarang" class="form-label">Nama Barang</label>
                  <input type="text" class="form-control" id="editNamaBarang" readonly>
                </div>
                <div class="row">
                  <div class="col-6">
                    <label for="editQty" class="form-label">Quantity</label>
                    <input type="number" class="form-control" id="editQty" min="1" required>
                  </div>
                  <div class="col-6">
                    <label for="editHarga" class="form-label">Harga per Unit</label>
                    <input type="number" class="form-control" id="editHarga" min="1" required>
                  </div>
                </div>
                <div class="mt-3">
                  <strong>Total: <span id="editTotal">Rp 0</span></strong>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
              <button type="submit" form="editBarangMasukForm" class="btn btn-primary" id="saveEditBtn">
                <i class="bi bi-check me-1"></i>Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    this.setupEditModalListeners();
  }

  setupEditModalListeners() {
    const editForm = document.getElementById("editBarangMasukForm");
    const editQty = document.getElementById("editQty");
    const editHarga = document.getElementById("editHarga");
    const editTotal = document.getElementById("editTotal");
    const updateTotal = () => {
      const qty = Number(editQty.value) || 0;
      const harga = Number(editHarga.value) || 0;
      const total = qty * harga;
      editTotal.textContent = CurrencyFormatter.format(total);
    };
    editQty.addEventListener("input", updateTotal);
    editHarga.addEventListener("input", updateTotal);
    editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveEdit();
    });
  }

  showEditModal(index) {
    const barangMasukList = this.state.getData("barangMasukList");
    const item = barangMasukList[index];
    if (!item) return;
    this.currentEditIndex = index;
    document.getElementById("editNamaBarang").value = item.nama_barang;
    document.getElementById("editQty").value = item.qty;
    document.getElementById("editHarga").value = item.harga;
    const total = item.qty * item.harga;
    document.getElementById("editTotal").textContent =
      CurrencyFormatter.format(total);
    const modal = new bootstrap.Modal(
      document.getElementById("editBarangMasukModal")
    );
    modal.show();
  }

  saveEdit() {
    if (this.currentEditIndex === null) return;
    const qty = Number(document.getElementById("editQty").value);
    const harga = Number(document.getElementById("editHarga").value);
    if (!qty || !harga) {
      UIUtils.createToast(
        "error",
        "Quantity dan harga harus diisi dengan benar"
      );
      return;
    }
    const updates = { qty, harga };
    if (this.state.updateBarangMasuk(this.currentEditIndex, updates)) {
      UIUtils.createToast("success", "Item berhasil diperbarui");
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("editBarangMasukModal")
      );
      modal.hide();
      this.currentEditIndex = null;
    }
  }
}

// Enhanced Upload Manager
class AdminUploadManager {
  constructor(state) {
    this.state = state;
    this.currentUploadData = null;
    this.setupUploadModal();
  }

  setupUploadModal() {
    const uploadForm = document.getElementById("uploadForm");
    if (uploadForm) {
      uploadForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleUpload();
      });
    }
  }

  getSessionToken() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    return user?.sessionToken;
  }

  showUploadModal(id, type) {
    this.currentUploadData = { id, type };
    const modal = document.getElementById("uploadModal");
    const modalTitle = modal.querySelector(".modal-title");
    modalTitle.innerHTML = `<i class="bi bi-cloud-upload me-2"></i>Upload Bukti Pembayaran - ${type.toUpperCase()} ${id}`;
    const uploadModalInstance = bootstrap.Modal.getOrCreateInstance(modal);
    uploadModalInstance.show();
  }

  async handleUpload() {
    if (!this.currentUploadData) return;
    const fileInput = document.getElementById("uploadFile");
    const file = fileInput.files[0];
    if (!file) {
      UIUtils.createToast("error", "Pilih file terlebih dahulu");
      return;
    }
    if (!this.validateFile(file)) return;

    const uploadBtn = document.getElementById("uploadConfirmBtn");
    const progressContainer = document.getElementById("uploadProgress");
    const progressBar = progressContainer.querySelector(".progress-bar");
    UIUtils.setLoadingState(uploadBtn, true, "Mengupload...");
    progressContainer.classList.remove("d-none");

    try {
      this.simulateProgress(progressBar);
      const base64Data = await this.fileToBase64(file);

      const uploadData = {
        path: "upload_bukti",
        type: this.currentUploadData.type,
        id: this.currentUploadData.id,
        filename: file.name,
        fileData: base64Data,
        mimeType: file.type,
        sessionToken: this.getSessionToken(),
      };

      const result = await APIClient.request("upload_bukti", {
        method: "POST",
        body: JSON.stringify(uploadData),
        useCache: false,
      });

      if (result.status === "success") {
        // vvvv PERBAIKAN UTAMA ADA DI SINI vvvv
        // 1. Update URL bukti di state
        this.state.updateBuktiTransfer(
          this.currentUploadData.type,
          this.currentUploadData.id,
          result.fileUrl
        );
        // 2. Update status menjadi "Lunas" di state secara manual
        this.state.updateItemStatus(
          this.currentUploadData.type,
          this.currentUploadData.id,
          "Lunas"
        );
        // ^^^^ AKHIR DARI PERBAIKAN ^^^^

        UIUtils.createToast(
          "success",
          result.message || "File berhasil diupload!"
        );
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("uploadModal")
        );
        modal.hide();
        fileInput.value = "";
        this.currentUploadData = null;
      } else {
        throw new Error(result.message || "Upload gagal");
      }
    } catch (error) {
      Logger.error("Upload failed", error);
      UIUtils.createToast("error", `Upload gagal: ${error.message}`);
    } finally {
      UIUtils.setLoadingState(uploadBtn, false);
      progressContainer.classList.add("d-none");
      progressBar.style.width = "0%";
    }
  }

  validateFile(file) {
    const maxSize = 2 * 1024 * 1024;
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (file.size > maxSize) {
      UIUtils.createToast("error", "Ukuran file maksimal 2MB");
      return false;
    }
    if (!allowedTypes.includes(file.type)) {
      UIUtils.createToast("error", "Hanya file JPG dan PNG yang diizinkan");
      return false;
    }
    return true;
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  simulateProgress(progressBar) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 90) progress = 90;
      progressBar.style.width = `${progress}%`;
      if (progress >= 90) {
        clearInterval(interval);
      }
    }, 200);
    return interval;
  }
}

// Enhanced Navigation Manager
class AdminNavigationManager {
  constructor() {
    this.setupNavigation();
  }

  setupNavigation() {
    document.addEventListener("click", (e) => {
      const alertButton = e.target.closest(".alert-action-btn");
      if (alertButton) {
        e.preventDefault();
        const target = alertButton.getAttribute("href");
        if (target) {
          this.navigateToTab(target);
        }
      }
    });
  }

  navigateToTab(tabId) {
    const navButton = document.querySelector(
      `#admin-nav button[data-bs-target="${tabId}"]`
    );
    if (navButton) {
      const tab = new bootstrap.Tab(navButton);
      tab.show();
    }
  }
}

class AdminController {
  constructor() {
    this.isInitialized = false;
    this.state = new AdminState();
    this.renderer = new AdminRenderer(this.state);
    this.modalManager = new AdminModalManager(this.state);
    this.uploadManager = new AdminUploadManager(this.state);
    this.navigationManager = new AdminNavigationManager();
    this.elements = {};
  }

  async init() {
    if (this.isInitialized) return;
    this.showLoader(true, "Menginisialisasi Panel...");
    this.checkAuth();
    this.bindElements();
    this.setupEventListeners();
    await this.loadInitialData();
    this.isInitialized = true;
    Logger.info("Admin controller initialized.");
    this.showLoader(false);
  }
  async exportReport(type, format) {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    if (!startDate || !endDate) {
      UIUtils.createToast("error", "Harap pilih tanggal mulai dan selesai.");
      return;
    }

    const date1 = new Date(startDate);
    const date2 = new Date(endDate);
    const diffTime = Math.abs(date2 - date1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      UIUtils.createToast("error", "Periode maksimal adalah 7 hari.");
      return;
    }

    UIUtils.createToast("info", `Mempersiapkan laporan ${format}...`);

    // Filter data berdasarkan tanggal
    const allData = this.state.getData(type);
    const filteredData = allData.filter((item) => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= date1 && itemDate <= date2;
    });

    if (filteredData.length === 0) {
      UIUtils.createToast(
        "warning",
        "Tidak ada data pada periode yang dipilih."
      );
      return;
    }

    // Siapkan data untuk laporan
    let headers, body, title;

    if (type === "piutang") {
      title = "Laporan Piutang Outlet";
      headers = [
        [
          "Tanggal Pengiriman",
          "Nama Outlet",
          "Total Item",
          "Sub Total Tagihan",
        ],
      ];
      body = filteredData.map((p) => [
        this.renderer.formatDate(p.tgl_pengiriman), // Asumsi ada kolom ini di data
        p.nama_outlet,
        p.items ? p.items.length : "N/A", // Asumsi ada data item
        CurrencyFormatter.format(p.total_tagihan),
      ]);
    } else {
      // Hutang
      title = "Laporan Hutang Vendor";
      headers = [
        [
          "Tanggal Nota",
          "Nama Vendor",
          "Tagihan Pernota",
          "Rekening",
          "Bank",
          "Atas Nama",
        ],
      ];
      const vendors = this.state.getData("vendors");
      body = filteredData.map((h) => {
        const vendorInfo =
          vendors.find((v) => v.nama_vendor === h.nama_vendor) || {};
        return [
          this.renderer.formatDate(h.tanggal_nota), // Asumsi
          h.nama_vendor,
          CurrencyFormatter.format(h.total_tagihan),
          vendorInfo.rekening || "-",
          vendorInfo.bank || "-",
          vendorInfo.atas_nama || "-",
        ];
      });
    }

    const periode = `${this.renderer.formatDate(
      startDate
    )} - ${this.renderer.formatDate(endDate)}`;

    if (format === "pdf") {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Header Laporan
      // doc.addImage(logoUrl, 'PNG', 15, 15, 30, 30); // Tambahkan logo jika ada URL-nya
      doc.text("Gudang Bandung Raya", 50, 25);
      doc.setFontSize(10);
      doc.text(title, 15, 50);
      doc.text(`Periode: ${periode}`, 15, 60);

      // Tabel
      doc.autoTable({
        head: headers,
        body: body,
        startY: 70,
      });

      doc.save(`Laporan_${type}_${periode}.pdf`);
    } else {
      // Excel (CSV)
      const csvContent = [
        headers[0].join(","),
        ...body.map((row) => row.join(",")),
      ].join("\n");

      this.downloadCSV(csvContent, `Laporan_${type}_${periode}.csv`);
    }
  }

  checkAuth() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    if (!user || (user.role && user.role.toLowerCase() !== "admin")) {
      Logger.warn("Akses ditolak. Pengguna bukan admin atau tidak login.");
      window.location.href = AppConfig.ROUTES.LOGIN;
      return;
    }
    this.state.setUser(user);
    const adminGreeting = document.getElementById("admin-greeting");
    if (adminGreeting) {
      adminGreeting.textContent = user.nama_user || "Admin";
    }
  }

  bindElements() {
    this.elements = {
      refreshDataBtn: document.getElementById("refreshDataBtn"),
      formTambahItem: document.getElementById("formTambahItem"),
      barangSelect: document.getElementById("barangSelect"),
      vendorSelect: document.getElementById("vendorSelect"),
      noNotaVendor: document.getElementById("noNota"),
      itemQty: document.getElementById("itemQty"),
      itemHarga: document.getElementById("itemHarga"),
      simpanSemuaBtn: document.getElementById("simpanSemuaBtn"),
      hapusSemuaBtn: document.getElementById("hapusSemuaBtn"),
      startNotaSessionBtn: document.getElementById("startNotaSessionBtn"),
      previewTableBody: document.getElementById("tabelBarangMasukPreview"),
      loader: document.getElementById("loader"),
      mainContent: document.getElementById("main-content-tabs"),
    };
  }

  setupEventListeners() {
    this.state.subscribe(this.handleStateUpdate.bind(this));
    this.elements.refreshDataBtn?.addEventListener("click", () =>
      this.refreshDashboard()
    );
    this.elements.formTambahItem?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleAddItem();
    });
    this.elements.startNotaSessionBtn?.addEventListener("click", () =>
      this.handleStartNotaSession()
    );
    this.elements.simpanSemuaBtn?.addEventListener("click", () =>
      this.handleSubmitBarangMasuk()
    );
    this.elements.hapusSemuaBtn?.addEventListener("click", () => {
      if (confirm("Yakin ingin menghapus semua item dari daftar?")) {
        this.state.clearBarangMasuk();
      }
    });
    document.addEventListener("click", (e) => {
      this.handleDynamicClicks(e);
    });
    document.addEventListener("input", (e) => {
      if (e.target.classList.contains("stok-input")) {
        this.handleStokInputChange(e.target);
      }
    });
    document.addEventListener("shown.bs.tab", (e) => {
      this.handleTabChange(e.target);
    });
    this.setupUploadListeners();
    document.addEventListener("click", (e) => {
      if (
        e.target.id === "exportPiutangBtn" ||
        e.target.id === "exportHutangBtn"
      ) {
        const type = e.target.id === "exportPiutangBtn" ? "piutang" : "hutang";
        const modal = new bootstrap.Modal(
          document.getElementById("exportModal")
        );
        document.getElementById(
          "exportModalLabel"
        ).textContent = `Ekspor Laporan ${
          type === "piutang" ? "Piutang Outlet" : "Hutang Vendor"
        }`;

        document.getElementById("exportAsPdfBtn").onclick = () =>
          this.exportReport(type, "pdf");
        document.getElementById("exportAsExcelBtn").onclick = () =>
          this.exportReport(type, "excel");

        modal.show();
      }
    });
    const mobileNavLinks = document.querySelectorAll(
      "#admin-nav-mobile .nav-link"
    );
    const mobileSidebarEl = document.getElementById("mobileSidebar");

    if (mobileSidebarEl) {
      const mobileSidebarInstance =
        bootstrap.Offcanvas.getOrCreateInstance(mobileSidebarEl);
      mobileNavLinks.forEach((link) => {
        link.addEventListener("click", () => {
          mobileSidebarInstance.hide();
        });
      });
    }
  }

  setupUploadListeners() {
    document.addEventListener("click", (e) => {
      const uploadBtn = e.target.closest(".upload-bukti-btn");
      if (uploadBtn) {
        const id = uploadBtn.dataset.id;
        const type = uploadBtn.dataset.type;
        this.uploadManager.showUploadModal(id, type);
      }
    });
  }

  handleDynamicClicks(e) {
    const removeBtn = e.target.closest(".remove-barang-btn");
    if (removeBtn) {
      const index = parseInt(removeBtn.dataset.index);
      if (confirm("Hapus item ini dari daftar?")) {
        this.state.removeBarangMasuk(index);
      }
      return;
    }
    const editBtn = e.target.closest(".edit-barang-btn");
    if (editBtn) {
      const index = parseInt(editBtn.dataset.index);
      this.modalManager.showEditModal(index);
      return;
    }
    const statusToggle = e.target.closest(".status-toggle");
    if (statusToggle) {
      this.handleStatusToggle(statusToggle);
      return;
    }
    const saveStokBtn = e.target.closest(".save-stok-btn");
    if (saveStokBtn) {
      this.handleSaveStok(saveStokBtn);
      return;
    }
  }

  handleStokInputChange(input) {
    const originalValue = input.dataset.originalValue;
    const currentValue = input.value;
    const productId = input.dataset.productId;
    const saveBtn = document.querySelector(
      `.save-stok-btn[data-product-id="${productId}"]`
    );
    if (currentValue !== originalValue && currentValue.trim() !== "") {
      input.classList.add("changed");
      if (saveBtn) saveBtn.disabled = false;
    } else {
      input.classList.remove("changed");
      if (saveBtn) saveBtn.disabled = true;
    }
  }

  async handleSaveStok(saveBtn) {
    const productId = saveBtn.dataset.productId;
    const input = document.querySelector(
      `.stok-input[data-product-id="${productId}"]`
    );

    if (!input) return;

    const newStok = parseInt(input.value);
    if (isNaN(newStok) || newStok < 0) {
      this.renderer.createEnhancedToast(
        {
          code: "VALIDATION_ERROR",
          message: "Stok harus berupa angka positif",
        },
        "stok"
      );
      return;
    }

    UIUtils.setLoadingState(saveBtn, true, "Menyimpan...");

    try {
      const result = await APIClient.request("update_stok_awal", {
        method: "POST",
        body: JSON.stringify({
          path: "update_stok_awal",
          productId: productId,
          newStok: newStok,
          sessionToken: this.getSessionToken(),
        }),
      });
      if (result.status === "success") {
        this.state.updateStokProduk(productId, newStok);
        input.dataset.originalValue = newStok;
        input.classList.remove("changed");
        saveBtn.disabled = true;

        UIUtils.createToast("success", `Stok ${productId} berhasil diperbarui`);
        this.refreshDashboard();
      } else {
        throw result;
      }
    } catch (error) {
      Logger.error("Failed to update stok", error);
      this.renderer.createEnhancedToast(error, "stok");
      input.value = input.dataset.originalValue;
      input.classList.remove("changed");
      saveBtn.disabled = true;
    } finally {
      UIUtils.setLoadingState(saveBtn, false);
    }
  }

  async handleStatusToggle(toggle) {
    const type = toggle.dataset.type;
    const id = toggle.dataset.id;
    const isChecked = toggle.checked;
    const newStatus = isChecked ? "lunas" : "belum lunas";
    const originalState = !isChecked;

    try {
      toggle.disabled = true;
      const result = await APIClient.request("update_status", {
        method: "POST",
        body: JSON.stringify({
          path: "update_status",
          type: type,
          id: id,
          status: newStatus,
          sessionToken: this.getSessionToken(),
        }),
      });

      if (result.status === "success") {
        this.state.updateItemStatus(type, id, newStatus);
        UIUtils.createToast(
          "success",
          `Status ${type} ${id} berhasil diperbarui`
        );
        this.refreshDashboard();
      } else {
        throw result;
      }
    } catch (error) {
      Logger.error("Failed to update status", error);
      this.renderer.createEnhancedToast(error, "status");
      toggle.checked = originalState;
    } finally {
      toggle.disabled = false;
    }
  }

  handleTabChange(tabElement) {
    const tabId = tabElement.getAttribute("data-bs-target");

    switch (tabId) {
      case "#piutang-outlet":
        this.loadPiutangTab();
        break;
      case "#hutang-vendor":
        this.loadHutangTab();
        break;
      case "#master-produk":
        this.loadMasterProdukTab();
        break;
      case "#analytics":
        this.loadAnalyticsTab();
        break;
      default:
        break;
    }
  }

  loadPiutangTab() {
    this.renderer.renderSearchAndFilter("piutang-search-filter", "piutang");
    this.renderer.renderPiutangTable();
  }

  loadHutangTab() {
    this.renderer.renderSearchAndFilter("hutang-search-filter", "hutang");
    this.renderer.renderHutangTable();
  }

  loadMasterProdukTab() {
    this.renderer.renderInventarisTable();
  }

  loadAnalyticsTab() {
    this.renderer.renderAnalytics();
  }

  handleStateUpdate(event, data) {
    if (
      event === "barang-masuk-updated" ||
      event === "barang-masuk-added" ||
      event === "barang-masuk-removed" ||
      event === "barang-masuk-cleared"
    ) {
      this.renderer.renderBarangMasukPreview();
    }
    if (event === "data-updated") {
      this.refreshDashboard();
      if (data.key === "inventaris") {
        this.populateBarangSelect(data.value);
        const masterProdukTab = document.querySelector(
          "#master-produk-tab.active"
        );
        if (masterProdukTab) {
          this.renderer.renderInventarisTable();
        }
      }
      if (data.key === "vendors") {
        this.renderer.renderVendorOptions(data.value);
      }
      if (data.key === "piutang") {
        const piutangTab = document.querySelector("#piutang-outlet-tab.active");
        if (piutangTab) {
          this.renderer.renderPiutangTable();
        }
      }
      if (data.key === "hutang") {
        const hutangTab = document.querySelector("#hutang-vendor-tab.active");
        if (hutangTab) {
          this.renderer.renderHutangTable();
        }
      }
    }
  }

  async loadInitialData() {
    this.showLoader(true, "Memuat data dari Spreadsheet...");
    try {
      const [piutangRes, hutangRes, inventarisRes, vendorsRes, dashboardRes] =
        await Promise.all([
          APIClient.request("piutang"),
          APIClient.request("hutang"),
          APIClient.request("inventory"),
          APIClient.request("vendors"),
          APIClient.request("dashboard_summary"),
        ]);
      this.state.setData("piutang", piutangRes.data);
      this.state.setData("hutang", hutangRes.data);
      this.state.setData("inventaris", inventarisRes.data);
      this.state.setData("vendors", vendorsRes.data);
      this.state.setData("dashboard", {
        summary: dashboardRes.data,
        ...this.state.getDashboardDetails(),
      });
      this.refreshDashboard();
    } catch (error) {
      Logger.error("Gagal memuat data awal", error);
      this.renderer.createEnhancedToast(error, "initial_load");
    } finally {
      this.showLoader(false);
    }
  }

  refreshDashboard() {
    const summaryData = this.state.getSummaryData();
    const detailsData = this.state.getDashboardDetails();
    this.renderer.renderSummaryCards(summaryData);
    this.renderer.renderDashboardDetails(detailsData);
  }

  populateBarangSelect(inventaris) {
    const select = this.elements.barangSelect;
    if (!select) return;
    select.innerHTML =
      '<option selected disabled value="">Pilih barang...</option>';
    inventaris.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.nama;
      option.dataset.unit = item.unit;
      select.appendChild(option);
    });
  }

  handleAddItem() {
    if (!this.state.getCurrentNotaSession()) {
      UIUtils.createToast("error", "Harap mulai sesi nota terlebih dahulu.");
      return;
    }
    const selectedOption =
      this.elements.barangSelect.options[
        this.elements.barangSelect.selectedIndex
      ];
    const newItem = {
      id_barang: this.elements.barangSelect.value,
      nama_barang: selectedOption.textContent,
      unit: selectedOption.dataset.unit || "pcs",
      qty: Number(this.elements.itemQty.value),
      harga: Number(this.elements.itemHarga.value),
    };
    try {
      if (this.state.addBarangMasuk(newItem)) {
        this.elements.formTambahItem.reset();
        this.elements.barangSelect.focus();
      }
    } catch (error) {
      UIUtils.createToast("error", error.message);
    }
  }

  async handleSubmitBarangMasuk() {
    const itemsToSubmit = this.state.getData("barangMasukList");
    if (itemsToSubmit.length === 0) {
      this.renderer.createEnhancedToast(
        {
          code: "VALIDATION_ERROR",
          message: "Tidak ada item untuk disimpan.",
        },
        "barang_masuk"
      );
      return;
    }

    const payload = {
      path: "barang_masuk",
      items: itemsToSubmit,
      vendor: { nama_vendor: this.state.getCurrentNotaSession().vendor },
      noNota: this.state.getCurrentNotaSession().noNota,
      tanggalNota: this.state.getCurrentNotaSession().tanggalNota,
      tanggalJatuhTempo: this.state.getCurrentNotaSession().tanggalJatuhTempo,

      sessionToken: this.getSessionToken(),
    };
    UIUtils.setLoadingState(this.elements.simpanSemuaBtn, true, "Menyimpan...");
    try {
      const result = await APIClient.request(payload.path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.status === "success") {
        UIUtils.createToast("success", result.message);

        // Menggunakan fungsi baru yang benar untuk membersihkan cache
        StorageUtils.clearCacheItem("hutang");
        StorageUtils.clearCacheItem("inventory");
        StorageUtils.clearCacheItem("dashboard_summary");
        StorageUtils.clearCacheItem("piutang"); // Kita bersihkan juga piutang untuk jaga-jaga

        this.state.clearBarangMasuk();
        this.toggleNotaForm(false); // Buka kembali form nota
        this.toggleItemForm(true); // Kunci kembali form item
        document.getElementById("formNotaVendor").reset();

        await this.loadInitialData(); // Memuat ulang semua data yang sudah fresh
      } else {
        throw result;
      }
    } catch (error) {
      Logger.error("Gagal menyimpan barang masuk", error);
      this.renderer.createEnhancedToast(error, "barang_masuk");
    } finally {
      UIUtils.setLoadingState(this.elements.simpanSemuaBtn, false);
    }
  }

  getSessionToken() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    return user?.sessionToken;
  }

  showLoader(show, message = "Memuat data...") {
    if (this.elements.loader) {
      this.elements.loader.querySelector("p").textContent = message;
      this.elements.loader.classList.toggle("d-none", !show);
    }
    this.elements.mainContent?.classList.toggle("d-none", show);
  }

  // Export functionality
  async exportData(type) {
    try {
      let data, filename;

      switch (type) {
        case "piutang":
          data = this.state.getData("piutang");
          filename = `piutang_${new Date().toISOString().split("T")[0]}.csv`;
          break;
        case "hutang":
          data = this.state.getData("hutang");
          filename = `hutang_${new Date().toISOString().split("T")[0]}.csv`;
          break;
        case "inventaris":
          data = this.state.getData("inventaris");
          filename = `inventaris_${new Date().toISOString().split("T")[0]}.csv`;
          break;
        default:
          throw new Error("Tipe ekspor tidak valid");
      }

      if (!data || data.length === 0) {
        UIUtils.createToast("warning", "Tidak ada data untuk diekspor");
        return;
      }

      // Convert to CSV
      const csv = this.convertToCSV(data);

      // Download file
      this.downloadCSV(csv, filename);

      this.state.analytics.recordActivity("data_exported", {
        type,
        count: data.length,
      });
      UIUtils.createToast("success", `Data ${type} berhasil diekspor`);
    } catch (error) {
      Logger.error("Export failed", error);
      UIUtils.createToast("error", `Gagal mengekspor data: ${error.message}`);
    }
  }

  convertToCSV(data) {
    if (!data || data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header] || "";
            // Escape quotes and wrap in quotes if contains comma
            return typeof value === "string" && value.includes(",")
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(",")
      ),
    ].join("\n");

    return csvContent;
  }

  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Search functionality
  searchData(query, dataType) {
    const data = this.state.getData(dataType);
    if (!data || !query) return data;

    const lowercaseQuery = query.toLowerCase();

    return data.filter((item) => {
      return Object.values(item).some((value) =>
        String(value).toLowerCase().includes(lowercaseQuery)
      );
    });
  }

  // Filter functionality
  filterData(filters, dataType) {
    let data = this.state.getData(dataType);
    if (!data) return [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") {
        data = data.filter((item) => {
          if (key === "status") {
            return (
              (item.status || "belum lunas").toLowerCase() ===
              value.toLowerCase()
            );
          }
          return String(item[key]).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    return data;
  }
  handleStartNotaSession() {
    try {
      const vendor = this.elements.vendorSelect.value;
      const noNota = this.elements.noNotaVendor.value;
      const tanggalNota = document.getElementById("tanggalNota").value;
      const tanggalJatuhTempo =
        document.getElementById("tanggalJatuhTempo").value;

      // Validasi input
      if (!vendor || !noNota || !tanggalNota || !tanggalJatuhTempo) {
        UIUtils.createToast(
          "error",
          "Harap lengkapi semua detail nota vendor."
        );
        return;
      }

      // Panggil fungsi di state untuk memulai sesi
      this.state.startNotaSession(
        vendor,
        noNota,
        tanggalNota,
        tanggalJatuhTempo
      );

      UIUtils.createToast("success", `Sesi untuk nota ${noNota} dimulai.`);

      // Aktifkan form input barang dan nonaktifkan form nota
      this.toggleNotaForm(true);
      this.toggleItemForm(false);
    } catch (error) {
      UIUtils.createToast("error", error.message);
    }
  }

  // Anda juga bisa menambahkan fungsi pembantu ini untuk membuat kode lebih rapi
  toggleNotaForm(disabled) {
    this.elements.vendorSelect.disabled = disabled;
    this.elements.noNotaVendor.disabled = disabled;
    document.getElementById("tanggalNota").disabled = disabled;
    document.getElementById("tanggalJatuhTempo").disabled = disabled;
    this.elements.startNotaSessionBtn.disabled = disabled;
  }

  toggleItemForm(disabled) {
    this.elements.barangSelect.disabled = disabled;
    this.elements.itemQty.disabled = disabled;
    this.elements.itemHarga.disabled = disabled;
    document.getElementById("addItemBtn").disabled = disabled;
    document.getElementById("simpanSemuaBtn").disabled = disabled;
    document.getElementById("hapusSemuaBtn").disabled = disabled;
  }
}

// =================================================================
// INISIALISASI APLIKASI SAAT DOM SIAP
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const app = new AdminController();
    app.init().catch((error) => {
      Logger.error("Inisialisasi Admin Panel Gagal Total", error);
      document.body.innerHTML =
        "<h1>Error Kritis</h1><p>Gagal memuat aplikasi. Cek console untuk detail.</p>";
    });
    window.adminApp = app;
  }, 100);
});
