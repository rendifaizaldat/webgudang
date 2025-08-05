// keranjang.js - Enhanced Cart with Improved State Management and UX

class CartState {
  constructor() {
    this.items = new Map();
    this.user = null;
    this.deliveryDate = null;
    this.listeners = new Set();
  }

  loadFromStorage() {
    // Load user
    this.user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);

    // Load cart items
    const cartItems = StorageUtils.getItem(AppConfig.STORAGE_KEYS.CART, []);
    this.items.clear();

    cartItems.forEach((item) => {
      if (this.validateCartItem(item)) {
        this.items.set(item.id, item);
      }
    });

    this.notifyListeners("cart-loaded");
  }

  validateCartItem(item) {
    return (
      item &&
      item.id &&
      item.nama &&
      typeof item.qty === "number" &&
      item.qty > 0 &&
      typeof item.harga === "number" &&
      item.harga > 0
    );
  }

  updateItem(itemId, quantity) {
    const item = this.items.get(itemId);
    if (!item) return false;

    const validatedQty = Math.max(0, Math.min(quantity, item.stok_akhir));

    if (validatedQty > 0) {
      this.items.set(itemId, { ...item, qty: validatedQty });
    } else {
      this.items.delete(itemId);
    }

    this.saveToStorage();

    if (validatedQty > 0) {
      // Jika kuantitas masih ada, kirim sinyal 'update'
      this.notifyListeners("item-updated", { itemId, quantity: validatedQty });
    } else {
      // Jika kuantitas 0, kirim sinyal 'hapus'
      this.notifyListeners("item-removed", { itemId, item: item });
    }

    return true;
  }

  removeItem(itemId) {
    const item = this.items.get(itemId);
    if (item) {
      this.items.delete(itemId);
      this.saveToStorage();
      this.notifyListeners("item-removed", { itemId, item });
      return true;
    }
    return false;
  }

  setDeliveryDate(date) {
    this.deliveryDate = date;
    this.notifyListeners("delivery-date-updated", { date });
  }

  getTotal() {
    return Array.from(this.items.values()).reduce((sum, item) => {
      return sum + item.harga * item.qty;
    }, 0);
  }

  getItemCount() {
    return Array.from(this.items.values()).reduce(
      (sum, item) => sum + item.qty,
      0
    );
  }

  isEmpty() {
    return this.items.size === 0;
  }

  clear() {
    this.items.clear();
    this.saveToStorage();
    this.notifyListeners("cart-cleared");
  }

  saveToStorage() {
    const cartArray = Array.from(this.items.values());
    StorageUtils.setItem(AppConfig.STORAGE_KEYS.CART, cartArray);
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
        Logger.error("Cart state listener error", {
          event,
          error: error.message,
        });
      }
    });
  }
}

class CartRenderer {
  constructor(container, state, outlets = []) {
    this.container = container;
    this.state = state;
    this.outlets = outlets;
  }

  render() {
    if (this.state.isEmpty()) {
      this.renderEmptyCart();
      return;
    }
    this.renderCartItems();
  }

  renderEmptyCart() {
    this.container.innerHTML = `
      <div class="text-center p-5 card glass-card">
        <i class="bi bi-cart-x" style="font-size: 5rem; color: var(--secondary);"></i>
        <h3 class="mt-3">Keranjang Anda kosong</h3>
        <p class="text-muted">Sepertinya Anda belum menambahkan produk apapun.</p>
        <a href="${AppConfig.ROUTES.CATALOG}" class="btn btn-primary mt-2 mx-auto" style="max-width: 200px;">
          <i class="bi bi-shop"></i> Mulai Belanja
        </a>
      </div>
    `;
  }

