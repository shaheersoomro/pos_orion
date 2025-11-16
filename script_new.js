// ============================================
// ORION POS - Modern JavaScript
// ============================================

// Product Data
const products = [
    { id: 1, name: 'Espresso', price: 3.50, category: 'coffee', icon: '☕' },
    { id: 2, name: 'Latte', price: 4.50, category: 'coffee', icon: '☕' },
    { id: 3, name: 'Cappuccino', price: 4.50, category: 'coffee', icon: '☕' },
    { id: 4, name: 'Americano', price: 3.00, category: 'coffee', icon: '☕' },
    { id: 5, name: 'Sandwich', price: 7.99, category: 'food', icon: '🥪' },
    { id: 6, name: 'Burger', price: 9.99, category: 'food', icon: '🍔' },
    { id: 7, name: 'Salad', price: 8.99, category: 'food', icon: '🥗' },
    { id: 8, name: 'Pizza', price: 12.99, category: 'food', icon: '🍕' },
    { id: 9, name: 'Haircut', price: 25.00, category: 'services', icon: '✂️' },
    { id: 10, name: 'Hair Wash', price: 15.00, category: 'services', icon: '🧴' },
    { id: 11, name: 'Massage', price: 50.00, category: 'services', icon: '💆' },
    { id: 12, name: 'Manicure', price: 20.00, category: 'services', icon: '💅' }
];

// Cart State
let cart = [];
let currentFilter = 'all';

// Tax Rate
const TAX_RATE = 0.08;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeProducts();
    setupEventListeners();
    updateOrderTime();
    setInterval(updateOrderTime, 1000);
});

// ============================================
// PRODUCT MANAGEMENT
// ============================================

function initializeProducts() {
    renderProducts(products);
}

function renderProducts(productsToRender) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    productsToRender.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-icon">${product.icon}</div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">$${product.price.toFixed(2)}</div>
        `;
        card.addEventListener('click', () => addToCart(product));
        grid.appendChild(card);
    });
}

function filterProducts(category) {
    currentFilter = category;
    const filtered = category === 'all' 
        ? products 
        : products.filter(p => p.category === category);
    renderProducts(filtered);
}

// ============================================
// CART MANAGEMENT
// ============================================

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    updateCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function updateItemQuantity(productId, quantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, quantity);
        updateCart();
    }
}

function updateCart() {
    renderCartItems();
    updateTotals();
}

function renderCartItems() {
    const itemsContainer = document.getElementById('order-items');
    
    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <p>No items added</p>
            </div>
        `;
        return;
    }
    
    itemsContainer.innerHTML = cart.map(item => `
        <div class="order-item">
            <div class="item-info">
                <div class="item-name">${item.name}</div>
                <div class="item-qty">Qty: ${item.quantity}</div>
            </div>
            <div class="item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `).join('');
}

function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    
    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
    document.getElementById('modal-total').textContent = `$${total.toFixed(2)}`;
}

// ============================================
// ORDER MANAGEMENT
// ============================================

function cancelOrder() {
    if (cart.length === 0) {
        alert('No items to cancel');
        return;
    }
    
    if (confirm('Are you sure you want to cancel this order?')) {
        cart = [];
        updateCart();
    }
}

function updateOrderTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    const orderTimeEl = document.querySelector('.order-time');
    if (orderTimeEl) {
        orderTimeEl.textContent = timeString;
    }
}

// ============================================
// PAYMENT MANAGEMENT
// ============================================

function openPaymentModal() {
    if (cart.length === 0) {
        alert('Please add items to the cart first');
        return;
    }
    
    document.getElementById('amount-received').value = '';
    document.getElementById('change-display').style.display = 'none';
    
    const paymentModal = new bootstrap.Modal(document.getElementById('paymentModal'));
    paymentModal.show();
}



function setupPaymentListeners() {
    const amountInput = document.getElementById('amount-received');
    const changeDisplay = document.getElementById('change-display');
    const changeAmount = document.getElementById('change-amount');
    
    const totalAmount = parseFloat(document.getElementById('total').textContent.replace('$', ''));
    
    amountInput.addEventListener('input', () => {
        const amount = parseFloat(amountInput.value) || 0;
        
        if (amount >= totalAmount) {
            const change = amount - totalAmount;
            changeAmount.textContent = `$${change.toFixed(2)}`;
            changeDisplay.style.display = 'flex';
        } else {
            changeDisplay.style.display = 'none';
        }
    });
}

function completePayment() {
    const totalAmount = parseFloat(document.getElementById('total').textContent.replace('$', ''));
    const amountReceived = parseFloat(document.getElementById('amount-received').value) || 0;
    
    if (amountReceived < totalAmount) {
        alert('Insufficient payment amount');
        return;
    }
    
    const completeModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('completeModal'));
    completeModal.show();
    
    // Reset
    cart = [];
    updateCart();
    
    // Close modal
    const paymentModal = bootstrap.Modal.getInstance(document.getElementById('paymentModal'));
    paymentModal.hide();

        // Close modal
    
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Category filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterProducts(e.target.dataset.category);
        });
    });
    
    // Search
    document.getElementById('product-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = products.filter(p => 
            p.name.toLowerCase().includes(query) && 
            (currentFilter === 'all' || p.category === currentFilter)
        );
        renderProducts(filtered);
    });
    
    // Order actions
    document.getElementById('btn-cancel').addEventListener('click', cancelOrder);
    document.getElementById('btn-payment').addEventListener('click', openPaymentModal);
    
    // Payment modal
    document.getElementById('btn-complete-payment').addEventListener('click', completePayment);
    
    // Payment method selection
    document.querySelectorAll('.payment-method').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.payment-method').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
    
    // Payment input listeners
    setupPaymentListeners();
}
