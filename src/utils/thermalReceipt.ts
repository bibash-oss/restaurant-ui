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
  menuType?: "BAR" | "KITCHEN";
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
  stationTitle?: string;
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
      const addonsHtml =
        item.addons && item.addons.length > 0
          ? `<div class="addon-line">${item.addons
              .map(
                (a) =>
                  `+ ${a.quantity && a.quantity > 1 ? `${a.quantity}x ` : ""}${escapeHtml(a.name)}`
              )
              .join("<br/>")}</div>`
          : "";

      return `
        <tr>
          <td class="col-name">
            <span class="item-name">${escapeHtml(item.name)}</span>
            ${addonsHtml}
          </td>
          <td class="col-qty text-right">${item.quantity}x</td>
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

          .col-name { width: 75%; text-align: left; word-break: break-word; }
          .col-qty { width: 25%; text-align: right; font-weight: bold; font-size: 13px; }

          .item-name { font-weight: bold; font-size: 13px; }
          .addon-line {
            font-size: 10px;
            color: #333333;
            margin-top: 1px;
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
          <div class="restaurant-sub">*** ${escapeHtml(data.stationTitle || "CUSTOMER RECEIPT")} ***</div>
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
              <th class="col-name">ITEM</th>
              <th class="col-qty text-right">QTY</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

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
import {
  getDualPrinterConfig,
  getStationPrinterConfig,
  PrinterStation,
  printDirectToLan,
} from "./lanPrinter";

export interface PrintThermalOptions {
  station?: PrinterStation;
  silent?: boolean;
}

function calculateItemsTotal(items: ReceiptItem[]): number {
  return items.reduce((sum, it) => {
    const itemTotal = it.quantity * it.price;
    const addonsTotal = (it.addons || []).reduce(
      (aSum, a) => aSum + a.price * (a.quantity || 1),
      0
    );
    return sum + itemTotal + addonsTotal;
  }, 0);
}

/**
 * Print a station-specific ticket (Kitchen or Bar) directly to that station's printer
 */
export async function printStationTicket(
  data: ReceiptData,
  station: PrinterStation
): Promise<boolean> {
  const stationConfig = getStationPrinterConfig(station);
  if (!stationConfig.enabled || !stationConfig.ip) return false;

  try {
    const filteredItems = data.items.filter((it) => {
      if (station === "bar") return it.menuType === "BAR";
      return it.menuType !== "BAR";
    });

    // If no items for this station, nothing to print
    if (filteredItems.length === 0) return true;

    const stationData: ReceiptData = {
      ...data,
      items: filteredItems,
      totalAmount: calculateItemsTotal(filteredItems),
      stationTitle:
        station === "bar" ? "BAR ORDER TICKET (DRINKS)" : "KITCHEN ORDER TICKET (FOOD)",
    };

    const escposData = buildEscPosReceipt(stationData);
    const ok = await printDirectToLan(escposData, stationConfig.ip, stationConfig.port);
    if (ok) return true;
  } catch (e) {
    console.warn(`LAN print to ${station} station failed:`, e);
  }
  return false;
}

export async function printThermalReceipt(
  data: ReceiptData,
  options?: PrintThermalOptions
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1. If explicit station requested, route directly to that station
  if (options?.station) {
    const ok = await printStationTicket(data, options.station);
    if (ok) return true;
  } else {
    // 2. Dual Station Routing: Check if both or either station is configured
    const { kitchen, bar } = getDualPrinterConfig();
    const isKitchenConfigured = kitchen.enabled && !!kitchen.ip.trim();
    const isBarConfigured = bar.enabled && !!bar.ip.trim();

    const barItems = data.items.filter((it) => it.menuType === "BAR");
    const kitchenItems = data.items.filter((it) => it.menuType !== "BAR");

    // Case A: Both printers configured
    if (isKitchenConfigured && isBarConfigured) {
      const samePrinter =
        kitchen.ip.trim() === bar.ip.trim() && kitchen.port === bar.port;

      // If both Kitchen & Bar point to the exact same printer, print ONE single combined ticket!
      if (samePrinter && (kitchenItems.length > 0 || barItems.length > 0)) {
        try {
          const combinedTicket: ReceiptData = {
            ...data,
            stationTitle: "KITCHEN & BAR ORDER TICKET",
          };
          const escpos = buildEscPosReceipt(combinedTicket);
          const ok = await printDirectToLan(escpos, kitchen.ip, kitchen.port);
          if (ok) return true;
        } catch (e) {
          console.warn("Combined LAN print failed:", e);
        }
      } else {
        // Distinct physical printers: send food to kitchen printer, drinks to bar printer
        let printedAny = false;

        if (kitchenItems.length > 0) {
          const kitchenData: ReceiptData = {
            ...data,
            items: kitchenItems,
            totalAmount: calculateItemsTotal(kitchenItems),
            stationTitle: "KITCHEN ORDER TICKET (FOOD)",
          };
          try {
            const escpos = buildEscPosReceipt(kitchenData);
            const ok = await printDirectToLan(escpos, kitchen.ip, kitchen.port);
            if (ok) printedAny = true;
          } catch (e) {
            console.warn("Failed printing to Kitchen printer:", e);
          }
        }

        if (barItems.length > 0) {
          const barData: ReceiptData = {
            ...data,
            items: barItems,
            totalAmount: calculateItemsTotal(barItems),
            stationTitle: "BAR ORDER TICKET (DRINKS)",
          };
          try {
            const escpos = buildEscPosReceipt(barData);
            const ok = await printDirectToLan(escpos, bar.ip, bar.port);
            if (ok) printedAny = true;
          } catch (e) {
            console.warn("Failed printing to Bar printer:", e);
          }
        }

        if (printedAny) return true;
      }
    }

    // Case B: Only Kitchen printer is configured
    if (isKitchenConfigured && !isBarConfigured) {
      try {
        const ticketData: ReceiptData = {
          ...data,
          stationTitle: data.stationTitle || "KITCHEN ORDER TICKET",
        };
        const escpos = buildEscPosReceipt(ticketData);
        const ok = await printDirectToLan(escpos, kitchen.ip, kitchen.port);
        if (ok) return true;
      } catch (e) {
        console.warn("Kitchen LAN print failed:", e);
      }
    }

    // Case C: Only Bar printer is configured
    if (!isKitchenConfigured && isBarConfigured) {
      try {
        const ticketData: ReceiptData = {
          ...data,
          stationTitle: data.stationTitle || "BAR ORDER TICKET",
        };
        const escpos = buildEscPosReceipt(ticketData);
        const ok = await printDirectToLan(escpos, bar.ip, bar.port);
        if (ok) return true;
      } catch (e) {
        console.warn("Bar LAN print failed:", e);
      }
    }
  }

  // 3. Priority 2: Direct USB printer if plugged in
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

  // 4. Fallback: Standard browser print dialog (ONLY for manual clicks, NEVER during silent auto-print!)
  if (options?.silent) {
    console.warn(
      "Silent background auto-print failed to reach thermal printer; skipping browser dialog popup."
    );
    return false;
  }
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
