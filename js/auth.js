class SecurityManager {
  constructor() {
    this.maxLoginAttempts = 3;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.sessionTimeout = 60 * 60 * 1000; // 1 hour
  }

  isAccountLocked(identifier) {
    const lockData = StorageUtils.getItem(`lockout_${identifier}`);
    if (!lockData) return false;

    const isLocked = Date.now() - lockData.timestamp < this.lockoutDuration;
    if (!isLocked) {
      StorageUtils.removeItem(`lockout_${identifier}`);
    }
    return isLocked;
  }

  recordFailedAttempt(identifier) {
    const attemptsKey = `attempts_${identifier}`;
    const attempts = StorageUtils.getItem(attemptsKey, []);

    attempts.push(Date.now());

    // Keep only recent attempts
    const recentAttempts = attempts.filter(
      (timestamp) => Date.now() - timestamp < this.lockoutDuration
    );

    if (recentAttempts.length >= this.maxLoginAttempts) {
      StorageUtils.setItem(`lockout_${identifier}`, {
        timestamp: Date.now(),
        attempts: recentAttempts.length,
      });
      StorageUtils.removeItem(attemptsKey);
      return true; // Account locked
    }

    StorageUtils.setItem(attemptsKey, recentAttempts);
    return false; // Not locked yet
  }

  clearFailedAttempts(identifier) {
    StorageUtils.removeItem(`attempts_${identifier}`);
    StorageUtils.removeItem(`lockout_${identifier}`);
  }

  getRemainingLockoutTime(identifier) {
    const lockData = StorageUtils.getItem(`lockout_${identifier}`);
    if (!lockData) return 0;

    const remaining = this.lockoutDuration - (Date.now() - lockData.timestamp);
    return Math.max(0, remaining);
  }

  isSessionValid() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    if (!user || !user.loginTimestamp) return false;

    const sessionAge = Date.now() - user.loginTimestamp;
    return sessionAge < this.sessionTimeout;
  }

  extendSession() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    if (user) {
      user.lastActivity = Date.now();
      StorageUtils.setItem(AppConfig.STORAGE_KEYS.USER, user);
    }
  }
}

class AuthController {
  constructor() {
    this.isInitialized = false;
    this.elements = {};
    this.dodgeManager = new ButtonDodgeManager();
    this.securityManager = new SecurityManager();
    this.formAnimations = new FormAnimations();

    this.validationRules = {
      loginID: {
        required: true,
        minLength: 3,
        validate: (value) => {
          return ValidationUtils.isEmail(value) || value.length >= 3;
        },
        message: "Email tidak valid atau nama terlalu pendek",
      },
      password: {
        required: true,
        minLength: AppConfig.CONSTANTS.MIN_PASSWORD_LENGTH,
        validate: ValidationUtils.isValidPassword,
        message: `Password minimal ${AppConfig.CONSTANTS.MIN_PASSWORD_LENGTH} karakter`,
      },
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.bindElements();
      this.setupEventListeners();
      this.setupFormValidation();
      this.checkExistingSession();
      this.setupSecurityFeatures();

      // Initialize animations
      await this.formAnimations.initialize();

      this.isInitialized = true;
      Logger.info("Auth controller initialized");
    } catch (error) {
      Logger.error("Auth controller initialization failed", error);
      UIUtils.createToast("error", "Gagal menginisialisasi halaman login");
    }
  }

  bindElements() {
    const requiredElements = [
      "loginForm",
      "showSignup",
      "showLogin",
      "loginButton",
      "loginID",
      "password",
    ];

    requiredElements.forEach((id) => {
      this.elements[id] = document.getElementById(id);
      if (!this.elements[id]) {
        console.warn(`Element not found: ${id}`);
      }
    });

    // Find signup form (may not exist)
    this.elements.signupForm = document.getElementById("signupForm");

    // Optional elements
    this.elements.rememberMe = document.getElementById("rememberMe");
    this.elements.forgotPassword = document.getElementById("forgotPassword");
    this.elements.showPassword = document.getElementById("showPassword");
  }

