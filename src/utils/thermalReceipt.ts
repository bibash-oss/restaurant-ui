export interface ReceiptAddon {
  name: string;
  price: number;
  quantity?: number;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  addons?: ReceiptAddon[];
}

export interface ReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  orderId: string;
  tableName: string;
  createdAt?: string | Date;
  items: ReceiptItem[];
  totalAmount: number;
  notes?: string;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateReceiptHtml(data: ReceiptData): string {
  const formattedDate = new Date(data.createdAt || Date.now()).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const orderIdShort =
    data.orderId.length > 8 ? data.orderId.slice(0, 8).toUpperCase() : data.orderId.toUpperCase();

  const itemsHtml = data.items
    .map((item) => {
      const lineTotal = (item.quantity * item.price).toFixed(2);
      const unitPrice = item.price.toFixed(2);
      const addonsHtml =
        item.addons && item.addons.length > 0
          ? `<div class="addon-line">${item.addons
              .map(
                (a) =>
                  `+ ${a.quantity && a.quantity > 1 ? `${a.quantity}x ` : ""}${escapeHtml(a.name)} ($${(a.price * (a.quantity || 1)).toFixed(2)})`
              )
              .join("<br/>")}</div>`
          : "";

      return `
        <tr>
          <td class="col-qty">${item.quantity}x</td>
          <td class="col-name">
            <span class="item-name">${escapeHtml(item.name)}</span>
            ${addonsHtml}
          </td>
          <td class="col-price">$${unitPrice}</td>
          <td class="col-total">$${lineTotal}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - Order #${orderIdShort}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 80mm;
              margin: 0;
              padding: 0;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            width: 72mm;
            margin: 0 auto;
            padding: 5mm 2mm 0 2mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000000;
            background-color: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }

          .restaurant-header {
            text-align: center;
            margin-bottom: 4px;
          }
          .restaurant-title {
            font-size: 17px;
            font-weight: bold;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
          }
          .restaurant-sub {
            font-size: 11px;
            margin: 0 0 2px 0;
          }

          .dashed-divider {
            border-top: 1px dashed #000000;
            margin: 6px 0;
            width: 100%;
          }
          .double-divider {
            border-top: 2px solid #000000;
            margin: 6px 0;
            width: 100%;
          }

          .order-meta {
            font-size: 11px;
            margin: 4px 0;
          }
          .order-meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }

          .ticket-badge {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            padding: 2px 0;
            margin: 4px 0;
            letter-spacing: 0.5px;
          }

          table.receipt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 4px;
          }
          table.receipt-table th {
            text-align: left;
            border-bottom: 1px dashed #000000;
            padding: 4px 0;
            font-size: 10px;
            font-weight: bold;
          }
          table.receipt-table td {
            padding: 4px 0;
            vertical-align: top;
          }

          .col-qty { width: 14%; text-align: left; font-weight: bold; }
          .col-name { width: 48%; text-align: left; word-break: break-word; }
          .col-price { width: 19%; text-align: right; }
          .col-total { width: 19%; text-align: right; font-weight: bold; }

          .item-name { font-weight: bold; }
          .addon-line {
            font-size: 10px;
            color: #333333;
            margin-top: 1px;
          }

          .totals-section {
            margin-top: 4px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 15px;
            font-weight: bold;
            padding: 4px 0;
          }

          .receipt-footer {
            text-align: center;
            font-size: 11px;
            margin-top: 8px;
            line-height: 1.4;
          }

          /* 22mm paper feed margin so thermal auto-cutter does not clip text */
          .paper-feed {
            height: 22mm;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="restaurant-header">
          <div class="restaurant-title uppercase">${escapeHtml(data.restaurantName)}</div>
          ${data.restaurantAddress ? `<div class="restaurant-sub">${escapeHtml(data.restaurantAddress)}</div>` : ""}
          <div class="restaurant-sub">*** CUSTOMER RECEIPT ***</div>
        </div>

        <div class="dashed-divider"></div>

        <div class="ticket-badge uppercase">
          TABLE: ${escapeHtml(data.tableName)}
        </div>

        <div class="dashed-divider"></div>

        <div class="order-meta">
          <div class="order-meta-row">
            <span>ORDER #:</span>
            <span class="bold">${orderIdShort}</span>
          </div>
          <div class="order-meta-row">
            <span>DATE:</span>
            <span>${formattedDate}</span>
          </div>
        </div>

        <div class="dashed-divider"></div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th class="col-qty">QTY</th>
              <th class="col-name">ITEM</th>
              <th class="col-price text-right">PRICE</th>
              <th class="col-total text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="dashed-divider"></div>

        <div class="totals-section">
          <div class="total-row">
            <span>TOTAL AMOUNT:</span>
            <span>$${data.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        ${
          data.notes
            ? `
          <div class="dashed-divider"></div>
          <div style="font-size: 11px; margin: 5px 0;">
            <div class="bold">SPECIAL NOTES:</div>
            <div>${escapeHtml(data.notes)}</div>
          </div>
        `
            : ""
        }

        <div class="double-divider"></div>

        <div class="receipt-footer">
          <div class="bold">THANK YOU FOR DINING WITH US!</div>
          <div>Please retain this receipt for your reference.</div>
        </div>

        <!-- Thermal cutter safety margin -->
        <div class="paper-feed"></div>
      </body>
    </html>
  `;
}

import { buildEscPosReceipt } from "./escpos";
import { getActivePrinter, printDirectToUsb } from "./usbPrinter";
import { getLanPrinterConfig, printDirectToLan } from "./lanPrinter";

export async function printThermalReceipt(data: ReceiptData): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. Priority 1: Network / LAN thermal printer (e.g. 192.168.1.45:9100)
  const lanConfig = getLanPrinterConfig();
  if (lanConfig.enabled && lanConfig.ip) {
    try {
      const escposData = buildEscPosReceipt(data);
      const ok = await printDirectToLan(escposData, lanConfig.ip, lanConfig.port);
      if (ok) {
        return true;
      }
    } catch (e) {
      console.warn("LAN print failed, falling back to other methods:", e);
    }
  }

  // 2. Priority 2: Direct USB printer if plugged in
  const usbPrinter = getActivePrinter();
  if (usbPrinter) {
    try {
      const escposData = buildEscPosReceipt(data);
      const ok = await printDirectToUsb(escposData);
      if (ok) {
        return true;
      }
    } catch (e) {
      console.warn("Direct USB print failed, falling back to browser print dialog:", e);
    }
  }

  // 3. Fallback: Standard browser print dialog
  const existingIframe = document.getElementById("thermal-receipt-print-frame");
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "thermal-receipt-print-frame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error("Failed to access print iframe document");
    return false;
  }

  const receiptContent = generateReceiptHtml(data);
  doc.open();
  doc.write(receiptContent);
  doc.close();

  // Allow styles and DOM layout to settle before printing
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Auto print failed:", err);
    }
  }, 250);

  return true;
}
