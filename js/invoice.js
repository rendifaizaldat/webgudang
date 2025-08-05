// invoice.js - Enhanced Invoice Generation with Error Handling and UX Improvements

class InvoiceData {
  constructor() {
    this.user = null;
    this.transactionItems = [];
    this.transactionDate = null;
    this.invoiceNumber = null;
    this.total = 0;
  }

  loadFromStorage() {
    const userForInvoice = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER_FOR_INVOICE);
    this.user = userForInvoice || StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    StorageUtils.removeItem(AppConfig.STORAGE_KEYS.USER_FOR_INVOICE);

    this.transactionItems = StorageUtils.getItem(
      AppConfig.STORAGE_KEYS.LAST_TRANSACTION,
      []
    );
    this.transactionDate = StorageUtils.getItem(
      AppConfig.STORAGE_KEYS.LAST_TRANSACTION_DATE
    );

    if (this.isValid()) {
      this.generateInvoiceNumber();
      this.calculateTotal();
      return true;
    }

    return false;
  }

  isValid() {
    return (
      this.user && this.transactionItems && this.transactionItems.length > 0
    );
  }

  generateInvoiceNumber() {
    const timestamp = Date.now().toString();
    this.invoiceNumber = `INV-${
      this.user.outlet?.toUpperCase() || "OUTLET"
    }-${timestamp.slice(-8)}`;
  }

  calculateTotal() {
    this.total = this.transactionItems.reduce((sum, item) => {
      const itemTotal = (item.harga || 0) * (item.qty || 0);
      return sum + itemTotal;
    }, 0);
  }

  getFormattedDate() {
    if (!this.transactionDate) {
      return new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    try {
      return new Date(this.transactionDate).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      Logger.warn("Invalid transaction date", { date: this.transactionDate });
      return new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  getTimestamp() {
    const now = new Date();
    return now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

class InvoiceRenderer {
  constructor(data) {
    this.data = data;
  }

  render() {
    const wrapper = document.getElementById("invoice-wrapper");
    if (!wrapper) {
      throw new Error("Invoice wrapper element not found");
    }

    if (!this.data.isValid()) {
      this.renderErrorState(wrapper);
      return;
    }

    this.renderInvoice(wrapper);
    this.updateTimestamp();
    this.updateOutletInfo();
    this.renderInvoiceItems();
    this.updateTotal();
  }

  renderErrorState(wrapper) {
    wrapper.innerHTML = `
      <div class="text-center p-5 card glass-card">
        <i class="bi bi-file-earmark-x" style="font-size: 5rem; color: var(--secondary);"></i>
        <h3 class="mt-3">Data Invoice Tidak Ditemukan</h3>
        <p class="text-muted">
          Sepertinya tidak ada data transaksi terakhir. Silakan lakukan pemesanan terlebih dahulu.
        </p>
        <div class="d-grid gap-2 mt-4" style="max-width: 300px; margin: 0 auto;">
          <a href="${AppConfig.ROUTES.CATALOG}" class="btn btn-primary">
            <i class="bi bi-arrow-left me-2"></i>Kembali ke Katalog
          </a>
          <button class="btn btn-outline-secondary" onclick="this.retry()">
            <i class="bi bi-arrow-clockwise me-2"></i>Coba Lagi
          </button>
        </div>
      </div>
    `;
  }

  renderInvoice(wrapper) {
    wrapper.innerHTML = `
  <div class="card" id="invoice-container" ...>
    <div class="card-body p-4">
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div class="d-flex align-items-center">
          <img src="https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=180,fit=crop,q=95/ALpeWM5b1Js3G9vP/logo-asstro-hires-mjE7bw10LXFGo53w.png" 
               alt="Logo" 
               class="me-3" 
               style="width: 60px; height: 60px; border-radius: 50%;"
               loading="lazy">
          <div>
            <h5 class="fw-bold mb-0">Pemesanan Berhasil</h5>
            <p class="text-muted small mb-0" id="invoiceTimestamp"></p>
          </div>
        </div>
      </div>
      
          <div id="infoOutlet" class="mb-3" style="font-size: 0.9rem;"></div>
          <hr>
          
          <div class="table-responsive">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th class="text-center" style="width: 60px;">Qty</th>
                  <th class="text-end" style="width: 100px;">Total</th>
                </tr>
              </thead>
              <tbody id="invoiceBody"></tbody>
            </table>
          </div>
          
          <hr>
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="fw-bold mb-0">Total Bayar:</h6>
            <h5 class="fw-bold text-primary mb-0" id="totalHarga">Rp 0</h5>
          </div>
          
          <div class="mt-3 p-2 bg-light rounded">
            <small class="text-muted">
              <i class="bi bi-info-circle me-1"></i>
              Invoice ini adalah bukti pemesanan. Pembayaran akan ditagih sesuai tanggal pengiriman.
            </small>
          </div>
        </div>
      </div>

      <div class="d-grid gap-2 mt-4" style="max-width: 450px; margin: auto;">
        <button id="downloadPdfBtn" class="btn btn-primary py-2 fw-bold">
          <i class="bi bi-download me-2"></i>Unduh Invoice (PDF)
        </button>
        <button id="downloadJpgBtn" class="btn btn-success py-2 fw-bold">
          <i class="bi bi-image me-2"></i>Unduh Invoice (JPG)
        </button>
        <button id="shareBtn" class="btn btn-info py-2 fw-bold text-white">
    <i class="bi bi-share-fill me-2"></i>Bagikan Invoice
  </button>
        <a href="${AppConfig.ROUTES.CATALOG}" class="btn btn-outline-secondary py-2">
          <i class="bi bi-arrow-left me-2"></i>Kembali ke Katalog
        </a>
      </div>
    `;
  }

  updateTimestamp() {
    const timestampEl = document.getElementById("invoiceTimestamp");
    if (timestampEl) {
      timestampEl.textContent = `${this.data.getTimestamp()} | ${
        this.data.invoiceNumber
      }`;
    }
  }

  updateOutletInfo() {
    const infoEl = document.getElementById("infoOutlet");
    if (infoEl) {
      infoEl.innerHTML = `
  <div class="row">
    <div class="col-5">
      <p class="mb-1"><strong>Outlet:</strong> ${
        this.data.user.outlet || "-"
      }</p>
    </div>
    <div class="col-7">
      <p class="mb-1"><strong>Tgl. Tagihan:</strong> ${this.data.getFormattedDate()}</p>
    </div>
  </div>
      `;
    }
  }

  renderInvoiceItems() {
    const tbody = document.getElementById("invoiceBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    this.data.transactionItems.forEach((item) => {
      const itemTotal = (item.harga || 0) * (item.qty || 0);
      const row = document.createElement("tr");

      // Sel 1: Nama & Harga Produk (Aman)
      const cell1 = document.createElement("td");
      const nameDiv = document.createElement("div");
      nameDiv.className = "fw-bold";
      nameDiv.textContent = item.nama || "Unknown Item"; // <-- AMAN

      const priceSmall = document.createElement("small");
      priceSmall.className = "text-muted";
      const unit = item.unit || "pcs";
      priceSmall.textContent = `${unit} / ${CurrencyFormatter.format(
        item.harga || 0
      )}`;

      cell1.appendChild(nameDiv);
      cell1.appendChild(priceSmall);

      // Sel 2: Kuantitas (Aman)
      const cell2 = document.createElement("td");
      cell2.className = "text-center align-middle";
      cell2.textContent = item.qty || 0;

      // Sel 3: Total (Aman)
      const cell3 = document.createElement("td");
      cell3.className = "text-end align-middle fw-bold";
      cell3.textContent = CurrencyFormatter.format(itemTotal);

      row.appendChild(cell1);
      row.appendChild(cell2);
      row.appendChild(cell3);

      tbody.appendChild(row);
    });
  }

  updateTotal() {
    const totalEl = document.getElementById("totalHarga");
    if (totalEl) {
      totalEl.textContent = CurrencyFormatter.format(this.data.total);
    }
  }

  retry() {
    window.location.reload();
  }
}

class InvoiceDownloader {
  constructor(data) {
    this.data = data;
    this.isDownloading = false;
    this.isSharing = false;
  }

  async downloadAsJPG() {
    if (this.isDownloading) return;

    this.isDownloading = true;
    const button = document.getElementById("downloadJpgBtn");
    UIUtils.setLoadingState(button, true, "Membuat JPG...");

    try {
      if (!window.html2canvas) {
        throw new Error("html2canvas library not loaded");
      }

      Logger.info("Starting JPG download");

      const invoiceEl = document.getElementById("invoice-container");
      if (!invoiceEl) {
        throw new Error("Invoice container not found");
      }

      // Optimize for canvas rendering
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        imageTimeout: 15000,
        removeContainer: true,
      });

      // Create download link
      const link = document.createElement("a");
      link.download = this.generateFileName("jpg");
      link.href = canvas.toDataURL("image/jpeg", 0.95);

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Logger.info("JPG download completed");
      UIUtils.createToast("success", "Invoice (JPG) berhasil diunduh.");
    } catch (error) {
      Logger.error("JPG download failed", error);
      UIUtils.createToast("error", `Gagal mengunduh JPG: ${error.message}`);
    } finally {
      this.isDownloading = false;
      UIUtils.setLoadingState(button, false);
    }
  }

  async downloadAsPDF() {
    if (this.isDownloading) return;

    this.isDownloading = true;
    const button = document.getElementById("downloadPdfBtn");
    UIUtils.setLoadingState(button, true, "Membuat PDF...");

    try {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error("jsPDF library not loaded");
      }

      Logger.info("Starting PDF download");

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "pt", "a4");

      const invoiceEl = document.getElementById("invoice-wrapper");
      if (!invoiceEl) {
        throw new Error("Invoice wrapper not found");
      }

      await new Promise((resolve, reject) => {
        doc.html(invoiceEl, {
          callback: function (doc) {
            try {
              doc.save(this.generateFileName("pdf"));
              resolve();
            } catch (error) {
              reject(error);
            }
          }.bind(this),
          x: 15,
          y: 15,
          width: 550,
          windowWidth: 1200,
          margin: [15, 15, 15, 15],
        });
      });

      Logger.info("PDF download completed");
      UIUtils.createToast("success", "Invoice (PDF) berhasil diunduh.");
    } catch (error) {
      Logger.error("PDF download failed", error);
      UIUtils.createToast("error", `Gagal mengunduh PDF: ${error.message}`);
    } finally {
      this.isDownloading = false;
      UIUtils.setLoadingState(button, false);
    }
  }

  generateFileName(extension) {
    const outlet = this.data.user.outlet || "outlet";
    const invoiceNum = this.data.invoiceNumber || "invoice";
    const timestamp = new Date().toISOString().slice(0, 10);

    return `invoice_${outlet}_${invoiceNum}_${timestamp}.${extension}`;
  }

  async uploadToDrive() {
    if (this.isUploading) return;
    this.isUploading = true;
    Logger.info("Starting invoice upload to Drive...");

    try {
      const invoiceEl = document.getElementById("invoice-container");
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // Ekstrak data base64 dari URL
      const base64Data = dataUrl.substring(dataUrl.indexOf(",") + 1);

      const payload = {
        path: "saveInvoiceToDrive",
        invoiceData: {
          fileName: this.generateFileName("jpg"),
          mimeType: "image/jpeg",
          data: base64Data,
        },
      };

      const result = await APIClient.request("saveInvoiceToDrive", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        useCache: false,
      });

      if (result.status === "success") {
        Logger.info("Invoice successfully uploaded to Drive", {
          url: result.url,
        });
        // UIUtils.createToast("success", "Invoice berhasil diunggah ke Drive.");
      } else {
        throw new Error(result.message || "Upload failed");
      }
    } catch (error) {
      Logger.error("Invoice upload failed", error);
      UIUtils.createToast("error", "Gagal mengunggah invoice ke Drive.");
    } finally {
      this.isUploading = false;
    }
  }
  async shareAsImage() {
    // 1. Mencegah klik ganda dengan flag
    if (this.isSharing) {
      UIUtils.createToast(
        "info",
        "Harap tunggu, proses sebelumnya belum selesai."
      );
      return;
    }

    const button = document.getElementById("shareBtn");
    UIUtils.setLoadingState(button, true, "Menyiapkan...");
    this.isSharing = true;

    try {
      const invoiceEl = document.getElementById("invoice-container");
      const canvas = await html2canvas(invoiceEl, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95)
      );

      // 2. Membedakan logika untuk Mobile dan Desktop
      if (AppConfig.device.isMobile && navigator.share && navigator.canShare) {
        // --- LOGIKA UNTUK MOBILE ---
        const file = new File([blob], this.generateFileName("jpg"), {
          type: "image/jpeg",
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: "Invoice Pemesanan",
            text: `Berikut adalah invoice untuk ${this.data.user.outlet}`,
            files: [file],
          });
          Logger.info("Invoice shared successfully on mobile.");
        } else {
          UIUtils.createToast(
            "warning",
            "Tidak dapat berbagi file di browser ini."
          );
        }
      } else {
        // --- LOGIKA UNTUK DESKTOP (Salin ke Clipboard) ---
        if (navigator.clipboard && navigator.clipboard.write) {
          const clipboardItem = new ClipboardItem({ "image/jpeg": blob });
          await navigator.clipboard.write([clipboardItem]);
          UIUtils.createToast(
            "success",
            "Invoice (gambar) berhasil disalin ke clipboard."
          );
          Logger.info("Invoice image copied to clipboard on desktop.");
        } else {
          // Fallback jika 'copy to clipboard' gagal/tidak didukung
          UIUtils.createToast(
            "info",
            "Men-download invoice karena clipboard tidak didukung..."
          );
          this.downloadAsJPG();
        }
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        // Abaikan jika pengguna membatalkan share
        Logger.error("Share failed", error);
        UIUtils.createToast("error", `Gagal berbagi gambar: ${error.message}`);
      }
    } finally {
      UIUtils.setLoadingState(button, false);
      this.isSharing = false; // Reset flag
    }
  }
}