  setupEventListeners() {
    // Form toggle listeners with animation
    if (this.elements.showSignup) {
      this.elements.showSignup.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleShowSignup();
      });
    }

    if (this.elements.showLogin) {
      this.elements.showLogin.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleShowLogin();
      });
    }

    // Form submission listeners
    if (this.elements.loginForm) {
      this.elements.loginForm.addEventListener("submit", (e) => {
        this.handleLogin(e);
      });
    }

    if (this.elements.signupForm) {
      this.elements.signupForm.addEventListener("submit", (e) => {
        this.handleSignup(e);
      });
    }

    // Real-time validation with debouncing
    if (this.elements.loginID && this.elements.password) {
      const debouncedValidation = UIUtils.debounce(
        this.validateForm.bind(this),
        300
      );

      this.elements.loginID.addEventListener("input", debouncedValidation);
      this.elements.password.addEventListener("input", debouncedValidation);
    }

    // Enhanced button dodge system
    if (this.elements.loginButton) {
      this.elements.loginButton.addEventListener("mouseenter", () => {
        if (this.dodgeManager.shouldDodge()) {
          this.dodgeManager.dodge();
        }
      });

      // Prevent context menu on dodge button
      this.elements.loginButton.addEventListener("contextmenu", (e) => {
        if (this.dodgeManager.shouldDodge()) {
          e.preventDefault();
        }
      });
    }

    // Show/hide password functionality
    if (this.elements.showPassword) {
      this.elements.showPassword.addEventListener("click", () => {
        this.togglePasswordVisibility();
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        this.handleLogin(e);
      }
    });

    // Session activity tracking
    document.addEventListener("click", () => {
      this.securityManager.extendSession();
    });
  }

  setupFormValidation() {
    if (!this.elements.loginID || !this.elements.password) return;

    this.validateForm();

    [this.elements.loginID, this.elements.password].forEach((input) => {
      input.addEventListener("blur", () => this.validateField(input));
      input.addEventListener("focus", () => this.clearFieldError(input));

      // Add input enhancement
      this.enhanceInput(input);
    });
  }

  enhanceInput(input) {
    // Add floating label effect
    const wrapper = document.createElement("div");
    wrapper.className = "input-wrapper";
    if (input.parentNode) {
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      // Add focus/blur animations
      input.addEventListener("focus", () => {
        wrapper.classList.add("focused");
      });

      input.addEventListener("blur", () => {
        if (!input.value) {
          wrapper.classList.remove("focused");
        }
      });

      if (input.value) {
        wrapper.classList.add("focused");
      }
    }
  }

  checkExistingSession() {
    const user = StorageUtils.getItem(AppConfig.STORAGE_KEYS.USER);
    if (user && user.email && this.securityManager.isSessionValid()) {
      Logger.info("Valid existing session found", { user: user.email });
      this.redirectUser(user);
    } else if (user) {
      // Session expired
      StorageUtils.removeItem(AppConfig.STORAGE_KEYS.USER);
      UIUtils.createToast(
        "info",
        "Sesi telah berakhir. Silakan login kembali."
      );
    }
  }

  setupSecurityFeatures() {
    // Check for account lockout
    if (this.elements.loginID) {
      this.elements.loginID.addEventListener("blur", () => {
        const identifier = this.elements.loginID.value;
        if (identifier && this.securityManager.isAccountLocked(identifier)) {
          const remainingTime =
            this.securityManager.getRemainingLockoutTime(identifier);
          const minutes = Math.ceil(remainingTime / (60 * 1000));
          UIUtils.createToast(
            "warning",
            `Akun terkunci. Coba lagi dalam ${minutes} menit.`,
            10000
          );
        }
      });
    }
  }

  async handleShowSignup() {
    if (this.formAnimations) {
      await this.formAnimations.switchToSignup();
    }
    this.updateFormContent("signup");
  }

  async handleShowLogin() {
    if (this.formAnimations) {
      await this.formAnimations.switchToLogin();
    }
    this.updateFormContent("login");
  }

  updateFormContent(formType) {
    const title = document.getElementById("form-title");
    const subtitle = document.getElementById("form-subtitle");

    if (formType === "signup") {
      if (title) title.textContent = "Daftar Outlet Baru";
      if (subtitle) subtitle.textContent = "Buat akun outlet Anda";
    } else {
      if (title) title.textContent = "Login Outlet";
      if (subtitle) subtitle.textContent = "Masukkan detail akun Anda";
    }
  }

  validateField(input) {
    const fieldName = input.id;
    const rule = this.validationRules[fieldName];

    if (!rule) return true;

    const value = ValidationUtils.sanitizeInput(input.value);
    let isValid = true;
    let errorMessage = "";

    try {
      if (rule.required) {
        ValidationUtils.validateRequired(value, fieldName);
      }

      if (value && rule.minLength) {
        ValidationUtils.validateLength(
          value,
          rule.minLength,
          Infinity,
          fieldName
        );
      }

      if (value && rule.validate && !rule.validate(value)) {
        throw new Error(rule.message);
      }
    } catch (error) {
      isValid = false;
      errorMessage = error.message;
    }

    this.showFieldValidation(input, isValid, errorMessage);
    return isValid;
  }

  showFieldValidation(input, isValid, message) {
    const wrapper = input.closest(".input-wrapper") || input.parentElement;
    const existingError = wrapper.querySelector(".invalid-feedback");

    // Remove existing validation classes and messages
    input.classList.remove("is-invalid", "is-valid");
    if (existingError) existingError.remove();

    if (isValid && input.value) {
      input.classList.add("is-valid");
      this.animateValidationSuccess(input);
    } else if (!isValid) {
      input.classList.add("is-invalid");

      const errorDiv = document.createElement("div");
      errorDiv.className = "invalid-feedback";
      errorDiv.textContent = message;
      wrapper.appendChild(errorDiv);

      this.animateValidationError(input);
    }
  }

  animateValidationSuccess(input) {
    if (!AppConfig.device.supportsAnimations) return;

    input.style.animation = "validationSuccess 0.3s ease-out";
    setTimeout(() => {
      input.style.animation = "";
    }, 300);
  }

  animateValidationError(input) {
    if (!AppConfig.device.supportsAnimations) return;

    input.style.animation = "validationError 0.5s ease-out";
    setTimeout(() => {
      input.style.animation = "";
    }, 500);
  }

  clearFieldError(input) {
    input.classList.remove("is-invalid", "is-valid");
    const existingError =
      input.parentElement.querySelector(".invalid-feedback");
    if (existingError) existingError.remove();
  }

  validateForm() {
    if (!this.elements.loginID || !this.elements.password) return false;

    const loginIDValid = this.validateField(this.elements.loginID);
    const passwordValid = this.validateField(this.elements.password);
    const isFormValid = loginIDValid && passwordValid;

    this.dodgeManager.setFormValid(isFormValid);
    this.updateLoginButtonState(isFormValid);

    return isFormValid;
  }

  updateLoginButtonState(isValid) {
    const button = this.elements.loginButton;
    if (!button) return;

    if (isValid) {
      button.classList.remove("btn-outline-primary");
      button.classList.add("btn-primary");
      button.style.transform = "scale(1)";
    } else {
      button.classList.remove("btn-primary");
      button.classList.add("btn-outline-primary");
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const identifier = ValidationUtils.sanitizeInput(
      this.elements.loginID.value
    );
    const password = this.elements.password.value;

    if (!this.validateForm()) {
      Logger.warn("Login form is invalid, submission blocked.");
      return;
    }
    UIUtils.setLoadingState(this.elements.loginButton, true, "Memproses...");

    try {
      const payload = {
        path: "login",
        email: identifier,
        password: password,
      };
      const result = await APIClient.request("login", {
        method: "POST",
        body: JSON.stringify(payload),
        useCache: false,
      });

      if (result && result.status === "success" && result.user) {
        result.user.loginTimestamp = Date.now();
        StorageUtils.setItem(AppConfig.STORAGE_KEYS.USER, result.user);

        Logger.info("Login successful", {
          user: result.user.email,
          role: result.user.role,
        });
        UIUtils.createToast("success", "Login berhasil! Mengalihkan...");

        setTimeout(() => {
          this.redirectUser(result.user);
        }, 1500);
      } else {
        throw new Error(result.message || "Email atau password salah.");
      }
    } catch (error) {
      Logger.error("Login failed", {
        error: error.message,
        loginID: identifier,
      });
      this.showLoginError();
    } finally {
      UIUtils.setLoadingState(this.elements.loginButton, false);
    }
  }

  async showLoginError() {
    // Enhanced error animation
    if (this.formAnimations) {
      await this.formAnimations.showLoginError();
    }

    // Show error toast
    UIUtils.createToast("error", "😢 Username atau password salah!");
  }

  async handleSignup(e) {
    e.preventDefault();

    Logger.info("Signup form submitted");
    UIUtils.createToast("info", "Fitur pendaftaran akan segera tersedia");

    // TODO: Implement signup logic
  }

  togglePasswordVisibility() {
    if (!this.elements.password || !this.elements.showPassword) return;

    const passwordInput = this.elements.password;
    const toggleIcon = this.elements.showPassword.querySelector("i");

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      if (toggleIcon) toggleIcon.className = "bi bi-eye-slash";
    } else {
      passwordInput.type = "password";
      if (toggleIcon) toggleIcon.className = "bi bi-eye";
    }
  }

  redirectUser(user) {
    const userRole = (user.role || "user").toLowerCase();

    // Periksa jika peran adalah 'admin'
    if (userRole === "admin") {
      // Tampilkan modal pilihan untuk admin
      const adminModalElement = document.getElementById("adminChoiceModal");
      const adminModal = new bootstrap.Modal(adminModalElement);

      document.getElementById("goToAdminPanelBtn").onclick = () => {
        window.location.href = AppConfig.ROUTES.ADMIN;
      };

      document.getElementById("goToCatalogBtn").onclick = () => {
        window.location.href = AppConfig.ROUTES.CATALOG;
      };

      adminModal.show();
    } else {
      // Untuk pengguna biasa, langsung arahkan ke katalog
      const targetPage = AppConfig.ROUTES.CATALOG;
      Logger.info("Redirecting user", {
        user: user.email || user.nama_user,
        role: userRole,
        target: targetPage,
      });
      window.location.href = targetPage;
    }
  }
}

