// ============================================
// RECEIPT PRINTING SYSTEM - Thermal Printer Support
// ============================================

// Initialize business settings globally
window.businessSettings = window.businessSettings || {
  name: "ORION POS SYSTEM",
  address: "123 Business Street\nCity, State 12345",
  phone: "(555) 123-4567",
  email: "support@orionpos.com",
  taxSettings: {enabled: true, rate: 10, taxName: "Tax", taxInclusive: true, registeredTaxId: "1234567890"},
  footer: "Thank you for your purchase!",
};

// Function to update business settings from backend
function updateBusinessSettings(settings) {
  window.businessSettings = {
    ...window.businessSettings,
    ...settings,
  };
  console.log("Business settings updated:", window.businessSettings);
}

// Generate receipt HTML for printing
function generateReceiptHTML(transactionData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Get store settings
  const business = window.businessSettings || {
    name: "ORION POS SYSTEM",
    address: "123 Business Street\nCity, State 12345",
    phone: "(555) 123-4567",
    email: "support@orionpos.com",
    taxSettings: { enabled: true, rate: 10, taxName: "Tax", taxInclusive: true, registeredTaxId: "1234567890" },
    footer: "Thank you for your purchase!",
  };

  // Get tax settings from business object
  const taxSettings = business.taxSettings || { 
    enabled: true, 
    rate: 10, 
    taxName: "Tax", 
    taxInclusive: true, 
    registeredTaxId: "1234567890" 
  };

  console.log("Transaction data:", transactionData);

  // Build items table
  let itemsHTML = "";
  if (transactionData.items && transactionData.items.length > 0) {
    transactionData.items.forEach((item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      itemsHTML += `
            <div class="receipt-item">
                <div class="receipt-item-name">${escapeHtml(item.name || 'Unknown Item')}</div>
                <div class="receipt-item-details">
                    ${item.quantity || 0} x $${(item.price || 0).toFixed(2)} = $${itemTotal.toFixed(2)}
                </div>
            </div>
        `;
    });
  }

  // Build discounts section - FIXED: Check the correct data structure
  let discountsHTML = "";
  
  // Check for discountsApplied array (from your transaction structure)
  if (transactionData.discountsApplied && transactionData.discountsApplied.length > 0) {
    transactionData.discountsApplied.forEach((discount) => {
      const discountedAmount = discount.discountedAmount || discount.amount || 0;
      discountsHTML += `
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>${escapeHtml(discount.discountName || discount.name || 'Discount')}</span>
                    <span>-$${discountedAmount.toFixed(2)}</span>
                </div>
            `;
    });
  }
  // Alternative: Check for appliedDiscounts array
  else if (transactionData.appliedDiscounts && transactionData.appliedDiscounts.length > 0) {
    transactionData.appliedDiscounts.forEach((discount) => {
      const discountedAmount = discount.discountedAmount || discount.amount || 0;
      discountsHTML += `
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>${escapeHtml(discount.discountName || discount.name || 'Discount')}</span>
                    <span>-$${discountedAmount.toFixed(2)}</span>
                </div>
            `;
    });
  }

  // Get order number - use transaction ID if available
  const orderNumber = transactionData.transactionId || 
    document.getElementById("order-number")?.textContent || 
    "0001";

  return `
        <div class="receipt" id="print-receipt-area">
            <div class="receipt-header">
                <div class="receipt-title">${escapeHtml(business.name)}</div>
                <div class="receipt-store-info">${(business.address || "").replace(/\n/g, "<br>")}</div>
                <div class="receipt-store-info">Tel: ${business.phone || "N/A"}</div>
                ${business.email ? `<div class="receipt-store-info">${business.email}</div>` : ""}
                ${taxSettings.registeredTaxId ? `<div class="receipt-store-info">Tax ID: ${taxSettings.registeredTaxId}</div>` : ""}
                <div class="receipt-divider"></div>
                <div class="receipt-store-info">
                    Transaction #: ${orderNumber}<br>
                    Date: ${dateStr}<br>
                    Time: ${timeStr}<br>
                    Cashier: ${transactionData.cashier?.fullName || getCurrentUser()}
                </div>
            </div>
            
            <div class="receipt-divider"></div>
            
            <div class="receipt-items">
                <strong>ITEMS</strong>
                ${itemsHTML}
            </div>
            
            <div class="receipt-divider"></div>
            
            <div class="receipt-summary">
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>$${(transactionData.subtotal || 0).toFixed(2)}</span>
                </div>
                ${discountsHTML ? `<div style="margin-top: 5px;">${discountsHTML}</div>` : ""}
                ${transactionData.discount > 0 && !discountsHTML ? `
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span>Discount:</span>
                    <span>-$${(transactionData.discount || 0).toFixed(2)}</span>
                </div>
                ` : ""}
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span>${taxSettings.taxName} ${taxSettings.taxInclusive ? '(Incl.)' : ''} (${transactionData.taxRate || taxSettings.rate}%):</span>
                    <span>$${(transactionData.tax || 0).toFixed(2)}</span>
                </div>
                <div class="receipt-total" style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 5px; border-top: 1px dashed #000;">
                    <span>TOTAL:</span>
                    <span>$${(transactionData.total || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span>Payment:</span>
                    <span>${(transactionData.paymentMethod || "N/A").toUpperCase()}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Amount Paid:</span>
                    <span>$${(transactionData.amountPaid || transactionData.total || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Change:</span>
                    <span>$${(transactionData.change || 0).toFixed(2)}</span>
                </div>
            </div>
            
            <div class="receipt-footer">
                <div class="qr-code">
                    ${generateSimpleBarcode(orderNumber)}
                </div>
                <div>${escapeHtml(business.footer || "Thank you for your purchase!")}</div>
                <div>★★★★★</div>
                <div>Please come again</div>
                <div class="receipt-divider"></div>
                <div style="font-size: 10px;">
                    Return policy: 30 days with receipt<br>
                    Support: ${business.email || "support@orionpos.com"}
                </div>
            </div>
        </div>
    `;
}