class InvoiceController {
  constructor() {
    this.data = new InvoiceData();
    this.renderer = null;
    this.downloader = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // Load data from storage
      if (!this.data.loadFromStorage()) {
        Logger.warn("Invalid invoice data");
      }

      // Initialize components
      this.renderer = new InvoiceRenderer(this.data);
      this.downloader = new InvoiceDownloader(this.data);

      // Render invoice
      this.renderer.render();

      // Setup event listeners if data is valid
      if (this.data.isValid()) {
        this.setupEventListeners();
      }

      this.isInitialized = true;
      Logger.info("Invoice controller initialized", {
        hasValidData: this.data.isValid(),
        itemCount: this.data.transactionItems.length,
        total: this.data.total,
      });
    } catch (error) {
      Logger.error("Invoice initialization failed", error);
      this.showErrorFallback();
    }
    if (this.data.isValid()) {
      this.setupEventListeners();
      // Panggil fungsi upload setelah beberapa saat agar halaman sempat tergambar
      setTimeout(() => this.downloader.uploadToDrive(), 1000);
    }
  }

  setupEventListeners() {
    // Download buttons
    const jpgBtn = document.getElementById("downloadJpgBtn");
    const pdfBtn = document.getElementById("downloadPdfBtn");

    if (jpgBtn) {
      jpgBtn.addEventListener("click", () => {
        this.downloader.downloadAsJPG();
      });
    }

    if (pdfBtn) {
      pdfBtn.addEventListener("click", () => {
        this.downloader.downloadAsPDF();
      });
    }

    // Add keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "p":
            e.preventDefault();
            this.downloader.downloadAsPDF();
            break;
          case "s":
            e.preventDefault();
            this.downloader.downloadAsJPG();
            break;
        }
      }
    });

    const shareBtn = document.getElementById("shareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        this.downloader.shareAsImage();
      });
    }

    // Add print functionality
    this.addPrintStyles();
  }

  addPrintStyles() {
    const printStyles = document.createElement("style");
    printStyles.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        
        #invoice-container,
        #invoice-container * {
          visibility: visible;
        }
        
        #invoice-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          box-shadow: none !important;
          border: none !important;
        }
        
        .btn, .d-grid {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(printStyles);

    // Add print shortcut
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    });
  }

  showErrorFallback() {
    const wrapper = document.getElementById("invoice-wrapper");
    if (wrapper) {
      wrapper.innerHTML = `
        <div class="text-center p-5 card glass-card">
          <i class="bi bi-exclamation-triangle" style="font-size: 5rem; color: var(--warning);"></i>
          <h3 class="mt-3">Terjadi Kesalahan</h3>
          <p class="text-muted">
            Gagal memuat halaman invoice. Silakan coba lagi atau hubungi administrator.
          </p>
          <div class="d-grid gap-2 mt-4" style="max-width: 300px; margin: 0 auto;">
            <button class="btn btn-primary" onclick="window.location.reload()">
              <i class="bi bi-arrow-clockwise me-2"></i>Muat Ulang
            </button>
            <a href="${AppConfig.ROUTES.CATALOG}" class="btn btn-outline-secondary">
              <i class="bi bi-house me-2"></i>Kembali ke Katalog
            </a>
          </div>
        </div>
      `;
    }
  }

  // Public method to refresh invoice data
  refresh() {
    if (this.data.loadFromStorage()) {
      this.renderer.render();
      Logger.info("Invoice refreshed");
    } else {
      Logger.warn("No valid data to refresh");
    }
  }
}

