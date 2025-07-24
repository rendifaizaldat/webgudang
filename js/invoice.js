document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const lastTransaction = JSON.parse(localStorage.getItem("lastTransaction"));
  const transactionDate = localStorage.getItem("lastTransactionDate");

  const invoiceWrapper = document.getElementById("invoice-wrapper");
  if (!user || !lastTransaction || lastTransaction.length === 0) {
    invoiceWrapper.innerHTML = `
      <div class="text-center p-5 card glass-card">
        <i class="bi bi-file-earmark-x" style="font-size: 5rem; color: var(--secondary);"></i>
        <h3 class="mt-3">Data Invoice Tidak Ditemukan</h3>
        <p class="text-muted">Sepertinya tidak ada data transaksi terakhir. Silakan lakukan pemesanan terlebih dahulu.</p>
        <a href="katalog.html" class="btn btn-primary mt-2 mx-auto" style="max-width: 200px;">
          <i class="bi bi-arrow-left"></i> Kembali ke Katalog
        </a>
      </div>`;
    return;
  }

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const displayDate = transactionDate
    ? new Date(transactionDate).toLocaleString("id-ID", { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString("id-ID", { day: '2-digit', month: 'short', year: 'numeric' });

  const now = new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  document.getElementById('invoiceTimestamp').textContent = `${now} | ${invoiceNumber}`;
  
  document.getElementById("infoOutlet").innerHTML = `
    <p class="mb-1"><strong>Outlet:</strong> ${user.outlet || "-"}</p>
    <p class="mb-0"><strong>Tgl. Tagihan:</strong> ${displayDate}</p>
  `;

  const tbody = document.getElementById("invoiceBody");
  let grandTotal = 0;
  lastTransaction.forEach((item) => {
    const total = item.harga * item.qty;
    grandTotal += total;
    tbody.innerHTML += `
      <tr>
        <td>
          <div class="fw-bold">${item.nama}</div>
          <small class="text-muted">${item.qty} x ${formatRupiah(item.harga)}</small>
        </td>
        <td class="text-center align-middle">${item.qty}</td>
        <td class="text-end align-middle fw-bold">${formatRupiah(total)}</td>
      </tr>`;
  });
  document.getElementById("totalHarga").textContent = formatRupiah(grandTotal);

  document.getElementById("downloadJpgBtn").addEventListener("click", () => {
    const invoiceEl = document.getElementById("invoice-container");
    html2canvas(invoiceEl, { scale: 2 }).then((canvas) => {
      const link = document.createElement("a");
      link.download = `invoice_${user.outlet}_${invoiceNumber}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      showToast("success", "Invoice (JPG) berhasil diunduh.");
    });
  });

  document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "pt", "a4");
    const invoiceEl = document.getElementById("invoice-wrapper"); // Ambil wrapper untuk pdf
    
    doc.html(invoiceEl, {
        callback: function(doc) {
            doc.save(`invoice_lengkap_${user.outlet}_${invoiceNumber}.pdf`);
            showToast("success", "Invoice (PDF) berhasil diunduh.");
        },
        x: 15,
        y: 15,
        width: 550,
        windowWidth: 1200 
    });
  });
});