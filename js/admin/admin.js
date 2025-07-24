// File: js/admin/admin.js (Versi Final - Diperbaiki & Ditingkatkan)
document.addEventListener("DOMContentLoaded", () => {
  // 1. Auth Check & Setup
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user || user.role !== "admin") {
    showToast("error", "Akses ditolak! Hanya untuk admin.");
    setTimeout(() => (window.location.href = "index.html"), 2000);
    return;
  }

  // Global state
  let globalState = {
    piutang: [],
    hutang: [],
    inventaris: [],
    vendors: [],
    barangMasukList: [],
  };

  // DOM Elements
  const loader = document.getElementById("loader");
  const mainContent = document.getElementById("main-content");
  const adminGreeting = document.getElementById("admin-greeting");
  const simpanSemuaBtn = document.getElementById("simpanSemuaBtn");
  const formBarangMasuk = document.getElementById("formBarangMasuk");
  const vendorSelect = document.getElementById("vendorSelect");
  const uploadModal = new bootstrap.Modal(
    document.getElementById("uploadModal")
  );
  const uploadForm = document.getElementById("uploadForm");

  adminGreeting.textContent = user.nama_user || "Admin";

  // 2. RENDER FUNCTIONS
  const renderSummaryCards = (data) => {
    document.getElementById("summary-cards").innerHTML = `
      <div class="col-md-6 col-lg-3"><div class="card glass-card h-100"><div class="card-body"><h6 class="card-subtitle mb-2 text-muted">Total Produk</h6><h4 class="card-title fw-bold">${
        data.totalProduk
      }</h4></div></div></div>
      <div class="col-md-6 col-lg-3"><div class="card glass-card h-100"><div class="card-body"><h6 class="card-subtitle mb-2 text-muted">Produk Habis</h6><h4 class="card-title fw-bold text-danger">${
        data.produkHabis
      }</h4></div></div></div>
      <div class="col-md-6 col-lg-3"><div class="card glass-card h-100"><div class="card-body"><h6 class="card-subtitle mb-2 text-muted">Piutang Outlet</h6><h4 class="card-title fw-bold text-warning">${formatRupiah(
        data.totalPiutang
      )}</h4></div></div></div>
      <div class="col-md-6 col-lg-3"><div class="card glass-card h-100"><div class="card-body"><h6 class="card-subtitle mb-2 text-muted">Hutang Vendor</h6><h4 class="card-title fw-bold">${formatRupiah(
        data.totalHutang
      )}</h4></div></div></div>
    `;
  };

  // PATCH: FUNGSI RENDER BARU UNTUK DETAIL DASHBOARD
  const renderDashboardDetails = (
    produkHabis,
    hutangJatuhTempo,
    piutangJatuhTempo
  ) => {
    const produkBody = document.getElementById("dashboard-produk-habis-body");
    const hutangBody = document.getElementById("dashboard-hutang-vendor-body");
    const piutangBody = document.getElementById(
      "dashboard-piutang-outlet-body"
    );
    const noDataRow = `<tr><td colspan="3" class="text-center text-muted fst-italic">Tidak ada data.</td></tr>`;

    produkBody.innerHTML =
      produkHabis.length > 0
        ? produkHabis
            .map((p) => `<tr><td>${p.id}</td><td>${p.nama}</td></tr>`)
            .join("")
        : `<tr><td colspan="2" class="text-center text-muted fst-italic">Aman!</td></tr>`;
    hutangBody.innerHTML =
      hutangJatuhTempo.length > 0
        ? hutangJatuhTempo
            .map(
              (h) =>
                `<tr><td>${new Date(h.timestamp).toLocaleDateString(
                  "id-ID"
                )}</td><td>${
                  h.nama_vendor
                }</td><td class="text-end">${formatRupiah(
                  h.total_tagihan
                )}</td></tr>`
            )
            .join("")
        : noDataRow;
    piutangBody.innerHTML =
      piutangJatuhTempo.length > 0
        ? piutangJatuhTempo
            .map(
              (p) =>
                `<tr><td>${new Date(p.timestamp).toLocaleDateString(
                  "id-ID"
                )}</td><td>${
                  p.nama_outlet
                }</td><td class="text-end">${formatRupiah(
                  p.total_tagihan
                )}</td></tr>`
            )
            .join("")
        : noDataRow;
  };

  const renderTable = (tbodyId, data, rowGenerator) => {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML =
      data && data.length > 0
        ? data.map(rowGenerator).join("")
        : `<tr><td colspan="10" class="text-center text-muted">Tidak ada data.</td></tr>`;
  };

  const renderAllTables = () => {
    renderTable(
      "piutang-table-body",
      globalState.piutang,
      (p) =>
        `<tr><td>${p.id_invoice}</td><td>${new Date(
          p.timestamp
        ).toLocaleDateString("id-ID")}</td><td>${
          p.nama_outlet
        }</td><td>${formatRupiah(p.total_tagihan)}</td><td><span class="badge ${
          (p.status || "").toLowerCase() === "lunas"
            ? "bg-success"
            : "bg-warning"
        }">${p.status || "Belum Lunas"}</span></td><td>${
          p.bukti_transfer
            ? `<a href="${p.bukti_transfer}" target="_blank">Lihat</a>`
            : `<button class="btn btn-sm btn-outline-secondary" onclick="window.showUploadModal('${p.id_invoice}', 'piutang')">Upload</button>`
        }</td><td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${
          (p.status || "").toLowerCase() === "lunas" ? "checked" : ""
        } onchange="window.updateStatus('piutang', '${
          p.id_invoice
        }', this.checked)"></div></td></tr>`
    );
    renderTable(
      "hutang-table-body",
      globalState.hutang,
      (h) =>
        `<tr><td>${h.no_nota_vendor}</td><td>${new Date(
          h.timestamp
        ).toLocaleDateString("id-ID")}</td><td>${
          h.nama_vendor
        }</td><td>${formatRupiah(h.total_tagihan)}</td><td><span class="badge ${
          (h.status || "").toLowerCase() === "lunas"
            ? "bg-success"
            : "bg-warning"
        }">${h.status || "Belum Lunas"}</span></td><td>${
          h.bukti_transfer
            ? `<a href="${h.bukti_transfer}" target="_blank">Lihat</a>`
            : `<button class="btn btn-sm btn-outline-secondary" onclick="window.showUploadModal('${h.no_nota_vendor}', 'hutang')">Upload</button>`
        }</td><td><div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${
          (h.status || "").toLowerCase() === "lunas" ? "checked" : ""
        } onchange="window.updateStatus('hutang', '${
          h.no_nota_vendor
        }', this.checked)"></div></td></tr>`
    );
    renderTable(
      "inventaris-table-body",
      globalState.inventaris,
      (i) =>
        `<tr><td>${i.id}</td><td>${i.nama}</td><td>${i.unit}</td><td><input type="number" class="form-control form-control-sm" value="${i.stok_awal}" style="width: 80px;"></td><td class="fw-bold">${i.stok_akhir}</td><td><button class="btn btn-sm btn-primary" onclick="window.updateStokAwal('${i.id}', this)">Simpan</button></td></tr>`
    );
  };

  const renderBarangMasukPreview = () =>
    renderTable(
      "tabelBarangMasukPreview",
      globalState.barangMasukList,
      (item, idx) =>
        `<tr><td>${item.nama_barang}</td><td>${item.qty}</td><td>${formatRupiah(
          item.harga
        )}</td><td class="fw-bold">${formatRupiah(
          item.qty * item.harga
        )}</td><td><button class="btn btn-sm btn-outline-danger" onclick="window.removeBarangMasuk(${idx})"><i class="bi bi-trash"></i></button></td></tr>`
    );

  // 3. MAIN DATA & LOGIC FUNCTIONS
  async function refreshDashboardData() {
    try {
      const [hutangRes, piutangRes, invRes, vendorsRes] = await Promise.all([
        fetchAPI("hutang"),
        fetchAPI("piutang"),
        fetchAPI("inventory"),
        fetchAPI("vendors"),
      ]);

      globalState.hutang = hutangRes.data || [];
      globalState.piutang = piutangRes.data || [];
      globalState.inventaris = invRes.data || [];
      globalState.vendors = vendorsRes.data || [];

      // Data untuk Summary Cards (Lama)
      const summaryData = {
        totalProduk: globalState.inventaris.length,
        produkHabis: globalState.inventaris.filter(
          (p) => Number(p.stok_akhir) <= 0
        ).length,
        totalPiutang: globalState.piutang
          .filter((p) => (p.status || "").toLowerCase() !== "lunas")
          .reduce((sum, p) => sum + p.total_tagihan, 0),
        totalHutang: globalState.hutang
          .filter((h) => (h.status || "").toLowerCase() !== "lunas")
          .reduce((sum, h) => sum + h.total_tagihan, 0),
      };

      // PATCH: DATA BARU UNTUK DETAIL DASHBOARD
      const produkHabis = globalState.inventaris.filter(
        (p) => Number(p.stok_akhir) <= 0
      );
      const hutangJatuhTempo = globalState.hutang
        .filter((h) => (h.status || "").toLowerCase() !== "lunas")
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const piutangJatuhTempo = globalState.piutang
        .filter((p) => (p.status || "").toLowerCase() !== "lunas")
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Render semua bagian dashboard
      renderSummaryCards(summaryData);
      renderDashboardDetails(produkHabis, hutangJatuhTempo, piutangJatuhTempo); // Render tabel baru
      renderAllTables(); // Render tabel di tab lain

      return true;
    } catch (error) {
      showToast("error", "Gagal memperbarui data dashboard.");
      console.error("Dashboard refresh failed:", error);
      return false;
    }
  }

  async function initializeDashboard() {
    const success = await refreshDashboardData();
    if (success) {
      vendorSelect.innerHTML =
        '<option value="" selected disabled>Pilih Vendor...</option>';
      (globalState.vendors || []).forEach((vendor) => {
        if (vendor && vendor.nama_vendor) {
          const option = document.createElement("option");
          option.value = vendor.nama_vendor;
          option.textContent = vendor.nama_vendor;
          vendorSelect.appendChild(option);
        }
      });

      loader.classList.add("d-none");
      mainContent.classList.remove("d-none");

      setTimeout(() => {
        const finalLoader = document.getElementById("loader");
        if (finalLoader) {
          finalLoader.classList.add("d-none");
        }
      }, 500);
    } else {
      loader.innerHTML = `<p class="text-danger">Gagal memuat dashboard. Periksa console (F12) untuk detail error.</p>`;
    }
  }

  // 4. EVENT HANDLERS (Tidak ada perubahan signifikan di sini)
  formBarangMasuk.addEventListener("submit", (e) => {
    e.preventDefault();
    const vendorSelectEl = document.getElementById("vendorSelect");
    const notaVendorEl = document.getElementById("notaVendor");
    if (!vendorSelectEl.value) {
      showToast("error", "Silakan pilih vendor terlebih dahulu.");
      return;
    }
    globalState.barangMasukList.push({
      nama_vendor: vendorSelectEl.value,
      no_nota_vendor: notaVendorEl.value,
      nama_barang: document.getElementById("namaBarang").value,
      qty: parseInt(document.getElementById("qtyBarang").value),
      harga: parseInt(document.getElementById("hargaBeli").value),
    });
    vendorSelectEl.disabled = true;
    notaVendorEl.disabled = true;
    simpanSemuaBtn.disabled = false;
    renderBarangMasukPreview();
    document.getElementById("namaBarang").value = "";
    document.getElementById("qtyBarang").value = "";
    document.getElementById("hargaBeli").value = "";
    document.getElementById("namaBarang").focus();
  });

  simpanSemuaBtn.addEventListener("click", async () => {
    if (globalState.barangMasukList.length === 0) return;
    simpanSemuaBtn.disabled = true;
    simpanSemuaBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Menyimpan...`;
    try {
      await fetchAPI("barang_masuk", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          path: "barang_masuk",
          items: globalState.barangMasukList,
        }),
      });
      showToast("success", "Data barang masuk berhasil disimpan!");
      globalState.barangMasukList = [];
      renderBarangMasukPreview();
      document.getElementById("vendorSelect").disabled = false;
      document.getElementById("notaVendor").disabled = false;
      document.getElementById("vendorSelect").value = "";
      document.getElementById("notaVendor").value = "";
      await refreshDashboardData();
    } finally {
      simpanSemuaBtn.disabled = false;
      simpanSemuaBtn.innerHTML = `<i class="bi bi-save me-2"></i> Simpan Semua ke Gudang`;
    }
  });

  document
    .getElementById("generatePaymentRequestBtn")
    .addEventListener("click", async () => {
      const startDate = document.getElementById("startDateHutang").value;
      const endDate = document.getElementById("endDateHutang").value;
      const saldoAwalInput = document.getElementById("saldoAwal").value;

      if (!startDate || !endDate || !saldoAwalInput) {
        showToast(
          "error",
          "Harap isi semua field (Tanggal Mulai, Tanggal Akhir, Saldo Awal)."
        );
        return;
      }

      const saldoAwal = parseFloat(saldoAwalInput);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      const filteredHutang = globalState.hutang.filter((h) => {
        const tgl = new Date(h.timestamp);
        return (
          tgl >= startDateObj &&
          tgl <= endDateObj &&
          h.status.toLowerCase() !== "lunas"
        );
      });

      const filteredPiutang = globalState.piutang.filter((p) => {
        const tgl = new Date(p.timestamp);
        return (
          tgl >= startDateObj &&
          tgl <= endDateObj &&
          p.status.toLowerCase() === "lunas"
        );
      });

      const totalPengajuan = filteredHutang.reduce(
        (sum, h) => sum + h.total_tagihan,
        0
      );
      const totalTagihanOutlet = filteredPiutang.reduce(
        (sum, p) => sum + p.total_tagihan,
        0
      );
      const sisaSaldo = saldoAwal + totalTagihanOutlet - totalPengajuan;

      const tableBody = filteredHutang.map((h) => {
        const vendorInfo =
          globalState.vendors.find((v) => v.nama_vendor === h.nama_vendor) ||
          {};
        return [
          h.nama_vendor,
          new Date(h.timestamp).toLocaleDateString("id-ID"),
          formatRupiah(h.total_tagihan),
          vendorInfo.bank || "-",
          vendorInfo.no_rekening || "-",
          vendorInfo.atas_nama || "-",
        ];
      });

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(
        "PENGAJUAN PEMBAYARAN HUTANG GUDANG",
        doc.internal.pageSize.getWidth() / 2,
        20,
        { align: "center" }
      );
      doc.setFontSize(12);
      doc.text(
        `PERIODE: ${new Date(startDate).toLocaleDateString(
          "id-ID"
        )} - ${new Date(endDate).toLocaleDateString("id-ID")}`,
        doc.internal.pageSize.getWidth() / 2,
        28,
        { align: "center" }
      );

      doc.autoTable({
        startY: 40,
        head: [
          [
            "Nama Supplier",
            "Tanggal",
            "Jumlah",
            "Bank",
            "No. Rekening",
            "Atas Nama",
          ],
        ],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [67, 97, 238] },
      });

      let finalY = doc.previousAutoTable.finalY + 15;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Ringkasan Keuangan:", 14, finalY);

      doc.setFont("helvetica", "normal");
      finalY += 7;
      doc.text(`Total Pemasukan dari Outlet (Lunas):`, 14, finalY);
      doc.text(formatRupiah(totalTagihanOutlet), 195, finalY, {
        align: "right",
      });

      finalY += 7;
      doc.text(`Saldo Awal Kas:`, 14, finalY);
      doc.text(formatRupiah(saldoAwal), 195, finalY, { align: "right" });

      finalY += 7;
      doc.text(`Total Pengajuan Pembayaran Hutang:`, 14, finalY);
      doc.text(formatRupiah(totalPengajuan), 195, finalY, { align: "right" });

      finalY += 7;
      doc.setFont("helvetica", "bold");
      doc.text(`Sisa Saldo Akhir:`, 14, finalY);
      doc.text(formatRupiah(sisaSaldo), 195, finalY, { align: "right" });

      doc.save(`Pengajuan_Pembayaran_${startDate}_${endDate}.pdf`);
    });

  uploadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = document.getElementById("fileInput").files[0],
      id = document.getElementById("uploadId").value,
      type = document.getElementById("uploadType").value;
    if (!file) return;
    const fr = new FileReader();
    fr.readAsDataURL(file);
    fr.onload = async () => {
      const fileData = {
        mimeType: file.type,
        fileName: file.name,
        data: fr.result.split(",")[1],
      };
      try {
        uploadModal.hide();
        showToast("info", "Mengupload file...");
        await fetchAPI("upload_bukti", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ path: "upload_bukti", id, type, fileData }),
        });
        showToast("success", "Upload berhasil!");
        await refreshDashboardData();
      } catch (error) {
        showToast("error", "Upload gagal: " + error.message);
      }
    };
  });

  // 5. WINDOW-LEVEL FUNCTIONS (Tidak ada perubahan signifikan di sini)
  window.removeBarangMasuk = (index) => {
    globalState.barangMasukList.splice(index, 1);
    renderBarangMasukPreview();
    if (globalState.barangMasukList.length === 0) {
      simpanSemuaBtn.disabled = true;
      document.getElementById("vendorSelect").disabled = false;
      document.getElementById("notaVendor").disabled = false;
    }
  };

  window.updateStatus = async (type, id, isLunas) => {
    const status = isLunas ? "Lunas" : "Belum Lunas";
    try {
      await fetchAPI("update_status", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ path: "update_status", type, id, status }),
      });
      showToast("success", `Status untuk ${id} diperbarui menjadi ${status}`);
      await refreshDashboardData();
    } catch (error) {
      showToast("error", "Gagal memperbarui status.");
    }
  };

  window.updateStokAwal = async (id, element) => {
    const input = element.closest("tr").querySelector('input[type="number"]');
    const newStok = parseInt(input.value);
    element.disabled = true;
    element.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    try {
      await fetchAPI("update_stok_awal", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          path: "update_stok_awal",
          id,
          stok_awal: newStok,
        }),
      });
      showToast("success", `Stok awal untuk ${id} diperbarui!`);
      await refreshDashboardData();
    } catch (error) {
      showToast("error", "Gagal memperbarui stok.");
    } finally {
      element.disabled = false;
      element.innerText = "Simpan";
    }
  };

  window.showUploadModal = (id, type) => {
    document.getElementById("uploadId").value = id;
    document.getElementById("uploadType").value = type;
    document.getElementById(
      "uploadModalTitle"
    ).innerText = `Upload Bukti untuk ${id}`;
    uploadForm.reset();
    uploadModal.show();
  };

  // 6. Initial Load
  initializeDashboard();
});

function logout() {
  localStorage.clear();
  showToast("info", "Anda telah logout.");
  setTimeout(() => (window.location.href = "index.html"), 1500);
}