// Enhanced error handling for library loading
class LibraryChecker {
  static checkRequiredLibraries() {
    const requiredLibraries = [
      { name: "html2canvas", check: () => window.html2canvas },
      { name: "jsPDF", check: () => window.jspdf && window.jspdf.jsPDF },
    ];

    const missingLibraries = requiredLibraries.filter((lib) => !lib.check());

    if (missingLibraries.length > 0) {
      const libraryNames = missingLibraries.map((lib) => lib.name).join(", ");
      Logger.error("Missing required libraries", { missing: libraryNames });

      UIUtils.createToast(
        "warning",
        `Beberapa fitur mungkin tidak tersedia karena library tidak dimuat: ${libraryNames}`,
        { persistent: true }
      );
    }

    return missingLibraries.length === 0;
  }

  static async waitForLibraries(timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.checkRequiredLibraries()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Wait for required libraries to load
    const librariesLoaded = await LibraryChecker.waitForLibraries();

    if (!librariesLoaded) {
      Logger.warn("Some libraries failed to load within timeout");
    }

    // Initialize invoice controller
    const invoiceController = new InvoiceController();
    await invoiceController.init();

    // Store controller globally for debugging
    window.invoiceController = invoiceController;
  } catch (error) {
    Logger.error("Failed to initialize invoice page", error);
    UIUtils.createToast("error", "Gagal menginisialisasi halaman invoice");
  }
});

// Add global error handler for uncaught errors
window.addEventListener("error", (event) => {
  Logger.error("Uncaught error on invoice page", {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    error: event.error,
  });
});

// Add handler for unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  Logger.error("Unhandled promise rejection on invoice page", {
    reason: event.reason,
  });

  // Prevent the default browser behavior
  event.preventDefault();
});
