// File: js/utils.js

/**
 * Menampilkan notifikasi toast Bootstrap.
 * @param {('success'|'error'|'info'|'warning')} type - Tipe toast (menentukan warna).
 * @param {string} message - Pesan yang akan ditampilkan.
 */
function showToast(type, message) {
  const toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) return;
  const toast = document.createElement("div");
  const bgClass = type === "error" ? "bg-danger" : `bg-${type}`;

  toast.className = `toast align-items-center text-white ${bgClass} border-0`;
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  toastContainer.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
  bsToast.show();
  toast.addEventListener("hidden.bs.toast", () => toast.remove());
}

/**
 * Memformat angka menjadi format mata uang Rupiah.
 * @param {number} number - Angka yang akan diformat.
 * @returns {string} String dalam format Rupiah (Rp 1.234).
 */
const formatRupiah = (number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

/**
 * Melakukan fetch ke Google Apps Script dengan penanganan error.
 * @param {string} path - Endpoint path di Google Script.
 * @param {object} [options={}] - Opsi untuk fetch (method, body, dll).
 * @returns {Promise<any>} Data dari response.
 */
async function fetchAPI(path, options = {}) {
  const url = `${SCRIPT_URL}?path=${path}`;
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    if (result.status === "error" || result.success === false) {
      throw new Error(result.message || "Terjadi kesalahan pada server.");
    }
    return result;
  } catch (error) {
    showToast("error", error.message);
    throw error; // Propagate error untuk penanganan lebih lanjut jika perlu
  }
}
