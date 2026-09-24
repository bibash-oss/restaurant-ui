import { ReceiptData } from "./thermalReceipt";

// Standard 80mm ESC/POS paper width has 48 columns in standard font (Font A)
const COLS_80MM = 48;

function padRight(str: string, length: number): string {
  if (str.length >= length) return str.slice(0, length);
  return str + " ".repeat(length - str.length);
}

function padLeft(str: string, length: number): string {
  if (str.length >= length) return str.slice(0, length);
  return " ".repeat(length - str.length) + str;
}

/**
 * Builds raw ESC/POS binary buffer for 80mm thermal receipt
 */
export function buildEscPosReceipt(data: ReceiptData): Uint8Array {
  const parts: (number[] | Uint8Array)[] = [];
  const encoder = new TextEncoder();

  const writeRaw = (bytes: number[]) => {
    parts.push(new Uint8Array(bytes));
  };

  const writeText = (text: string) => {
    parts.push(encoder.encode(text));
  };

  const writeLine = (text: string = "") => {
    parts.push(encoder.encode(text + "\n"));
  };

  // 1. Initialize printer: ESC @
  writeRaw([0x1b, 0x40]);

  // 2. Center Align: ESC a 1
  writeRaw([0x1b, 0x61, 0x01]);

  // 3. Double Height & Width for Restaurant Name: GS ! 0x11
  writeRaw([0x1d, 0x21, 0x11]);
  writeRaw([0x1b, 0x45, 0x01]); // Bold ON
  writeLine(data.restaurantName.toUpperCase());
  writeRaw([0x1d, 0x21, 0x00]); // Normal size
  writeRaw([0x1b, 0x45, 0x00]); // Bold OFF

  if (data.restaurantAddress) {
    writeLine(data.restaurantAddress);
  }
  const ticketHeader = data.stationTitle || "KITCHEN ORDER TICKET";
  writeLine(`*** ${ticketHeader.toUpperCase()} ***`);

  // 4. Dashed divider
  writeLine("-".repeat(COLS_80MM));

  // 5. Table Name in Bold & Double Size
  writeRaw([0x1b, 0x45, 0x01]); // Bold ON
  writeRaw([0x1d, 0x21, 0x01]); // Double height
  writeLine(`TABLE: ${data.tableName.toUpperCase()}`);
  writeRaw([0x1d, 0x21, 0x00]); // Normal size
  writeRaw([0x1b, 0x45, 0x00]); // Bold OFF

  // 6. Dashed divider
  writeLine("-".repeat(COLS_80MM));

  // 7. Left Align for Order Details: ESC a 0
  writeRaw([0x1b, 0x61, 0x00]);

  const dateStr = new Date(data.createdAt || Date.now()).toLocaleString();
  const shortId =
    data.orderId.length > 8 ? data.orderId.slice(0, 8).toUpperCase() : data.orderId.toUpperCase();

  writeLine(`ORDER #: ${shortId}`);
  writeLine(`DATE:    ${dateStr}`);
  writeLine("-".repeat(COLS_80MM));

  // 8. Itemized Header (48 cols: Qty 5 | Item 25 | Price 9 | Total 9)
  const colQty = 5;
  const colName = 25;
  const colPrice = 9;
  const colTotal = 9;

  writeRaw([0x1b, 0x45, 0x01]); // Bold ON
  writeLine(
    padRight("QTY", colQty) +
      padRight("ITEM", colName) +
      padLeft("PRICE", colPrice) +
      padLeft("TOTAL", colTotal)
  );
  writeRaw([0x1b, 0x45, 0x00]); // Bold OFF
  writeLine("-".repeat(COLS_80MM));

  // 9. Items
  for (const item of data.items) {
    const qtyStr = `${item.quantity}x`;
    const priceStr = `$${item.price.toFixed(2)}`;
    const totalStr = `$${(item.quantity * item.price).toFixed(2)}`;

    // Handle multi-line item names if needed
    let nameStr = item.name;
    if (nameStr.length > colName - 1) {
      nameStr = nameStr.slice(0, colName - 1);
    }

    writeLine(
      padRight(qtyStr, colQty) +
        padRight(nameStr, colName) +
        padLeft(priceStr, colPrice) +
        padLeft(totalStr, colTotal)
    );

    if (item.addons && item.addons.length > 0) {
      for (const addon of item.addons) {
        const qtyPrefix = addon.quantity && addon.quantity > 1 ? `${addon.quantity}x ` : "";
        const priceSuffix = addon.price ? ` ($${(addon.price * (addon.quantity || 1)).toFixed(2)})` : "";
        writeLine(`   + ${qtyPrefix}${addon.name}${priceSuffix}`);
      }
    }
  }

  if (data.notes) {
    writeLine("-".repeat(COLS_80MM));
    writeRaw([0x1b, 0x45, 0x01]); // Bold ON
    writeLine("SPECIAL INSTRUCTIONS / NOTES:");
    writeRaw([0x1b, 0x45, 0x00]); // Bold OFF
    writeLine(data.notes);
  }

  writeLine("-".repeat(COLS_80MM));

  // 10. Total
  writeRaw([0x1b, 0x45, 0x01]); // Bold ON
  writeRaw([0x1d, 0x21, 0x01]); // Double height
  const totalLabel = "TOTAL AMOUNT:";
  const totalVal = `$${data.totalAmount.toFixed(2)}`;
  const spaceCount = Math.max(1, COLS_80MM - totalLabel.length - totalVal.length);
  writeLine(totalLabel + " ".repeat(spaceCount) + totalVal);
  writeRaw([0x1d, 0x21, 0x00]); // Normal size
  writeRaw([0x1b, 0x45, 0x00]); // Bold OFF

  // 11. Footer
  writeRaw([0x1b, 0x61, 0x01]); // Center
  writeLine("=".repeat(COLS_80MM));
  writeLine("THANK YOU!");
  writeLine("");

  // 12. Paper Feed & Cut
  writeLine("\n");
  writeRaw([0x1b, 0x64, 0x05]); // ESC d 5: feed 5 lines so text clears the cutter
  writeRaw([0x1d, 0x56, 0x00]); // GS V 0: Full paper cut

  // Merge all byte buffers
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Builds a small test receipt to verify printer connectivity and hardware output
 */
export function buildEscPosTestReceipt(
  ip: string = "Network Printer",
  port: number = 9100,
  stationName: string = "Kitchen"
): Uint8Array {
  const parts: (number[] | Uint8Array)[] = [];
  const encoder = new TextEncoder();

  const writeRaw = (bytes: number[]) => {
    parts.push(new Uint8Array(bytes));
  };

  const writeLine = (text: string = "") => {
    parts.push(encoder.encode(text + "\n"));
  };

  // 1. Initialize printer: ESC @
  writeRaw([0x1b, 0x40]);

  // 2. Center Align: ESC a 1
  writeRaw([0x1b, 0x61, 0x01]);

  // 3. Double size title
  writeRaw([0x1d, 0x21, 0x11]);
  writeRaw([0x1b, 0x45, 0x01]); // Bold
  writeLine(`${stationName.toUpperCase()} TEST OK`);
  writeRaw([0x1d, 0x21, 0x00]); // Normal
  writeRaw([0x1b, 0x45, 0x00]);

  writeLine(`80mm Thermal Printer (${stationName} Station)`);
  writeLine("-".repeat(COLS_80MM));

  // 4. Details
  writeRaw([0x1b, 0x61, 0x00]); // Left
  writeLine(`Station    : ${stationName}`);
  writeLine(`IP Address : ${ip}`);
  writeLine(`Port       : ${port}`);
  writeLine(`Date/Time  : ${new Date().toLocaleString()}`);
  writeLine(`Status     : Connected & Printing`);
  writeLine("-".repeat(COLS_80MM));

  // 5. Center message
  writeRaw([0x1b, 0x61, 0x01]); // Center
  writeLine(`${stationName} station ordering system is ready!`);
  writeLine("=".repeat(COLS_80MM));

  // 6. Feed and cut
  writeLine("\n");
  writeRaw([0x1b, 0x64, 0x05]); // ESC d 5 (feed 5 lines)
  writeRaw([0x1d, 0x56, 0x00]); // GS V 0 (cut)

  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