class FormAnimations {
  constructor() {
    this.currentForm = "login";
  }

  async initialize() {
    // Add CSS animations
    this.addAnimationStyles();

    // Initialize entrance animation
    const container = document.querySelector(".login-container");
    if (container && AppConfig.device && AppConfig.device.supportsAnimations) {
      try {
        await UIUtils.animate(container, "slideInUp", {
          keyframes: [
            {
              opacity: 0,
              transform: "translateY(60px) scale(0.9)",
              filter: "blur(10px)",
            },
            {
              opacity: 1,
              transform: "translateY(0) scale(1)",
              filter: "blur(0px)",
            },
          ],
          duration: 600,
          easing: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        });
      } catch (error) {
        console.warn("Animation failed:", error);
      }
    }
  }

  async switchToSignup() {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (!loginForm || !signupForm) return;

    if (AppConfig.device && AppConfig.device.supportsAnimations) {
      await UIUtils.fadeOut(loginForm, 200);
      await UIUtils.fadeIn(signupForm, 200);
    } else {
      loginForm.style.display = "none";
      signupForm.style.display = "block";
    }

    this.currentForm = "signup";
  }

  async switchToLogin() {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (!loginForm || !signupForm) return;

    if (AppConfig.device && AppConfig.device.supportsAnimations) {
      await UIUtils.fadeOut(signupForm, 200);
      await UIUtils.fadeIn(loginForm, 200);
    } else {
      signupForm.style.display = "none";
      loginForm.style.display = "block";
    }

    this.currentForm = "login";
  }

