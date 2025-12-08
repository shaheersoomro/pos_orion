// ============================================
// ORION POS - Modern JavaScript
// ============================================

// Product Data
const products = [
  {
    id: 1,
    name: "Espresso",
    price: 3.5,
    category: "coffee",
    icon: "images/coffee.png",
  },
  {
    id: 2,
    name: "Latte",
    price: 4.5,
    category: "coffee",
    icon: "images/coffee.png",
  },
  {
    id: 3,
    name: "Cappuccino",
    price: 4.5,
    category: "coffee",
    icon: "images/coffee.png",
  },
  {
    id: 4,
    name: "Americano",
    price: 3.0,
    category: "coffee",
    icon: "images/coffee.png",
  },
  {
    id: 5,
    name: "Sandwich",
    price: 7.99,
    category: "food",
    icon: "images/sandwich.png",
  },
  {
    id: 6,
    name: "Burger",
    price: 9.99,
    category: "food",
    icon: "images/burger.png",
  },
  {
    id: 7,
    name: "Salad",
    price: 8.99,
    category: "food",
    icon: "images/salad.png",
  },
  {
    id: 8,
    name: "Pizza",
    price: 12.99,
    category: "food",
    icon: "images/pizza.png",
  },
  {
    id: 9,
    name: "Haircut",
    price: 25.0,
    category: "services",
    icon: "images/hair-cut.png",
  },
  {
    id: 10,
    name: "Hair Wash",
    price: 15.0,
    category: "services",
    icon: "images/hair-wash.png",
  },
  {
    id: 11,
    name: "Massage",
    price: 50.0,
    category: "services",
    icon: "images/head-massage.png",
  },
  {
    id: 12,
    name: "Manicure",
    price: 20.0,
    category: "services",
    icon: "images/manicure.png",
  },
];

const users = [
  {
    id: 1,
    name: "Alice",
    role: "Admin",
    email: "alice@example.com",
    password: "password123",
  },
  {
    id: 2,
    name: "Bob",
    role: "Manager",
    email: "bob@example.com",
    password: "password456",
  },
  {
    id: 3,
    name: "Charlie",
    role: "Cashier",
    email: "charlie@example.com",
    password: "password789",
  },
];

// Cart State
let cart = [];
let currentFilter = "all";

// Tax Rate
const TAX_RATE = 0.08;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initializeProducts();
  initializeUsers();
  setupEventListeners();
  updateOrderTime();
  setInterval(updateOrderTime, 1000);
});

// ============================================
// USER MANAGEMENT
// ============================================

function initializeUsers() {
  if (document.getElementById("users-grid")) {
    renderUsers(users);
  }
}
function renderUsers(usersToRender) {
  const usersGrid = document.getElementById("users-grid");

  // Check if the user grid exists
  if (!usersGrid) {
    console.log("Not on Users page - skipping users rendering");
    return;
  }

  usersGrid.innerHTML = "";

  usersToRender.forEach((user) => {
    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
        <div class="user-avatar">${user.name.charAt(0)}</div>
        <div class="user-name">${user.name}</div>
        <div class="user-role">${user.role}</div>
        <div class="user-status">● Online</div>
        <div class="user-actions">
            <button class="btn-icon"><i class="bi bi-pencil"></i> Edit</button>
             <button class="btn-icon"><i class="bi bi-trash"></i> Delete</button>
        </div>
        `;
    usersGrid.appendChild(card);
  });
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================

function initializeProducts() {
  if (document.getElementById("products-grid")) {
    renderProducts(products);
  }
}
function renderProducts(productsToRender) {
  const grid = document.getElementById("products-grid");

  // Check if the products grid exists (we're on index.html)
  if (!grid) {
    console.log("Not on POS page - skipping product rendering");
    return;
  }

  grid.innerHTML = "";

  productsToRender.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
            <div class="product-icon"><img src="${product.icon}"></div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">$${product.price.toFixed(2)}</div>
        `;
    card.addEventListener("click", () => addToCart(product));
    grid.appendChild(card);
  });
}

function filterProducts(category) {
  currentFilter = category;
  const filtered =
    category === "all"
      ? products
      : products.filter((p) => p.category === category);
  renderProducts(filtered);
}

// ============================================
// CART MANAGEMENT
// ============================================

function addToCart(product) {
  const existingItem = cart.find((item) => item.id === product.id);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({
      ...product,
      quantity: 1,
    });
  }

  updateCart();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  updateCart();
}

function updateItemQuantity(productId, quantity) {
  const item = cart.find((item) => item.id === productId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    updateCart();
  }
}

