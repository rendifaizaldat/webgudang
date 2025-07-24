// File: js/katalog.js
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.email) {
    showToast("error", "Sesi tidak valid. Silakan login kembali.");
    setTimeout(() => (window.location.href = "index.html"), 2000);
    return;
  }

  const productListEl = document.getElementById("product-list");
  const loaderEl = document.getElementById("loader");
  const searchInput = document.getElementById("searchInput");
  const sortButtons = document.querySelectorAll(".sort-btn");
  const cartBadge = document.getElementById("cart-badge");

  let allProducts = [];
  let currentSort = { field: "nama", order: "asc" };

  function renderProducts(productsToRender) {
    loaderEl.style.display = "none";
    document.getElementById("filter-section").classList.remove("d-none");
    productListEl.innerHTML = "";

    if (productsToRender.length === 0) {
      productListEl.innerHTML = `<div class="col-12 text-center py-5 card glass-card"><i class="bi bi-search fs-1"></i><h4 class="mt-3">Produk tidak ditemukan</h4><p class="text-muted">Coba ubah kata kunci pencarian Anda.</p></div>`;
      return;
    }

    const keranjang = JSON.parse(localStorage.getItem("keranjang")) || [];

    productsToRender.forEach((product, index) => {
      const itemInCart = keranjang.find((item) => item.id === product.id);
      const currentQty = itemInCart ? itemInCart.qty : 0;
      const isHabis = product.stok_akhir <= 0;

      const card = document.createElement("div");
      card.className = "col";
      // PATCH: Struktur HTML dirombak total untuk mobile dan tombol kuantitas baru
      card.innerHTML = `
      <div class="card product-card h-100 ${
        isHabis ? "disabled-card" : ""
      }" data-product-id="${product.id}">

        <div class="card-header product-header-desktop">
          <h5 class="product-name" title="${product.nama}">${product.nama}</h5>
        </div>

        <div class="product-info-mobile">
          <h5 class="product-name-mobile">${product.nama}</h5>
        </div>

        <div class="card-image-container">
          <img src="${
            product.foto || "https://via.placeholder.com/300?text=Gambar"
          }" 
            class="product-image" 
            alt="${product.nama}" 
            onerror="this.src='https://via.placeholder.com/300?text=Error'">
      
          ${
            isHabis
              ? '<div class="sold-out-overlay"><span>Habis</span></div>'
              : ""
          }

          <div class="desktop-overlay">
            <span class="product-stock fw-bold small mt-1"><i class="bi bi-box-seam"></i> Sisa: ${
              product.stok_akhir
            }</span>
            <div class="d-flex justify-content-between align-items-center">
            <span class="product-unit small">${product.unit || "pcs"}</span>
            <span class="product-price fw-bold">${formatRupiah(
              product.harga
            )}</span>              
            </div>
          </div>

          <div class="mobile-badges">
            <span class="stock-badge-mobile"><i class="bi bi-box-seam"></i> ${
              product.stok_akhir
            }</span>
            <span class="unit-badge-mobile">${product.unit || "pcs"}</span>
          </div>
        </div>

        <div class="product-price-mobile">
            <span>${formatRupiah(product.harga)}</span>
        </div>

        <div class="card-footer">
          <div class="quantity-control">
            <button class="btn-qty" 
                    data-action="decrease" 
                    ${currentQty <= 0 || isHabis ? "disabled" : ""}>
              <i class="bi bi-dash"></i>
            </button>
            
            <span class="qty-display">${currentQty}</span>
            <input type="number" 
                  class="quantity-input" 
                  value="${currentQty}" 
                  style="display: none;" readonly>

            <button class="btn-qty" 
                    data-action="increase" 
                    ${
                      currentQty >= product.stok_akhir || isHabis
                        ? "disabled"
                        : ""
                    }>
              <i class="bi bi-plus"></i>
            </button>
          </div>
        </div>
    </div>`;
      card.classList.add("product-appear");
      card.style.animationDelay = `${index * 0.05}s`;
      productListEl.appendChild(card);
    });
  }

  function updateCartBadge() {
    const keranjang = JSON.parse(localStorage.getItem("keranjang")) || [];
    const totalItems = keranjang.reduce((sum, item) => sum + item.qty, 0);
    if (totalItems > 0) {
      cartBadge.textContent = totalItems;
      cartBadge.style.display = "block";
    } else {
      cartBadge.style.display = "none";
    }
  }

  function updateCart(productId, newQty) {
    let keranjang = JSON.parse(localStorage.getItem("keranjang")) || [];
    const product = allProducts.find((p) => p.id === productId);
    if (!product) return;

    if (newQty > product.stok_akhir) {
      newQty = product.stok_akhir;
      showToast(
        "warning",
        `Stok ${product.nama} hanya tersisa ${product.stok_akhir}.`
      );
    }

    const existingProductIndex = keranjang.findIndex(
      (item) => item.id === productId
    );

    if (existingProductIndex > -1) {
      if (newQty > 0) {
        keranjang[existingProductIndex].qty = newQty;
      } else {
        keranjang.splice(existingProductIndex, 1);
      }
    } else if (newQty > 0) {
      keranjang.push({ ...product, qty: newQty });
    }

    localStorage.setItem("keranjang", JSON.stringify(keranjang));
    updateCartBadge();
    // Panggil fungsi update UI setelah mengubah keranjang
    updateProductCardUI(productId, newQty);
  }

  // PATCH: Fungsi diubah untuk memperbarui UI kartu secara spesifik
  function updateProductCardUI(productId, newQty) {
    const product = allProducts.find((p) => p.id === productId);
    const card = document.querySelector(
      `.product-card[data-product-id="${productId}"]`
    );
    if (!card || !product) return;

    // Jika newQty tidak disediakan, ambil dari local storage
    const keranjang = JSON.parse(localStorage.getItem("keranjang")) || [];
    const itemInCart = keranjang.find((item) => item.id === productId);
    const currentQty =
      newQty !== undefined ? newQty : itemInCart ? itemInCart.qty : 0;

    const qtyDisplay = card.querySelector(".qty-display");
    const input = card.querySelector(".quantity-input");
    const decreaseBtn = card.querySelector('[data-action="decrease"]');
    const increaseBtn = card.querySelector('[data-action="increase"]');
    const isHabis = product.stok_akhir <= 0;

    if (qtyDisplay) qtyDisplay.textContent = currentQty;
    if (input) input.value = currentQty;

    if (decreaseBtn) decreaseBtn.disabled = currentQty <= 0 || isHabis;
    if (increaseBtn)
      increaseBtn.disabled = currentQty >= product.stok_akhir || isHabis;
  }

  function applyFiltersAndSort() {
    let filtered = [...allProducts];
    const searchTerm = searchInput.value.toLowerCase();

    if (searchTerm) {
      filtered = allProducts.filter((p) =>
        p.nama.toLowerCase().includes(searchTerm)
      );
    }

    const availableProducts = filtered.filter((p) => p.stok_akhir > 0);
    const outOfStockProducts = filtered.filter((p) => p.stok_akhir <= 0);

    availableProducts.sort((a, b) => {
      let valA = a[currentSort.field];
      let valB = b[currentSort.field];
      if (typeof valA === "string") {
        return currentSort.order === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return currentSort.order === "asc" ? valA - valB : valB - valA;
    });

    const sortedProducts = [...availableProducts, ...outOfStockProducts];
    renderProducts(sortedProducts);
  }

  searchInput.addEventListener("input", applyFiltersAndSort);

  sortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.sort;
      const currentActive = document.querySelector(".sort-btn.active");
      if (currentActive) {
        currentActive.classList.remove("active");
      }
      btn.classList.add("active");
      if (currentSort.field === field) {
        currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
      } else {
        currentSort.order = "asc";
      }
      currentSort.field = field;
      applyFiltersAndSort();
    });
  });

  productListEl.addEventListener("click", (e) => {
    const button = e.target.closest("[data-action]");
    if (button) {
      const card = button.closest(".product-card");
      const productId = card.dataset.productId;
      const input = card.querySelector(".quantity-input");
      let currentQty = parseInt(input.value);

      const action = button.dataset.action;
      if (action === "increase") currentQty++;
      else if (action === "decrease") currentQty--;

      updateCart(productId, currentQty);
    }
  });

  async function init() {
    try {
      const result = await fetchAPI("katalog");
      allProducts = result.data;
      applyFiltersAndSort();
      updateCartBadge();
    } catch (error) {
      loaderEl.style.display = "none";
      productListEl.innerHTML = `<div class="col-12 text-center py-5 card glass-card"><i class="bi bi-wifi-off fs-1 text-danger"></i><h4 class="mt-3">Gagal Memuat Produk</h4><p class="text-muted">Periksa koneksi internet Anda dan coba lagi.</p></div>`;
    }
  }

  init();
});