// Generate simple barcode representation
function generateSimpleBarcode(orderNumber) {
  const barcodeChars = orderNumber.padStart(6, "0").split("");
  let barcode = "";
  barcodeChars.forEach((char) => {
    const num = parseInt(char);
    barcode += "|".repeat(num + 1) + " ";
  });
  return `<div style="font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 2px;">${barcode}</div><div>${orderNumber}</div>`;
}

// Escape HTML special characters
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Get current user name
function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.fullName || "Staff";
  } catch {
    return "Staff";
  }
}

// Print receipt with options
async function printReceipt(transactionData) {
  return new Promise((resolve, reject) => {
    // Show print options modal
    const printModal = new bootstrap.Modal(
      document.getElementById("printReceiptModal"),
    );

    // Store transaction data for printing
    window.currentReceiptData = transactionData;

    printModal.show();

    // Handle print confirmation
    const confirmBtn = document.getElementById("confirm-print-btn");
    const handlePrint = async () => {
      const printerType = document.getElementById("printer-type").value;
      const copies =
        parseInt(document.getElementById("print-copies").value) || 1;

      confirmBtn.removeEventListener("click", handlePrint);

      try {
        await executePrint(transactionData, printerType, copies);
        printModal.hide();
        resolve(true);
      } catch (error) {
        console.error("Print error:", error);
        if (typeof showToast === "function") {
          showToast("Failed to print receipt: " + error.message, "error");
        }
        reject(error);
      }
    };

    confirmBtn.addEventListener("click", handlePrint);

    // Clean up modal hidden event
    const modalElement = printModal._element;
    modalElement.addEventListener(
      "hidden.bs.modal",
      () => {
        confirmBtn.removeEventListener("click", handlePrint);
      },
      { once: true },
    );
  });
}