  renderCartItems() {
    const items = Array.from(this.state.items.values());
    const total = this.state.getTotal();

    const desktopItemsHTML = items
      .map((item) => this.createDesktopCartItemHTML(item))
      .join("");

    const mobileItemsHTML = items
      .map((item) => this.createMobileCartItemHTML(item))
      .join("");

    this.container.innerHTML = `
      <div class="card glass-card p-3">
        <div class="d-none d-md-flex row fw-bold mb-2 border-bottom pb-2 text-muted">
          <div class="col-md-6">PRODUK</div>
          <div class="col-md-4 text-center">KUANTITAS</div>
          <div class="col-md-2 text-end">AKSI</div>
        </div>

        <div class="cart-items-container-desktop d-none d-md-block">
          ${desktopItemsHTML}
        </div>
        
        <div class="cart-items-container-mobile d-md-none">
          ${mobileItemsHTML}
        </div>

        <div class="d-flex justify-content-end align-items-center mt-3 pt-3 border-top">
          <span class="fs-5 me-3">Total Belanja:</span>
          <span class="fs-4 fw-bold text-primary">${CurrencyFormatter.format(
            total
          )}</span>
        </div>
      </div>
      ${this.createDeliveryDateSection()}
      ${this.createOutletSelectionSection()}
      ${this.createCheckoutSection()}
    `;

    this.setupItemEventListeners();
  }
    createOutletSelectionSection() {
    const user = this.state.user;
    // Tampilkan hanya jika user adalah admin DAN ada daftar outlet
    if (!user || user.role.toLowerCase() !== 'admin' || this.outlets.length === 0) {
      return ''; // Kembalikan string kosong jika bukan admin
    }

    const options = this.outlets.map(outlet => 
      `<option value="${outlet}">${outlet}</option>`
    ).join('');

    return `
      <div class="card glass-card p-3 mt-4">
        <div class="row align-items-center">
          <div class="col-md-4">
            <label for="outletSelector" class="form-label fw-bold">
              <i class="bi bi-shop-window me-2"></i>Pilih Outlet Customer:
            </label>
          </div>
          <div class="col-md-8">
            <select class="form-select" id="outletSelector" required>
              <option value="" disabled selected>-- Atas Nama Outlet --</option>
              ${options}
            </select>
            <div class="form-text">
              Admin membuat pesanan atas nama outlet yang dipilih.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- KODE BARU UNTUK TAMPILAN DESKTOP ---
  createDesktopCartItemHTML(item) {
    return `
      <div class="cart-item-desktop row py-3 align-items-center" data-item-id="${
        item.id
      }">
        <div class="col-md-6 d-flex align-items-center">
          <img src="${item.foto || "https://via.placeholder.com/80"}" alt="${
      item.nama
    }" class="img-fluid rounded me-3" style="width: 80px; height: 80px; object-fit: cover;">
          <div class="d-flex flex-column">
            <strong class="d-block mb-1">${item.nama}</strong>
            <small class="text-muted d-block">Sisa Stok: ${
              item.stok_akhir
            }</small>
            <span class="fw-bold mt-1">${CurrencyFormatter.format(
              item.harga
            )}</span>
          </div>
        </div>
        <div class="col-md-4 d-flex align-items-center justify-content-center">
          <div class="quantity-control modern-qty" style="width: 150px;">
            <button class="btn btn-light btn-qty-decrease" data-item-id="${
              item.id
            }" aria-label="Kurangi jumlah"><i class="bi bi-dash"></i></button>
            <input 
                type="text" 
                inputmode="decimal"
                class="form-control text-center qty-input" 
                value="${String(item.qty).replace(".", ",")}" 
                data-item-id="${item.id}" 
                aria-label="Jumlah item">
            <button class="btn btn-light btn-qty-increase" data-item-id="${
              item.id
            }" aria-label="Tambah jumlah"><i class="bi bi-plus"></i></button>
          </div>
        </div>
        <div class="col-md-2 text-end">
          <button class="btn btn-link text-danger p-0 btn-remove" data-item-id="${
            item.id
          }" aria-label="Hapus item"><i class="bi bi-trash-fill fs-5"></i> Hapus</button>
        </div>
      </div>
    `;
  }

  createMobileCartItemHTML(item) {
    return `
      <div class="mobile-cart-item" data-item-id="${item.id}">
        <img src="${item.foto || "https://via.placeholder.com/60"}" alt="${
      item.nama
    }" class="cart-item-image" loading="lazy">
        <div class="cart-item-details">
          <strong class="cart-item-name">${item.nama}</strong>
          <small class="cart-item-price-per-piece text-muted">${CurrencyFormatter.format(
            item.harga
          )} / pcs</small>
        </div>
        <div class="quantity-control modern-qty">
            <button class="btn btn-light btn-qty-decrease" data-item-id="${
              item.id
            }" aria-label="Kurangi jumlah"><i class="bi bi-dash"></i></button>
            <input 
                type="text" 
                inputmode="decimal"
                class="form-control text-center qty-input" 
                value="${String(item.qty).replace(".", ",")}"
                data-item-id="${item.id}" 
                aria-label="Jumlah item">
            <button class="btn btn-light btn-qty-increase" data-item-id="${
              item.id
            }" aria-label="Tambah jumlah"><i class="bi bi-plus"></i></button>
        </div>
        <button class="btn btn-link text-danger p-0 btn-remove" data-item-id="${
          item.id
        }" aria-label="Hapus item">
          <i class="bi bi-trash-fill fs-5"></i>
        </button>
      </div>
    `;
  }

  updateItemDisplay(itemId) {
    const item = this.state.items.get(itemId);
    if (!item) return; // Jika item sudah dihapus, keluar

    const newSubtotal = item.harga * item.qty;
    const formattedQty = String(item.qty).replace(".", ",");

    // Cari semua elemen yang berhubungan dengan item ini (desktop dan mobile)
    const itemElements = this.container.querySelectorAll(
      `[data-item-id="${itemId}"]`
    );

    itemElements.forEach((element) => {
      const qtyInput = element.querySelector(".qty-input");
      if (qtyInput) {
        qtyInput.value = formattedQty;
      }
      const subtotalEl = element.querySelector(".cart-item-subtotal");
      if (subtotalEl) {
        subtotalEl.textContent = CurrencyFormatter.format(newSubtotal);
      }
      const decreaseBtn = element.querySelector(".btn-qty-decrease");
      if (decreaseBtn) {
        decreaseBtn.disabled = item.qty <= 0;
      }
      const increaseBtn = element.querySelector(".btn-qty-increase");
      if (increaseBtn) {
        increaseBtn.disabled = item.qty >= item.stok_akhir;
      }
    });

    this.updateTotal();
  }

  updateTotal() {
    const totalElement = this.container.querySelector(
      ".fs-4.fw-bold.text-primary"
    );
    if (totalElement) {
      totalElement.textContent = CurrencyFormatter.format(
        this.state.getTotal()
      );
    }
  }
  removeItemElement(itemId) {
    const itemElements = this.container.querySelectorAll(
      `[data-item-id="${itemId}"]`
    );
    itemElements.forEach((element) => {
      element.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      element.style.transform = "translateX(-20px)";
      element.style.opacity = "0";
      setTimeout(() => {
        element.remove();
        if (this.state.isEmpty()) {
          this.renderEmptyCart();
        }
      }, 300);
    });
    this.updateTotal();
  }

  setupItemEventListeners() {
    const handleDebouncedUpdate = UIUtils.debounce((value, itemId) => {
      // Perbolehkan koma dan pastikan itu angka
      const formattedValue = value.replace(",", ".").trim();
      const newQty = parseFloat(formattedValue);

      if (!isNaN(newQty) && newQty >= 0) {
        const item = this.state.items.get(itemId);
        if (item && newQty > item.stok_akhir) {
          UIUtils.createToast(
            "warning",
            `Stok ${item.nama} hanya ${item.stok_akhir}.`
          );
          this.state.updateItem(itemId, item.stok_akhir);
        } else {
          this.state.updateItem(itemId, newQty);
        }
      }
    }, 500);

    this.container.querySelectorAll(".qty-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const itemId = e.target.dataset.itemId;
        handleDebouncedUpdate(e.target.value, itemId);
      });
    });

    this.container.querySelectorAll(".btn-qty-decrease").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const itemId = e.currentTarget.dataset.itemId;
        const item = this.state.items.get(itemId);
        if (item) this.state.updateItem(itemId, Math.max(0, item.qty - 1));
      });
    });

    this.container.querySelectorAll(".btn-qty-increase").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const itemId = e.currentTarget.dataset.itemId;
        const item = this.state.items.get(itemId);
        if (item) {
          const newQty = item.qty + 1;
          if (newQty > item.stok_akhir) {
            UIUtils.createToast(
              "warning",
              `Stok ${item.nama} hanya ${item.stok_akhir}.`
            );
          } else {
            this.state.updateItem(itemId, newQty);
          }
        }
      });
    });

    this.container.querySelectorAll(".btn-remove").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.handleItemRemove(e.currentTarget.dataset.itemId)
      );
    });
  }

  handleItemRemove(itemId) {
    if (confirm("Yakin ingin menghapus item ini dari keranjang?")) {
      this.state.removeItem(itemId);
    }
  }

  createDeliveryDateSection() {
    const user = this.state.user; // Ambil data user dari state
    let minDateAttribute = ""; // Siapkan atribut tanggal minimum

    // Cek jika user BUKAN admin, maka batasi tanggalnya
    if (!user || user.role.toLowerCase() !== "admin") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const day = String(tomorrow.getDate()).padStart(2, "0");
      const minDate = `${year}-${month}-${day}`;
      minDateAttribute = `min="${minDate}"`; // Atur atribut jika bukan admin
    }

    // Jika user adalah admin, minDateAttribute akan kosong, sehingga tidak ada batasan tanggal
    return `
      <div class="card glass-card p-3 mt-4">
        <div class="row align-items-center">
          <div class="col-md-4">
            <label for="tanggalKirim" class="form-label fw-bold">
              <i class="bi bi-calendar-event me-2"></i>Pilih Tanggal Pengiriman:
            </label>
          </div>
          <div class="col-md-8">
            <input type="date" 
                   class="form-control" 
                   id="tanggalKirim" 
                   ${minDateAttribute}  /* Terapkan atribut di sini */
                   required
                   aria-describedby="deliveryDateHelp">
            <div id="deliveryDateHelp" class="form-text">
              ${
                user && user.role.toLowerCase() === "admin"
                  ? "Admin dapat memilih tanggal lampau."
                  : "Pengiriman minimal H+1 dari hari pemesanan."
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  createCheckoutSection() {
    return `
      <div class="d-flex justify-content-end mt-4">
        <button id="checkoutButton" class="btn btn-primary btn-lg">
          <i class="bi bi-check-circle me-2"></i>Checkout Sekarang
        </button>
      </div>
    `;
  }

  handleQuantityChange(itemId, change) {
    const item = this.state.items.get(itemId);
    if (!item) return;

    const newQty = item.qty + change;

    if (newQty <= 0) {
      this.handleItemRemove(itemId);
    } else if (newQty > item.stok_akhir) {
      UIUtils.createToast(
        "warning",
        `Stok ${item.nama} hanya tersisa ${item.stok_akhir}.`
      );
    } else {
      this.state.updateItem(itemId, newQty);
    }
  }

  handleItemRemove(itemId) {
    const item = this.state.items.get(itemId);
    if (!item) return;

    // Add confirmation for expensive items
    const itemTotal = item.harga * item.qty;
    if (itemTotal > 100000) {
      // Above 100k
      if (!confirm(`Yakin ingin menghapus ${item.nama} dari keranjang?`)) {
        return;
      }
    }

    this.state.removeItem(itemId);
    UIUtils.createToast("info", `${item.nama} dihapus dari keranjang.`);
  }

  updateItemQuantity(itemId, quantity) {
    const itemElement = this.container.querySelector(
      `[data-item-id="${itemId}"]`
    );
    if (!itemElement) return;

    const qtyInput = itemElement.querySelector(".qty-input");
    if (qtyInput) {
      qtyInput.value = quantity;
    }

    // Update subtotal
    const item = this.state.items.get(itemId);
    if (item) {
      const subtotalElement = itemElement.querySelector(
        ".col-md-2:last-child strong"
      );
      if (subtotalElement) {
        subtotalElement.textContent = CurrencyFormatter.format(
          item.harga * quantity
        );
      }
    }

    // Update button states
    const decreaseBtn = itemElement.querySelector(".btn-qty-decrease");
    const increaseBtn = itemElement.querySelector(".btn-qty-increase");

    if (decreaseBtn) {
      decreaseBtn.disabled = quantity <= 1;
    }

    if (increaseBtn && item) {
      increaseBtn.disabled = quantity >= item.stok_akhir;
    }
  }

  removeItemElement(itemId) {
    const itemElement = this.container.querySelector(
      `[data-item-id="${itemId}"]`
    );
    if (itemElement) {
      // Add fade out animation
      itemElement.style.transition = "opacity 0.3s ease";
      itemElement.style.opacity = "0";

      setTimeout(() => {
        itemElement.remove();

        // Re-render if cart is empty
        if (this.state.isEmpty()) {
          this.render();
        } else {
          this.updateTotal();
        }
      }, 300);
    }
  }

  updateTotal() {
    const totalElement = this.container.querySelector(
      ".fs-4.fw-bold.text-primary"
    );
    if (totalElement) {
      totalElement.textContent = CurrencyFormatter.format(
        this.state.getTotal()
      );
    }
  }
}

