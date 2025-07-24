document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const showSignup = document.getElementById("showSignup");
  const showLogin = document.getElementById("showLogin");
  const loginButton = document.getElementById("loginButton");
  const loginIDInput = document.getElementById("loginID");
  const passwordInput = document.getElementById("password");

  // --- UI: Toggle Form Login/Signup ---
  showSignup.addEventListener("click", (e) => {
    e.preventDefault();
    loginForm.style.display = "none";
    signupForm.style.display = "block";
  });

  showLogin.addEventListener("click", (e) => {
    e.preventDefault();
    signupForm.style.display = "none";
    loginForm.style.display = "block";
  });
  /**
   * Memindahkan tombol ke posisi acak di dalam viewport.
   * @param {HTMLElement} button Tombol yang akan dipindahkan.
   */
  function moveButtonRandomly(button) {
    const buttonRect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 15; // Jarak aman dari tepi layar

    const maxX = viewportWidth - buttonRect.width - margin;
    const maxY = viewportHeight - buttonRect.height - margin;

    const randomX = Math.floor(Math.random() * maxX) + margin;
    const randomY = Math.floor(Math.random() * maxY) + margin;

    button.style.left = `${randomX}px`;
    button.style.top = `${randomY}px`;
  }

  /**
   * Memeriksa input dan mengubah state tombol antara normal dan "kabur".
   */
  function updateButtonState() {
    const loginID = loginIDInput.value;
    const password = passwordInput.value;
    const isDodging = loginButton.classList.contains("dodging");

    if (!loginID || !password) {
      if (!isDodging) {
        const rect = loginButton.getBoundingClientRect();
        loginButton.style.top = `${rect.top}px`;
        loginButton.style.left = `${rect.left}px`;

        loginButton.classList.remove("w-100");
        loginButton.classList.add("dodging");
      }
    } else {
      if (isDodging) {
        loginButton.classList.remove("dodging");
        loginButton.classList.add("w-100");

        loginButton.style.top = "";
        loginButton.style.left = "";
      }
    }
  }
  loginButton.addEventListener("mouseenter", () => {
    if (loginButton.classList.contains("dodging")) {
      moveButtonRandomly(loginButton);
    }
  });

  loginIDInput.addEventListener("input", updateButtonState);
  passwordInput.addEventListener("input", updateButtonState);
  updateButtonState();

  // --- Handler Form dengan Logika Login Asli ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loginButton.classList.contains("dodging")) return;

    loginButton.disabled = true;
    loginButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Memproses...`;

    try {
      const loginID = document.getElementById("loginID").value;
      const password = document.getElementById("password").value;
      const path = `login&email=${encodeURIComponent(
        loginID
      )}&password=${encodeURIComponent(password)}`;

      const result = await fetchAPI(path);

      localStorage.setItem("user", JSON.stringify(result.user));

      setTimeout(() => {
        window.location.href =
          result.user.role === "admin" ? "admin.html" : "katalog.html";
      }, 1500);
    } catch (error) {
      const cryToastEl = document.getElementById("cryToast");
      if (cryToastEl) {
        const cryToast = new bootstrap.Toast(cryToastEl);
        cryToast.show();
        setTimeout(() => cryToast.hide(), 2000);
      } else {
        console.error("Elemen toast 'cryToast' tidak ditemukan.", error);
      }
    } finally {
      loginButton.disabled = false;
      loginButton.innerHTML = "Login";
      // Panggil updateButtonState untuk mereset kondisi tombol jika login gagal
      updateButtonState();
    }
  });

  // Signup Handler (tidak diubah)
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Signup form submitted");
    // Implementasikan logika signup di sini
  });
});