  async showLoginSuccess() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    if (
      AppConfig.device &&
      AppConfig.device.supportsAnimations &&
      AppConfig.animate
    ) {
      try {
        await UIUtils.animate(form, "success", {
          keyframes: [
            { transform: "scale(1)", filter: "hue-rotate(0deg)" },
            { transform: "scale(1.05)", filter: "hue-rotate(120deg)" },
            { transform: "scale(1)", filter: "hue-rotate(0deg)" },
          ],
          duration: 600,
        });
      } catch (error) {
        console.warn("Success animation failed:", error);
      }
    }
  }

  async showLoginError() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    if (
      AppConfig.device &&
      AppConfig.device.supportsAnimations &&
      AppConfig.animate
    ) {
      try {
        // Shake animation
        await UIUtils.animate(form, "shake", {
          keyframes: [
            { transform: "translateX(0)" },
            { transform: "translateX(-10px)" },
            { transform: "translateX(10px)" },
            { transform: "translateX(-10px)" },
            { transform: "translateX(10px)" },
            { transform: "translateX(0)" },
          ],
          duration: 500,
        });
      } catch (error) {
        console.warn("Error animation failed:", error);
        // Fallback to simple shake
        form.style.animation = "shake 0.5s ease-in-out";
        setTimeout(() => {
          form.style.animation = "";
        }, 500);
      }
    }
  }

  addAnimationStyles() {
    if (document.getElementById("auth-animations")) return;

    const styles = document.createElement("style");
    styles.id = "auth-animations";
    styles.textContent = `
      @keyframes validationSuccess {
        0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
        100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      }

      @keyframes validationError {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
      }

      .input-wrapper {
        position: relative;
        transition: all 0.3s ease;
      }

      .input-wrapper.focused {
        transform: translateY(-2px);
      }

      .input-wrapper .form-control {
        transition: all 0.3s ease;
      }

      .input-wrapper.focused .form-control {
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        border-color: var(--primary);
      }

      .crying-emoji {
        font-size: 2rem;
        animation: cry 0.5s infinite alternate;
      }

      @keyframes cry {
        0% { transform: translateY(0) rotate(-2deg); }
        100% { transform: translateY(-5px) rotate(2deg); }
      }

      .dodging {
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.68, -0.6, 0.32, 1.6);
      }

      .dodging:hover {
        transform: scale(1.1);
      }

      .custom-toast {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styles);
  }
}

class ButtonDodgeManager {
  constructor() {
    this.isDodging = false;
    this.isFormValid = false;
    this.dodgeButton = null;
    this.originalPosition = null;
    this.dodgeCount = 0;
    this.maxDodges = 5;

    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Update viewport on resize
    window.addEventListener("resize", () => {
      this.viewport.width = window.innerWidth;
      this.viewport.height = window.innerHeight;
    });
  }

  setFormValid(valid) {
    const wasValid = this.isFormValid;
    this.isFormValid = valid;

    if (!wasValid && valid && this.isDodging) {
      this.returnToPosition();
    } else if (wasValid && !valid && !this.isDodging) {
      this.startDodging();
    }
  }

  shouldDodge() {
    return !this.isFormValid && this.dodgeCount < this.maxDodges;
  }

  startDodging() {
    if (this.isDodging) return;

    this.dodgeButton = document.getElementById("loginButton");
    if (!this.dodgeButton) return;

    // Store original position
    const rect = this.dodgeButton.getBoundingClientRect();
    this.originalPosition = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };

    // Apply dodging styles
    Object.assign(this.dodgeButton.style, {
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      fontSize: "0",
      zIndex: "1051",
      transition: "all 0.4s cubic-bezier(0.68, -0.6, 0.32, 1.6)",
    });

    this.dodgeButton.classList.add("dodging");
    this.isDodging = true;

    Logger.debug("Button dodge started");
  }

  dodge() {
    if (
      !this.isDodging ||
      !this.dodgeButton ||
      this.dodgeCount >= this.maxDodges
    ) {
      return;
    }

    const margin = 20;
    const buttonSize = 44;
    const maxX = this.viewport.width - buttonSize - margin;
    const maxY = this.viewport.height - buttonSize - margin;

    // More sophisticated dodge algorithm
    const currentX = parseInt(this.dodgeButton.style.left);
    const currentY = parseInt(this.dodgeButton.style.top);

    let randomX, randomY;
    do {
      randomX = Math.max(margin, Math.floor(Math.random() * maxX));
      randomY = Math.max(margin, Math.floor(Math.random() * maxY));
    } while (
      Math.abs(randomX - currentX) < 100 ||
      Math.abs(randomY - currentY) < 100
    );

    this.dodgeButton.style.left = `${randomX}px`;
    this.dodgeButton.style.top = `${randomY}px`;

    this.dodgeCount++;

    // Add playful messages
    const messages = [
      "😏 Hmm, coba isi form dengan benar dulu!",
      "🏃‍♂️ Kabur dulu ah!",
      "😅 Form belum lengkap nih!",
      "🤔 Masih ada yang salah tuh!",
      "😂 Isi data yang bener dong!",
    ];

    if (this.dodgeCount <= messages.length) {
      UIUtils.createToast("info", messages[this.dodgeCount - 1], 2000);
    }

    Logger.debug("Button dodged", {
      x: randomX,
      y: randomY,
      count: this.dodgeCount,
    });
  }

  returnToPosition() {
    if (!this.isDodging || !this.dodgeButton || !this.originalPosition) return;

    // Reset styles
    Object.assign(this.dodgeButton.style, {
      position: "",
      top: "",
      left: "",
      width: "",
      height: "",
      borderRadius: "",
      fontSize: "",
      zIndex: "",
      transition: "",
    });

    this.dodgeButton.classList.remove("dodging");
    this.isDodging = false;
    this.dodgeCount = 0;

    Logger.debug("Button returned to position");
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Wait a bit to ensure utils.js is loaded
  setTimeout(() => {
    // Debug: Check what APIClient we have
    Logger.debug("APIClient check", {
      exists: typeof window.APIClient !== "undefined",
      hasRequest:
        window.APIClient && typeof window.APIClient.request === "function",
      type: typeof window.APIClient,
      instance: window.APIClient instanceof Object,
    });

    const authController = new AuthController();
    authController.init().catch((error) => {
      Logger.error("Failed to initialize auth controller", error);
    });

    // Store controller globally for debugging
    window.authController = authController;
  }, 100);
});

// Add enhanced error handling
window.addEventListener("error", (event) => {
  Logger.error("Uncaught error on auth page", {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    column: event.colno,
    error: event.error,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  Logger.error("Unhandled promise rejection on auth page", {
    reason: event.reason,
  });
  event.preventDefault();
});
