// File: js/admin/ui.js

/**
 * Merender kartu ringkasan di dashboard.
 * @param {object} data - Objek berisi data untuk kartu.
 * Contoh: { totalProduk: 10, produkHabis: 2, piutang: 'Rp 500.000', hutang: 'Rp 200.000' }
 */
function renderSummaryCards(data) {
  const container = document.getElementById("summary-cards");
  if (!container) return;

  container.innerHTML = `
        <div class="col-md-6 col-lg-3 mb-4">
            <div class="card glass-card h-100">
                <div class="card-body">
                    <h6 class="card-subtitle mb-2 text-muted">Total Produk</h6>
                    <h4 class="card-title fw-bold">${data.totalProduk}</h4>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-3 mb-4">
            <div class="card glass-card h-100">
                <div class="card-body">
                    <h6 class="card-subtitle mb-2 text-muted">Produk Habis</h6>
                    <h4 class="card-title fw-bold text-danger">${data.produkHabis}</h4>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-3 mb-4">
            <div class="card glass-card h-100">
                <div class="card-body">
                    <h6 class="card-subtitle mb-2 text-muted">Piutang Outlet</h6>
                    <h4 class="card-title fw-bold text-warning">${data.piutang}</h4>
                </div>
            </div>
        </div>
        <div class="col-md-6 col-lg-3 mb-4">
            <div class="card glass-card h-100">
                <div class="card-body">
                    <h6 class="card-subtitle mb-2 text-muted">Hutang Vendor</h6>
                    <h4 class="card-title fw-bold">${data.hutang}</h4>
                </div>
            </div>
        </div>
    `;
}

/**
 * Merender tabel preview untuk barang yang akan dimasukkan.
 * @param {Array<object>} barangMasukList - Array dari item barang masuk.
 */
function renderBarangMasukPreview(barangMasukList) {
  const tbody = document.getElementById("tabelBarangMasukPreview");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (barangMasukList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Belum ada barang untuk ditambahkan.</td></tr>`;
    return;
  }

  barangMasukList.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${item.nama_barang}</td>
            <td>${item.qty}</td>
            <td>${formatRupiah(item.harga)}</td>
            <td class="fw-bold">${formatRupiah(item.qty * item.harga)}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="window.removeBarangMasuk(${idx})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
    tbody.appendChild(tr);
  });
}