class CheckoutManager {
  constructor(state) {
    this.state = state;
    this.isProcessing = false;
  }

  async processCheckout(deliveryDate) {
    if (!this.state.user || !this.state.user.email) {
      UIUtils.createToast(
        "error",
        "Sesi Anda telah berakhir. Harap login kembali untuk melanjutkan."
      );
      // Arahkan ke halaman login setelah beberapa detik
      setTimeout(() => {
        window.location.href = AppConfig.ROUTES.LOGIN;
      }, 3000);
      return; // Hentikan proses checkout di sini
    }
    if (this.isProcessing) return;

    const validationErrors = this.validateCheckout(deliveryDate);
    if (validationErrors.length > 0) {
      UIUtils.createToast("error", validationErrors[0]);
      return;
    }

    this.isProcessing = true;
    const checkoutButton = document.getElementById("checkoutButton");
    UIUtils.setLoadingState(checkoutButton, true, "Memproses...");

    try {
      const payload = this.createCheckoutPayload(deliveryDate);

      const result = await APIClient.request("checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        useCache: false,
      });

      if (result.status === "success") {
        await this.handleCheckoutSuccess(deliveryDate, result); 
      } else {
        throw new Error(result.message || "Checkout gagal");
      }
    } catch (error) {
      Logger.error("Checkout failed", error);
      UIUtils.createToast("error", `Checkout gagal: ${error.message}`);
    } finally {
      this.isProcessing = false;
      UIUtils.setLoadingState(checkoutButton, false);
    }
  }

  validateCheckout(deliveryDate) {
    const errors = [];
    if (this.state.isEmpty()) errors.push("Keranjang belanja kosong!");
    if (!deliveryDate) errors.push("Silakan pilih tanggal pengiriman.");
    const user = this.state.user;
    const outletSelector = document.getElementById('outletSelector');
    if (user && user.role.toLowerCase() === 'admin' && (!outletSelector || !outletSelector.value)) {
        errors.push("Admin harus memilih outlet customer.");
    }
    return errors;
  }

  // --- FUNGSI YANG DIUBAH UNTUK MENGIRIM KOMA ---
  createCheckoutPayload(deliveryDate) {
    const payload = {
      path: "checkout",
      sessionToken: this.state.user.sessionToken,
      deliveryDate: deliveryDate,
      user: this.state.user,
      items: Array.from(this.state.items.values()).map((item) => ({
        id: item.id,
        nama: item.nama,
        qty: Number(item.qty),
        harga: Number(item.harga),
        unit: item.unit || "pcs",
      })),
    };
    const outletSelector = document.getElementById('outletSelector');
    if (this.state.user.role.toLowerCase() === 'admin' && outletSelector && outletSelector.value) {
        payload.selectedOutlet = outletSelector.value;
    }
    return payload;
  }

  async handleCheckoutSuccess(deliveryDate, serverResponse) {
    const userForInvoice = serverResponse.userForInvoice || this.state.user; 

    StorageUtils.setItem(
      AppConfig.STORAGE_KEYS.LAST_TRANSACTION,
      Array.from(this.state.items.values())
    );
    StorageUtils.setItem(
      AppConfig.STORAGE_KEYS.LAST_TRANSACTION_DATE,
      deliveryDate
    );
    StorageUtils.setItem(
        AppConfig.STORAGE_KEYS.USER_FOR_INVOICE,
        userForInvoice
    );

    this.state.clear();
    UIUtils.createToast(
      "success",
      "Checkout berhasil! Mengalihkan ke invoice..."
    );
    setTimeout(() => {
      window.location.href = AppConfig.ROUTES.INVOICE;
    }, 2000);
  }
}

