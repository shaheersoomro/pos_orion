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

document.querySelectorAll(".toggle-password").forEach(toggle => {
    toggle.addEventListener("click", function () {
        // Find the password input within the same container
        const passwordContainer = this.closest('.password-container');
        const passwordInput = passwordContainer.querySelector('input[type="password"], input[type="text"]');
        
        // Toggle the input type
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        
        // Update the icon and aria-label
        const icon = this.querySelector("i");
        if (type === "text") {
            icon.classList.remove("bi-eye");
            icon.classList.add("bi-eye-slash");
            this.setAttribute("aria-label", "Hide password");
        } else {
            icon.classList.remove("bi-eye-slash");
            icon.classList.add("bi-eye");
            this.setAttribute("aria-label", "Show password");
        }
    });
});