function updateCart() {
  // Only update cart UI if we're on POS page
  if (document.getElementById("order-items")) {
    renderCartItems();
    updateTotals();
  }
}

function renderCartItems() {
  const itemsContainer = document.getElementById("order-items");

  if (!itemsContainer) return; // Exit if not on POS page

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <p>No items added</p>
            </div>
        `;
    return;
  }

  itemsContainer.innerHTML = cart
    .map(
      (item) => `
        <div class="order-item">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-qty">Qty: ${item.quantity}</div>
            </div>
            <div class="item-price">$${(item.price * item.quantity).toFixed(
              2
            )}</div>
        </div>
    `
    )
    .join("");
}

function updateTotals() {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  // Only update these elements if they exist
  const subtotalEl = document.getElementById("subtotal");
  const taxEl = document.getElementById("tax");
  const totalEl = document.getElementById("total");
  const modalTotalEl = document.getElementById("modal-total");

  if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
  if (modalTotalEl) modalTotalEl.textContent = `$${total.toFixed(2)}`;
}

// ============================================
// ORDER MANAGEMENT
// ============================================

function cancelOrder() {
  if (cart.length === 0) {
    alert("No items to cancel");
    return;
  }

  if (confirm("Are you sure you want to cancel this order?")) {
    cart = [];
    updateCart();
  }
}

function updateOrderTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const orderTimeEl = document.querySelector(".order-time");
  if (orderTimeEl) {
    orderTimeEl.textContent = timeString;
  }
}

// ============================================
// PAYMENT MANAGEMENT
// ============================================

function openPaymentModal() {
  if (cart.length === 0) {
    alert("Please add items to the cart first");
    return;
  }

  document.getElementById("amount-received").value = "";
  document.getElementById("change-display").style.display = "none";

  const paymentModal = new bootstrap.Modal(
    document.getElementById("paymentModal")
  );
  paymentModal.show();
}

function setupPaymentListeners() {
  const amountInput = document.getElementById("amount-received");
  const changeDisplay = document.getElementById("change-display");
  const changeAmount = document.getElementById("change-amount");

  const totalAmount = parseFloat(
    document.getElementById("total").textContent.replace("$", "")
  );

  amountInput.addEventListener("input", () => {
    const amount = parseFloat(amountInput.value) || 0;

    if (amount >= totalAmount) {
      const change = amount - totalAmount;
      changeAmount.textContent = `$${change.toFixed(2)}`;
      changeDisplay.style.display = "flex";
    } else {
      changeDisplay.style.display = "none";
    }
  });
}

function completePayment() {
  const totalAmount = parseFloat(
    document.getElementById("total").textContent.replace("$", "")
  );
  const amountReceived =
    parseFloat(document.getElementById("amount-received").value) || 0;

  if (amountReceived < totalAmount) {
    alert("Insufficient payment amount");
    return;
  }

  const completeModal = bootstrap.Modal.getOrCreateInstance(
    document.getElementById("completeModal")
  );
  completeModal.show();

  // Reset
  cart = [];
  updateCart();

  // Close modal
  const paymentModal = bootstrap.Modal.getInstance(
    document.getElementById("paymentModal")
  );
  paymentModal.hide();
}

// ============================================
// PRODUCT MANAGEMENT MODAL
// ============================================

function openAddProductModal() {
  // Reset form fields
  document.getElementById("product-name").value = "";
  document.getElementById("product-price").value = "";
  document.getElementById("product-category").value = "coffee";
  document.getElementById("product-icon").value = "";

  // Clear any previous validation messages
  const validationMsg = document.getElementById("product-validation");
  if (validationMsg) {
    validationMsg.style.display = "none";
    validationMsg.textContent = "";
  }

  // Show the modal
  const addProductModal = new bootstrap.Modal(
    document.getElementById("addProductModal")
  );
  addProductModal.show();
}

function setupAddProductListeners() {
  const productForm = document.getElementById("add-product-form");
  const productName = document.getElementById("product-name");
  const productPrice = document.getElementById("product-price");
  const validationMsg = document.getElementById("product-validation");

  productForm.addEventListener("submit", function (e) {
    e.preventDefault();
    addNewProduct();
  });

  // Real-time validation
  productPrice.addEventListener("input", function () {
    const price = parseFloat(productPrice.value);
    if (price < 0) {
      showValidationMessage("Price cannot be negative");
    } else {
      hideValidationMessage();
    }
  });

  productName.addEventListener("input", function () {
    if (productName.value.trim().length < 2) {
      showValidationMessage("Product name must be at least 2 characters");
    } else {
      hideValidationMessage();
    }
  });

  function showValidationMessage(message) {
    validationMsg.textContent = message;
    validationMsg.style.display = "block";
  }

  function hideValidationMessage() {
    validationMsg.style.display = "none";
  }
}

function addNewProduct() {
  const name = document.getElementById("product-name").value.trim();
  const price = parseFloat(document.getElementById("product-price").value);
  const category = document.getElementById("product-category").value;
  const icon =
    document.getElementById("product-icon").value || `images/${category}.png`;

  // Validation
  if (!name || name.length < 2) {
    alert("Please enter a valid product name (at least 2 characters)");
    return;
  }

  if (isNaN(price) || price < 0) {
    alert("Please enter a valid price");
    return;
  }

  // Check for duplicate product names
  const existingProduct = products.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (existingProduct) {
    alert("A product with this name already exists");
    return;
  }

  // Create new product
  const newProduct = {
    id: products.length + 1, // Simple ID generation
    name: name,
    price: price,
    category: category,
    icon: icon,
  };

  // Add to products array
  products.push(newProduct);

  // Update UI
  renderProducts(products);

  // Show success message
  const successModal = new bootstrap.Modal(
    document.getElementById("addProductSuccessModal")
  );
  successModal.show();

  // Close the add product modal
  const addProductModal = bootstrap.Modal.getInstance(
    document.getElementById("addProductModal")
  );
  addProductModal.hide();

  // Reset form
  document.getElementById("add-product-form").reset();
}

// ============================================
// User MANAGEMENT MODAL
// ============================================

function openAddUserModal() {
  // Reset form fields
  document.getElementById("user-name").value = "";
  document.getElementById("user-role").value = "Admin";
  document.getElementById("user-email").value = "";
  document.getElementById("user-password").value = "";

  // Clear any previous validation messages
  const validationMsg = document.getElementById("user-validation");
  if (validationMsg) {
    validationMsg.style.display = "none";
    validationMsg.textContent = "";
  }

  // Show the modal
  const addUserModal = new bootstrap.Modal(
    document.getElementById("addUserModal")
  );
  addUserModal.show();
}

function setupAddUserListeners() {
  const userForm = document.getElementById("add-user-form");
  const userName = document.getElementById("user-name");
  const validationMsg = document.getElementById("user-validation");

  userForm.addEventListener("submit", function (e) {
    e.preventDefault();
    addNewUser();
  });

  // Real-time validation
  userName.addEventListener("input", function () {
    if (userName.value.trim().length < 2) {
      // Fixed: changed 'productName' to 'userName'
      showValidationMessage("User name must be at least 2 characters");
    } else {
      hideValidationMessage();
    }
  });

  function showValidationMessage(message) {
    validationMsg.textContent = message;
    validationMsg.style.display = "block";
  }

  function hideValidationMessage() {
    validationMsg.style.display = "none";
  }
}

function addNewUser() {
  const name = document.getElementById("user-name").value.trim();
  const role = document.getElementById("user-role").value;
  const email = document.getElementById("user-email").value.trim();
  const password = document.getElementById("user-password").value;

  // Validation
  if (!name || name.length < 2) {
    alert("Please enter a valid user name (at least 2 characters)");
    return;
  }

  if (!email || !email.includes("@")) {
    alert("Please enter a valid email address");
    return;
  }

  if (!password || password.length < 6) {
    alert("Please enter a valid password (at least 6 characters)");
    return;
  }

  // Check for duplicate user emails
  const existingUser = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (existingUser) {
    alert("A user with this email already exists");
    return;
  }

  // Create new user
  const newUser = {
    id: users.length + 1,
    name: name,
    role: role,
    email: email,
    password: password,
  };

  // Add to users array
  users.push(newUser);

  // Update UI
  renderUsers(users);

  // Show success message
  const successModal = new bootstrap.Modal(
    document.getElementById("addUserSuccessModal")
  );
  successModal.show();

  // Close the add user modal
  const addUserModal = bootstrap.Modal.getInstance(
    document.getElementById("addUserModal")
  );
  addUserModal.hide();

  // Reset form
  document.getElementById("add-user-form").reset();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Only set up POS event listeners if we're on the POS page
  if (document.getElementById("product-search")) {
    // Category filters
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        filterProducts(e.target.dataset.category);
      });
    });

    // Search
    document.getElementById("product-search").addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) &&
          (currentFilter === "all" || p.category === currentFilter)
      );
      renderProducts(filtered);
    });

    // Order actions
    document
      .getElementById("btn-cancel")
      .addEventListener("click", cancelOrder);
    document
      .getElementById("btn-payment")
      .addEventListener("click", openPaymentModal);
  }

  // Set up inventory event listeners if we're on inventory page
  if (document.getElementById("btn-add-product")) {
    document
      .getElementById("btn-add-product")
      .addEventListener("click", openAddProductModal);
    document
      .getElementById("btn-save-product")
      .addEventListener("click", addNewProduct);
    setupAddProductListeners();
  }

  if (document.getElementById("btn-add-user")) {
    document
      .getElementById("btn-add-user")
      .addEventListener("click", openAddUserModal);
    document
      .getElementById("btn-save-user")
      .addEventListener("click", addNewUser);
    setupAddUserListeners();
  }

  // Set up payment listeners if payment modal exists
  if (document.getElementById("btn-complete-payment")) {
    document
      .getElementById("btn-complete-payment")
      .addEventListener("click", completePayment);
    setupPaymentListeners();
  }

  // Payment method selection (exists in both pages)
  document.querySelectorAll(".payment-method").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".payment-method")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
    });
  });
}

// Common functions for both login and signup
// Strong password validation function (exactly as in your original code)
function validatePassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push("• At least 8 characters long");
  }

  if (!/(?=.*[a-z])/.test(password)) {
    errors.push("• At least one lowercase letter");
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push("• At least one uppercase letter");
  }

  if (!/(?=.*\d)/.test(password)) {
    errors.push("• At least one number");
  }

  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    errors.push("• At least one special character");
  }

  return errors;
}

// Complete JavaScript code for both login and signup pages
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");

// Common functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showError(fieldId, message) {
  clearErrorForField(fieldId);
  
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  const formGroup = field.closest(".form-group");
  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.setAttribute("data-field", fieldId);
  errorElement.innerHTML = message;
  errorElement.style.color = "#BE3E3F";
  errorElement.style.fontSize = "0.875rem";
  errorElement.style.marginTop = "0.25rem";

  formGroup.appendChild(errorElement);
  field.style.borderColor = "#BE3E3F";
}

function showSuccess(message) {
  const existingSuccess = document.querySelector(".success-message");
  if (existingSuccess) existingSuccess.remove();

  const successElement = document.createElement("div");
  successElement.className = "success-message";
  successElement.textContent = message;
  successElement.style.color = "#02CA3A";
  successElement.style.backgroundColor = "#d4edda";
  successElement.style.border = "1px solid #c3e6cb";
  successElement.style.borderRadius = "0.25rem";
  successElement.style.padding = "0.75rem";
  successElement.style.margin = "1rem 0";
  successElement.style.fontSize = "0.875rem";

  const form = document.querySelector("form");
  if (form) form.parentNode.insertBefore(successElement, form);
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach(error => error.remove());
  document.querySelectorAll(".success-message").forEach(msg => msg.remove());
  
  const fields = ["email", "password", "confirm-password"];
  fields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) field.style.borderColor = "";
  });
}

function clearErrorForField(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  const formGroup = field.closest(".form-group");
  if (!formGroup) return;
  
  const errorMessage = formGroup.querySelector(`.error-message[data-field="${fieldId}"]`) || 
                       formGroup.querySelector(".error-message");
  if (errorMessage) errorMessage.remove();
  
  field.style.borderColor = "";
}

function initPasswordToggle() {
  document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", function() {
      const passwordInput = this.parentElement.querySelector("input");
      const icon = this.querySelector("i");
      
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.classList.replace("bi-eye", "bi-eye-slash");
        this.setAttribute("aria-label", "Hide password");
      } else {
        passwordInput.type = "password";
        icon.classList.replace("bi-eye-slash", "bi-eye");
        this.setAttribute("aria-label", "Show password");
      }
    });
  });
}

// LOGIN FUNCTIONALITY
if (loginBtn) {
  loginBtn.addEventListener("click", function(e) {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    clearErrors();
    let isValid = true;

    if (!email) {
      showError("email", "Email is required.");
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError("email", "Please enter a valid email address.");
      isValid = false;
    }

    if (!password) {
      showError("password", "Password is required.");
      isValid = false;
    }

    if (isValid) {
      showSuccess("Login successful! Redirecting...");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    }
  });

  // Real-time validation for login
  const loginEmail = document.getElementById("email");
  const loginPassword = document.getElementById("password");

  if (loginEmail) {
    loginEmail.addEventListener("blur", function() {
      clearErrorForField("email");
      const email = this.value.trim();
      if (email && !isValidEmail(email)) {
        showError("email", "Please enter a valid email address.");
      }
    });
    loginEmail.addEventListener("input", () => clearErrorForField("email"));
  }

  if (loginPassword) {
    loginPassword.addEventListener("blur", function() {
      clearErrorForField("password");
      if (!this.value) showError("password", "Password is required.");
    });
    loginPassword.addEventListener("input", () => clearErrorForField("password"));
  }
}

// SIGNUP FUNCTIONALITY
if (signupBtn) {
  signupBtn.addEventListener("click", function(e) {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    clearErrors();
    let isValid = true;

    if (!email) {
      showError("email", "Email is required.");
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError("email", "Please enter a valid email address.");
      isValid = false;
    }

    if (!password) {
      showError("password", "Password is required.");
      isValid = false;
    } else {
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0) {
        showError("password", passwordErrors.join("<br>"));
        isValid = false;
      }
    }

    if (!confirmPassword) {
      showError("confirm-password", "Please confirm your password.");
      isValid = false;
    } else if (password !== confirmPassword) {
      showError("confirm-password", "Passwords do not match.");
      isValid = false;
    }

    if (isValid) {
      showSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => {
        window.location.href = "create_account.html";
      }, 1500);
    }
  });

  // Real-time validation for signup
  const signupEmail = document.getElementById("email");
  const signupPassword = document.getElementById("password");
  const confirmPassword = document.getElementById("confirm-password");

  if (signupEmail) {
    signupEmail.addEventListener("blur", function() {
      clearErrorForField("email");
      const email = this.value.trim();
      if (email && !isValidEmail(email)) {
        showError("email", "Please enter a valid email address.");
      }
    });
    signupEmail.addEventListener("input", () => clearErrorForField("email"));
  }

  if (signupPassword) {
    signupPassword.addEventListener("blur", function() {
      clearErrorForField("password");
      const password = this.value;
      if (password) {
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
          showError("password", "Password requirements:<br>" + passwordErrors.join("<br>"));
        }
      }
    });
    signupPassword.addEventListener("input", () => clearErrorForField("password"));
  }

  if (confirmPassword) {
    confirmPassword.addEventListener("blur", function() {
      clearErrorForField("confirm-password");
      const password = document.getElementById("password").value;
      const confirmPassword = this.value;
      if (password && confirmPassword && password !== confirmPassword) {
        showError("confirm-password", "Passwords do not match.");
      }
    });
    confirmPassword.addEventListener("input", () => clearErrorForField("confirm-password"));
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function() {
  initPasswordToggle();
});

// setup for business info and tax info validation
document.addEventListener('DOMContentLoaded', function() {
    // Toast notification system
    function showToast(title, message, type) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
        
        toast.innerHTML = `
            <i class="bi ${icon} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }

    // Safe element getter with null check
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    }

    // Validation functions
    function validateBusinessName(name) {
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Business name is required' };
        }
        if (name.length < 2) {
            return { isValid: false, message: 'Business name must be at least 2 characters' };
        }
        return { isValid: true, message: '' };
    }

    function validateBusinessType(type) {
        if (!type) {
            return { isValid: false, message: 'Business type is required' };
        }
        return { isValid: true, message: '' };
    }

    function validateAddress(address) {
        if (!address || address.trim() === '') {
            return { isValid: false, message: 'Address is required' };
        }
        if (address.length < 5) {
            return { isValid: false, message: 'Address must be at least 5 characters' };
        }
        return { isValid: true, message: '' };
    }

    function validatePhone(phone) {
        if (!phone || phone.trim() === '') {
            return { isValid: false, message: 'Phone number is required' };
        }
        // Simple phone validation
        const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            return { isValid: false, message: 'Please enter a valid phone number' };
        }
        return { isValid: true, message: '' };
    }

    function validateOwnerName(name) {
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Owner name is required' };
        }
        if (name.length < 2) {
            return { isValid: false, message: 'Owner name must be at least 2 characters' };
        }
        return { isValid: true, message: '' };
    }

    function validateTaxRate(rate) {
        if (!rate || rate === '') {
            return { isValid: false, message: 'Tax rate is required' };
        }
        const numRate = parseFloat(rate);
        if (isNaN(numRate) || numRate < 0 || numRate > 100) {
            return { isValid: false, message: 'Tax rate must be between 0 and 100' };
        }
        return { isValid: true, message: '' };
    }

    function validateTaxName(name) {
        if (!name || name.trim() === '') {
            return { isValid: false, message: 'Tax name is required' };
        }
        return { isValid: true, message: '' };
    }

    // Safe update validation status for a form group
    function updateValidationStatus(groupId, isValid, message) {
        const group = getElement(groupId);
        const messageEl = getElement(`${groupId}-message`);
        
        if (!group || !messageEl) {
            return;
        }
        
        group.classList.remove('error', 'success');
        messageEl.className = 'validation-message';
        
        if (isValid) {
            group.classList.add('success');
            messageEl.textContent = message || '';
            messageEl.classList.add('success');
        } else {
            group.classList.add('error');
            messageEl.textContent = message || '';
            messageEl.classList.add('error');
        }
    }

    // Check if all fields in a section are valid
    function isBusinessSectionValid() {
        const nameInput = getElement('business-name');
        const typeInput = getElement('business-type');
        const addressInput = getElement('business-address');
        const phoneInput = getElement('business-phone');
        const ownerInput = getElement('business-owner');
        
        // Check if elements exist before validating
        if (!nameInput || !typeInput || !addressInput || !phoneInput || !ownerInput) {
            return false;
        }
        
        const nameValid = validateBusinessName(nameInput.value).isValid;
        const typeValid = validateBusinessType(typeInput.value).isValid;
        const addressValid = validateAddress(addressInput.value).isValid;
        const phoneValid = validatePhone(phoneInput.value).isValid;
        const ownerValid = validateOwnerName(ownerInput.value).isValid;
        
        return nameValid && typeValid && addressValid && phoneValid && ownerValid;
    }

    function isTaxSectionValid() {
        const rateInput = getElement('tax-rate');
        const nameInput = getElement('tax-name');
        
        // Check if elements exist before validating
        if (!rateInput || !nameInput) {
            return false;
        }
        
        const rateValid = validateTaxRate(rateInput.value).isValid;
        const nameValid = validateTaxName(nameInput.value).isValid;
        
        return rateValid && nameValid;
    }

    // Initialize only if the required elements exist
    function initializeBusinessSection() {
        const businessEditToggle = getElement('business-edit-toggle');
        const businessSaveBtn = getElement('business-save');
        const businessCancelBtn = getElement('business-cancel');
        const businessInputs = document.querySelectorAll('#business-name, #business-type, #business-address, #business-phone, #business-owner');
        
        if (!businessEditToggle || !businessSaveBtn || !businessCancelBtn || businessInputs.length === 0) {
            console.log('Business section not found - skipping initialization');
            return;
        }
        
        const originalBusinessValues = {};
        
        // Store original values
        businessInputs.forEach(input => {
            originalBusinessValues[input.id] = input.value;
        });
        
        businessEditToggle.addEventListener('click', function() {
            const isEditing = businessInputs[0].disabled;
            
            // Toggle disabled state
            businessInputs.forEach(input => {
                input.disabled = !isEditing;
            });
            
            // Toggle save and cancel buttons visibility
            businessSaveBtn.style.display = isEditing ? 'block' : 'none';
            businessCancelBtn.style.display = isEditing ? 'block' : 'none';
            
            // Change icon
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isEditing ? 'bi bi-x-lg' : 'bi bi-pencil-square';
            }
            
            // If canceling edit, reset to original values
            if (!isEditing) {
                businessInputs.forEach(input => {
                    input.value = originalBusinessValues[input.id];
                });
                
                // Clear validation messages
                const validationGroups = ['business-name-group', 'business-type-group', 'business-address-group', 'business-phone-group', 'business-owner-group'];
                validationGroups.forEach(groupId => {
                    const group = getElement(groupId);
                    const messageEl = getElement(`${groupId}-message`);
                    if (group && messageEl) {
                        group.classList.remove('error', 'success');
                        messageEl.textContent = '';
                        messageEl.className = 'validation-message';
                    }
                });
                
                // Disable save button
                businessSaveBtn.disabled = true;
            }
        });
        
        // Add validation on input for business section
        businessInputs.forEach(input => {
            input.addEventListener('input', function() {
                let validationResult;
                
                switch(this.id) {
                    case 'business-name':
                        validationResult = validateBusinessName(this.value);
                        updateValidationStatus('business-name-group', validationResult.isValid, validationResult.message);
                        break;
                    case 'business-type':
                        validationResult = validateBusinessType(this.value);
                        updateValidationStatus('business-type-group', validationResult.isValid, validationResult.message);
                        break;
                    case 'business-address':
                        validationResult = validateAddress(this.value);
                        updateValidationStatus('business-address-group', validationResult.isValid, validationResult.message);
                        break;
                    case 'business-phone':
                        validationResult = validatePhone(this.value);
                        updateValidationStatus('business-phone-group', validationResult.isValid, validationResult.message);
                        break;
                    case 'business-owner':
                        validationResult = validateOwnerName(this.value);
                        updateValidationStatus('business-owner-group', validationResult.isValid, validationResult.message);
                        break;
                }
                
                // Update save button state
                businessSaveBtn.disabled = !isBusinessSectionValid();
            });
        });
        
        businessSaveBtn.addEventListener('click', function() {
            if (isBusinessSectionValid()) {
                // In a real app, you would save the data to the server here
                showToast('Success', 'Business information saved successfully!', 'success');
                
                // Update original values
                businessInputs.forEach(input => {
                    originalBusinessValues[input.id] = input.value;
                });
                
                // Disable inputs and hide buttons
                businessInputs.forEach(input => {
                    input.disabled = true;
                });
                businessSaveBtn.style.display = 'none';
                businessCancelBtn.style.display = 'none';
                
                // Reset icon
                const icon = businessEditToggle.querySelector('i');
                if (icon) {
                    icon.className = 'bi bi-pencil-square';
                }
            } else {
                showToast('Error', 'Please fix validation errors before saving', 'error');
            }
        });
        
        businessCancelBtn.addEventListener('click', function() {
            // Reset to original values
            businessInputs.forEach(input => {
                input.value = originalBusinessValues[input.id];
            });
            
            // Disable inputs and hide buttons
            businessInputs.forEach(input => {
                input.disabled = true;
            });
            businessSaveBtn.style.display = 'none';
            businessCancelBtn.style.display = 'none';
            
            // Reset icon
            const icon = businessEditToggle.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-pencil-square';
            }
            
            // Clear validation messages
            const validationGroups = ['business-name-group', 'business-type-group', 'business-address-group', 'business-phone-group', 'business-owner-group'];
            validationGroups.forEach(groupId => {
                const group = getElement(groupId);
                const messageEl = getElement(`${groupId}-message`);
                if (group && messageEl) {
                    group.classList.remove('error', 'success');
                    messageEl.textContent = '';
                    messageEl.className = 'validation-message';
                }
            });
        });
    }

    function initializeTaxSection() {
        const taxEditToggle = getElement('tax-edit-toggle');
        const taxSaveBtn = getElement('tax-save');
        const taxCancelBtn = getElement('tax-cancel');
        const taxInputs = document.querySelectorAll('#tax-rate, #tax-name');
        const taxCheckbox = getElement('tax-inclusive');
        
        if (!taxEditToggle || !taxSaveBtn || !taxCancelBtn || taxInputs.length === 0 || !taxCheckbox) {
            console.log('Tax section not found - skipping initialization');
            return;
        }
        
        const originalTaxValues = {
            'tax-rate': getElement('tax-rate').value,
            'tax-name': getElement('tax-name').value,
            'tax-inclusive': getElement('tax-inclusive').checked
        };
        
        taxEditToggle.addEventListener('click', function() {
            const isEditing = taxInputs[0].disabled;
            
            // Toggle disabled state
            taxInputs.forEach(input => {
                input.disabled = !isEditing;
            });
            taxCheckbox.disabled = !isEditing;
            
            // Toggle save and cancel buttons visibility
            taxSaveBtn.style.display = isEditing ? 'block' : 'none';
            taxCancelBtn.style.display = isEditing ? 'block' : 'none';
            
            // Change icon
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isEditing ? 'bi bi-x-lg' : 'bi bi-pencil-square';
            }
            
            // If canceling edit, reset to original values
            if (!isEditing) {
                getElement('tax-rate').value = originalTaxValues['tax-rate'];
                getElement('tax-name').value = originalTaxValues['tax-name'];
                taxCheckbox.checked = originalTaxValues['tax-inclusive'];
                
                // Clear validation messages
                const validationGroups = ['tax-rate-group', 'tax-name-group'];
                validationGroups.forEach(groupId => {
                    const group = getElement(groupId);
                    const messageEl = getElement(`${groupId}-message`);
                    if (group && messageEl) {
                        group.classList.remove('error', 'success');
                        messageEl.textContent = '';
                        messageEl.className = 'validation-message';
                    }
                });
                
                // Disable save button
                taxSaveBtn.disabled = true;
            }
        });
        
        // Add validation on input for tax section
        taxInputs.forEach(input => {
            input.addEventListener('input', function() {
                let validationResult;
                
                switch(this.id) {
                    case 'tax-rate':
                        validationResult = validateTaxRate(this.value);
                        updateValidationStatus('tax-rate-group', validationResult.isValid, validationResult.message);
                        break;
                    case 'tax-name':
                        validationResult = validateTaxName(this.value);
                        updateValidationStatus('tax-name-group', validationResult.isValid, validationResult.message);
                        break;
                }
                
                // Update save button state
                taxSaveBtn.disabled = !isTaxSectionValid();
            });
        });
        
        taxSaveBtn.addEventListener('click', function() {
            if (isTaxSectionValid()) {
                // In a real app, you would save the data to the server here
                showToast('Success', 'Tax settings saved successfully!', 'success');
                
                // Update original values
                originalTaxValues['tax-rate'] = getElement('tax-rate').value;
                originalTaxValues['tax-name'] = getElement('tax-name').value;
                originalTaxValues['tax-inclusive'] = taxCheckbox.checked;
                
                // Disable inputs and hide buttons
                taxInputs.forEach(input => {
                    input.disabled = true;
                });
                taxCheckbox.disabled = true;
                taxSaveBtn.style.display = 'none';
                taxCancelBtn.style.display = 'none';
                
                // Reset icon
                const icon = taxEditToggle.querySelector('i');
                if (icon) {
                    icon.className = 'bi bi-pencil-square';
                }
            } else {
                showToast('Error', 'Please fix validation errors before saving', 'error');
            }
        });
        
        taxCancelBtn.addEventListener('click', function() {
            // Reset to original values
            getElement('tax-rate').value = originalTaxValues['tax-rate'];
            getElement('tax-name').value = originalTaxValues['tax-name'];
            taxCheckbox.checked = originalTaxValues['tax-inclusive'];
            
            // Disable inputs and hide buttons
            taxInputs.forEach(input => {
                input.disabled = true;
            });
            taxCheckbox.disabled = true;
            taxSaveBtn.style.display = 'none';
            taxCancelBtn.style.display = 'none';
            
            // Reset icon
            const icon = taxEditToggle.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-pencil-square';
            }
            
            // Clear validation messages
            const validationGroups = ['tax-rate-group', 'tax-name-group'];
            validationGroups.forEach(groupId => {
                const group = getElement(groupId);
                const messageEl = getElement(`${groupId}-message`);
                if (group && messageEl) {
                    group.classList.remove('error', 'success');
                    messageEl.textContent = '';
                    messageEl.className = 'validation-message';
                }
            });
        });
    }

    function initializePermissionsSection() {
        const permissionsEditToggle = getElement('permissions-edit-toggle');
        const permissionsSaveBtn = getElement('permissions-save');
        const permissionsCancelBtn = getElement('permissions-cancel');
        const permissionInputs = document.querySelectorAll('.permissions-table input');
        
        if (!permissionsEditToggle || !permissionsSaveBtn || !permissionsCancelBtn || permissionInputs.length === 0) {
            console.log('Permissions section not found - skipping initialization');
            return;
        }
        
        const originalPermissionValues = [];
        
        // Store original values
        permissionInputs.forEach((input, index) => {
            originalPermissionValues[index] = input.checked;
        });
        
        permissionsEditToggle.addEventListener('click', function() {
            const isEditing = permissionInputs[0].disabled;
            
            // Toggle disabled state
            permissionInputs.forEach(input => {
                input.disabled = !isEditing;
            });
            
            // Toggle save and cancel buttons visibility
            permissionsSaveBtn.style.display = isEditing ? 'block' : 'none';
            permissionsCancelBtn.style.display = isEditing ? 'block' : 'none';
            
            // Change icon
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isEditing ? 'bi bi-x-lg' : 'bi bi-pencil-square';
            }
            
            // If canceling edit, reset to original values
            if (!isEditing) {
                permissionInputs.forEach((input, index) => {
                    input.checked = originalPermissionValues[index];
                });
            }
        });
        
        permissionsSaveBtn.addEventListener('click', function() {
            // In a real app, you would save the data to the server here
            showToast('Success', 'Permissions saved successfully!', 'success');
            
            // Update original values
            permissionInputs.forEach((input, index) => {
                originalPermissionValues[index] = input.checked;
            });
            
            // Disable inputs and hide buttons
            permissionInputs.forEach(input => {
                input.disabled = true;
            });
            permissionsSaveBtn.style.display = 'none';
            permissionsCancelBtn.style.display = 'none';
            
            // Reset icon
            const icon = permissionsEditToggle.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-pencil-square';
            }
        });
        
        permissionsCancelBtn.addEventListener('click', function() {
            // Reset to original values
            permissionInputs.forEach((input, index) => {
                input.checked = originalPermissionValues[index];
            });
            
            // Disable inputs and hide buttons
            permissionInputs.forEach(input => {
                input.disabled = true;
            });
            permissionsSaveBtn.style.display = 'none';
            permissionsCancelBtn.style.display = 'none';
            
            // Reset icon
            const icon = permissionsEditToggle.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-pencil-square';
            }
        });
    }

    // Initialize all sections
    initializeBusinessSection();
    initializeTaxSection();
    initializePermissionsSection();
});