class CartController {
  constructor() {
    this.state = new CartState();
    this.renderer = null;
    this.checkoutManager = null;
    this.elements = {};
    this.isInitialized = false;
    this.unsubscribeState = null;
    this.outletList = [];
  }
  updateSummary() {
    const summaryEl = document.getElementById("cart-summary");
    if (summaryEl) {
      const itemCount = this.state.getItemCount();
      summaryEl.textContent = `${itemCount} item`;
    }
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // Check authentication
      if (!this.checkAuth()) return;

            const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
      if (user && user.role.toLowerCase() === 'admin') {
        await this.fetchOutletList();
      }

      this.bindElements();
      this.setupRenderer();
      this.setupCheckoutManager();
      this.setupStateSubscription();
      this.setupEventListeners();

      // Load data
      this.state.loadFromStorage();

      this.isInitialized = true;
      Logger.info("Cart controller initialized");
    } catch (error) {
      Logger.error("Cart initialization failed", error);
      UIUtils.createToast("error", "Gagal menginisialisasi halaman keranjang");
    }
  }

    async fetchOutletList() {
    try {
      const result = await APIClient.request("get_outlets");
      if (result.status === 'success' && Array.isArray(result.data)) {
        this.outletList = result.data;
        Logger.info("Outlet list loaded", { count: this.outletList.length });
      } else {
        throw new Error(result.message || 'Failed to fetch outlet list');
      }
    } catch (error) {
      Logger.error("Failed to fetch outlet list", error);
      UIUtils.createToast("error", "Gagal memuat daftar outlet.");
    }
  }

  checkAuth() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    if (!user || !user.email || !user.sessionToken) {
      // Hapus data keranjang yang mungkin usang atau milik sesi sebelumnya
      StorageUtils.removeItem(AppConfig.STORAGE_KEYS.CART);

      UIUtils.createToast(
        "error",
        "Anda harus login untuk mengakses keranjang.",
        5000
      );
      setTimeout(() => {
        window.location.href = AppConfig.ROUTES.LOGIN;
      }, 2000); // Diberi jeda 2 detik agar user sempat membaca pesan

      return false; // Mengembalikan false untuk menghentikan inisialisasi halaman
    }
    return true;
  }

  bindElements() {
    const requiredElements = {
      cartContent: "cart-content",
      loader: "loader",
    };

    Object.entries(requiredElements).forEach(([key, id]) => {
      this.elements[key] = document.getElementById(id);
      if (!this.elements[key]) {
        throw new Error(`Required element not found: ${id}`);
      }
    });
  }

  setupRenderer() {
    this.renderer = new CartRenderer(
      this.elements.cartContent.querySelector("#cart-items") || this.elements.cartContent,
      this.state,
      this.outletList
    );
  }

  setupCheckoutManager() {
    this.checkoutManager = new CheckoutManager(this.state);
  }

  setupStateSubscription() {
    this.unsubscribeState = this.state.subscribe((event, data) => {
      this.updateSummary();

      switch (event) {
        case "cart-loaded":
          this.hideLoader();
          this.renderer.render();
          break;
        case "item-updated":
          // Panggil fungsi yang lebih spesifik, bukan render() total
          if (data) {
            this.renderer.updateItemDisplay(data.itemId);
          }
          break;
        case "item-removed":
          if (data) {
            this.renderer.removeItemElement(data.itemId);
          }
          break;
        case "cart-cleared":
          this.renderer.render();
          break;
      }
    });
  }

  setupEventListeners() {
    // Use event delegation for checkout button
    this.elements.cartContent.addEventListener("click", (e) => {
      if (
        e.target.id === "checkoutButton" ||
        e.target.closest("#checkoutButton")
      ) {
        this.handleCheckout();
      }
    });

    // Delivery date change
    this.elements.cartContent.addEventListener("change", (e) => {
      if (e.target.id === "tanggalKirim") {
        this.state.setDeliveryDate(e.target.value);
      }
    });
  }

  async handleCheckout() {
    const deliveryDateInput = document.getElementById("tanggalKirim");
    const deliveryDate = deliveryDateInput ? deliveryDateInput.value : null;

    await this.checkoutManager.processCheckout(deliveryDate);
  }

  hideLoader() {
    this.elements.loader.classList.add("d-none");
    const cartItems = this.elements.cartContent.querySelector("#cart-items");
    if (cartItems) {
      cartItems.classList.remove("d-none");
    }
  }

  destroy() {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const cartController = new CartController();
  cartController.init().catch((error) => {
    Logger.error("Failed to initialize cart controller", error);
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (window.cartController) {
      window.cartController.destroy();
    }
  });

  // Store controller globally for debugging
  window.cartController = cartController;
});
