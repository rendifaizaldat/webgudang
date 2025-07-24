// File: js/keranjang.js
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || !user.email) {
    showToast("error", "Sesi tidak valid. Silakan login kembali.");
    setTimeout(() => (window.location.href = "index.html"), 2000);
    return;
  }

  const cartContentEl = document.getElementById("cart-content");
  const loaderEl = document.getElementById("loader");

  const getCart = () => JSON.parse(localStorage.getItem("keranjang")) || [];
  const saveCart = (cart) =>
    localStorage.setItem("keranjang", JSON.stringify(cart));

  function renderCart() {
    loaderEl.classList.add("d-none");
    cartContentEl.querySelector("#cart-items").classList.remove("d-none");

    const keranjang = getCart();

    if (keranjang.length === 0) {
      cartContentEl.innerHTML = `
        <div class="text-center p-5 card glass-card animate__animated animate__fadeIn">
          <i class="bi bi-cart-x" style="font-size: 5rem; color: var(--secondary);"></i>
          <h3 class="mt-3">Keranjang Anda kosong</h3>
          <p class="text-muted">Sepertinya Anda belum menambahkan produk apapun.</p>
          <a href="katalog.html" class="btn btn-primary mt-2 mx-auto" style="max-width: 200px;">
            <i class="bi bi-shop"></i> Mulai Belanja
          </a>
        </div>`;
      return;
    }

    let totalBelanja = 0;
    const cartItemsHTML = keranjang.map((item, index) => {
        const subtotal = item.harga * item.qty;
        totalBelanja += subtotal;
        return `
          <div class="cart-item">
              <div class="row">
                  <div class="col-12 col-md-5 d-flex align-items-center mb-3 mb-md-0">
                      <img src="${item.foto || "https://via.placeholder.com/60"}" alt="${item.nama}" class="img-fluid rounded me-3" style="width: 60px; height: 60px; object-fit: cover;">
                      <div>
                          <strong class="d-block">${item.nama}</strong>
                          <small class="text-muted d-block d-md-none">${formatRupiah(item.harga)}</small>
                          <small class="text-muted">Sisa Stok: ${item.stok_akhir}</small>
                      </div>
                  </div>
                  <div class="col-md-2 d-none d-md-flex align-items-center">
                      ${formatRupiah(item.harga)}
                  </div>
                  <div class="col-8 col-md-3 d-flex align-items-center">
                      <div class="quantity-control modern-qty">
                          <button class="btn btn-light" onclick="window.updateQty(${index}, -1)">-</button>
                          <input type="number" class="form-control text-center" value="${item.qty}" min="1" max="${item.stok_akhir}" onchange="window.updateQty(${index}, 0, this.value)">
                          <button class="btn btn-light" onclick="window.updateQty(${index}, 1)">+</button>
                      </div>
                  </div>
                  <div class="col-4 col-md-2 d-flex align-items-center justify-content-end">
                      <div class="text-end">
                        <strong class="d-block">${formatRupiah(subtotal)}</strong>
                        <button class="btn btn-link text-danger p-0 mt-1 d-block d-md-none" onclick="window.removeItem(${index})">Hapus</button>
                      </div>
                      <button class="btn btn-danger btn-sm d-none d-md-inline-block ms-3" onclick="window.removeItem(${index})"><i class="bi bi-trash"></i></button>
                  </div>
              </div>
          </div>
        `;
      }).join("");

    cartContentEl.querySelector("#cart-items").innerHTML = `
      <div class="card glass-card p-3">
          <div class="d-none d-md-flex row fw-bold mb-2 border-bottom pb-2">
              <div class="col-md-5">Produk</div>
              <div class="col-md-2">Harga</div>
              <div class="col-md-3">Kuantitas</div>
              <div class="col-md-2 text-end">Subtotal</div>
          </div>
          ${cartItemsHTML}
          <div class="d-flex justify-content-end align-items-center mt-3 pt-3 border-top">
              <span class="fs-5 me-3">Total Belanja:</span>
              <span class="fs-4 fw-bold text-primary">${formatRupiah(totalBelanja)}</span>
          </div>
      </div>
      <div class="card glass-card p-3 mt-4">
          <div class="row align-items-center">
              <div class="col-md-4">
                  <label for="tanggalKirim" class="form-label fw-bold">Pilih Tanggal Pengiriman:</label>
              </div>
              <div class="col-md-8">
                  <input type="date" class="form-control" id="tanggalKirim" min="${new Date().toISOString().split('T')[0]}">
              </div>
          </div>
      </div>
      <div class="d-flex justify-content-end mt-4">
          <button id="checkoutButton" class="btn btn-primary btn-lg">
              <i class="bi bi-check-circle"></i> Checkout Sekarang
          </button>
      </div>`;

    document
      .getElementById("checkoutButton")
      .addEventListener("click", processCheckout);
  }

  window.removeItem = (index) => {
    let keranjang = getCart();
    const removedItem = keranjang.splice(index, 1);
    saveCart(keranjang);
    renderCart();
    showToast(
      "info",
      `<strong>${removedItem[0].nama}</strong> dihapus dari keranjang.`
    );
  };

  window.updateQty = (index, change, value) => {
    let keranjang = getCart();
    const item = keranjang[index];
    let newQty = value ? parseInt(value) : item.qty + change;

    if (newQty < 1) {
        removeItem(index);
        return;
    }
    if (newQty > item.stok_akhir) {
      newQty = item.stok_akhir;
      showToast("warning", `Stok ${item.nama} hanya tersisa ${item.stok_akhir}.`);
    }
    keranjang[index].qty = newQty;
    saveCart(keranjang);
    renderCart();
  };

  async function processCheckout() {
    const keranjang = getCart();
    if (keranjang.length === 0) {
      showToast("error", "Keranjang belanja kosong!");
      return;
    }

    const tanggalKirim = document.getElementById("tanggalKirim").value;
    if (!tanggalKirim) {
      showToast("error", "Silakan pilih tanggal pengiriman terlebih dahulu.");
      return;
    }

    const checkoutButton = document.getElementById("checkoutButton");
    checkoutButton.disabled = true;
    checkoutButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Memproses...`;

    const payload = {
      path: "checkout", // INI PERBAIKANNYA: Menambahkan path ke payload
      user: user,
      deliveryDate: tanggalKirim,
      items: keranjang.map((item) => ({
        id: item.id,
        nama: item.nama,
        qty: item.qty,
        harga: item.harga,
        unit: item.unit,
      })),
    };

    try {
      const result = await fetchAPI("checkout", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      if (result.status === "success") {
        localStorage.setItem("lastTransaction", JSON.stringify(keranjang));
        localStorage.setItem("lastTransactionDate", tanggalKirim);
        localStorage.removeItem("keranjang");
        showToast("success", "Checkout berhasil! Mengalihkan...");
        setTimeout(() => (window.location.href = "invoice.html"), 2000);
      } else {
        throw new Error(result.message || 'Checkout Gagal');
      }
    } catch (error) {
      showToast('error', `Terjadi kesalahan: ${error.message}`);
    } finally {
      checkoutButton.disabled = false;
      checkoutButton.innerHTML = `<i class="bi bi-check-circle"></i> Checkout Sekarang`;
    }
  }

  renderCart();
});