// Execute the actual printing
async function executePrint(transactionData, printerType, copies) {
  const receiptHTML = generateReceiptHTML(transactionData);

  // Create iframe for printing
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow.document;

  // Write content to iframe
  iframeDoc.open();
  iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Receipt</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                }
                ${
                  printerType === "thermal"
                    ? `
                    @page {
                        size: 80mm auto;
                        margin: 0mm;
                    }
                    body {
                        width: 80mm;
                        margin: 0 auto;
                    }
                `
                    : `
                    @page {
                        size: auto;
                        margin: 10mm;
                    }
                `
                }
                .receipt {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    padding: ${printerType === "thermal" ? "8px" : "20px"};
                    width: 100%;
                }
                .receipt-header {
                    text-align: center;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px dashed #000;
                }
                .receipt-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .receipt-store-info {
                    font-size: 10px;
                    margin-bottom: 5px;
                    white-space: pre-line;
                }
                .receipt-divider {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }
                .receipt-items {
                    margin: 10px 0;
                }
                .receipt-item {
                    margin-bottom: 4px;
                }
                .receipt-item-name {
                    font-weight: bold;
                }
                .receipt-item-details {
                    font-size: 10px;
                    margin-left: 5px;
                }
                .receipt-summary {
                    margin: 10px 0;
                    padding-top: 8px;
                    border-top: 1px dashed #000;
                }
                .receipt-total {
                    font-size: 14px;
                    font-weight: bold;
                    margin: 5px 0;
                }
                .receipt-footer {
                    text-align: center;
                    margin-top: 10px;
                    padding-top: 8px;
                    border-top: 1px dashed #000;
                    font-size: 10px;
                }
                .qr-code {
                    text-align: center;
                    margin: 10px 0;
                    font-family: monospace;
                }
            </style>
        </head>
        <body>
            ${receiptHTML}
        </body>
        </html>
    `);
  iframeDoc.close();

  // Wait for content to load
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Print multiple copies
  for (let i = 0; i < copies; i++) {
    iframe.contentWindow.print();
    if (i < copies - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Remove iframe after printing
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 2000);

  if (typeof showToast === "function") {
    showToast(`Receipt printed (${copies} copy/copies)`, "success");
  } else {
    console.log(`Receipt printed (${copies} copies)`);
  }
}

// Initialize printer settings
function initPrinterSettings() {
  if (!localStorage.getItem("printerSettings")) {
    const defaultSettings = {
      autoPrint: true,
      printerType: "thermal",
      copies: 1,
      paperSize: "80mm",
    };
    localStorage.setItem("printerSettings", JSON.stringify(defaultSettings));
  }
}

// Auto-print with saved settings
async function printReceiptAuto(transactionData) {
  const settings = JSON.parse(localStorage.getItem("printerSettings") || "{}");
  if (settings.autoPrint) {
    await executePrint(
      transactionData,
      settings.printerType || "thermal",
      settings.copies || 1,
    );
    return true;
  }
  return false;
}

// Test printer connection
async function testPrinterConnection() {
  try {
    // Test print using browser print
    const testWindow = window.open("", "_blank");
    testWindow.document.write(`
            <html>
            <head>
                <style>
                    @page { size: 80mm auto; margin: 0mm; }
                    body { 
                        font-family: monospace; 
                        padding: 10px;
                        width: 80mm;
                    }
                </style>
            </head>
            <body>
                <div style="text-align: center;">
                    <h3>ORION POS</h3>
                    <p>Printer Test</p>
                    <p>${new Date().toLocaleString()}</p>
                    <hr>
                    <p>If you can read this, your printer is working correctly!</p>
                    <p>★★★★★</p>
                </div>
            </body>
            </html>
        `);
    testWindow.print();
    testWindow.close();

    if (typeof showToast === "function") {
      showToast("Printer test initiated", "info");
    }
    return true;
  } catch (error) {
    console.error("Printer test failed:", error);
    if (typeof showToast === "function") {
      showToast("Printer not available: " + error.message, "error");
    }
    return false;
  }
}

// Export functions for use in main file (if using modules)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateReceiptHTML,
    printReceipt,
    executePrint,
    initPrinterSettings,
    printReceiptAuto,
    testPrinterConnection,
  };
}
