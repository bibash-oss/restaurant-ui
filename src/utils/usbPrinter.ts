"use client";

export interface ConnectedUsbPrinter {
  name: string;
  type: "webusb" | "webserial";
  device?: any;
  serialPort?: any;
  outEndpoint?: number;
  interfaceNumber?: number;
}

let activePrinter: ConnectedUsbPrinter | null = null;
const listeners: Array<(printer: ConnectedUsbPrinter | null) => void> = [];

export function getActivePrinter(): ConnectedUsbPrinter | null {
  return activePrinter;
}

export function subscribePrinterStatus(
  callback: (printer: ConnectedUsbPrinter | null) => void
): () => void {
  listeners.push(callback);
  callback(activePrinter);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyListeners() {
  listeners.forEach((fn) => fn(activePrinter));
}

/**
 * Check if WebUSB or WebSerial is supported in this browser
 */
export function isUsbPrintSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "usb" in navigator || "serial" in navigator;
}

function isLikelyPrinter(device: any): boolean {
  if (!device) return false;

  // 1. Strictly exclude Apple internal hubs and multiport adapters
  if (device.vendorId === 0x05ac || device.vendorId === 1452) {
    return false;
  }
  const name = (device.productName || "").toLowerCase();
  const mfr = (device.manufacturerName || "").toLowerCase();
  if (
    name.includes("adapter") ||
    name.includes("hub") ||
    name.includes("multiport") ||
    name.includes("display") ||
    name.includes("apple")
  ) {
    return false;
  }

  // 2. Positively recognize printer keywords
  if (
    name.includes("printer") ||
    name.includes("pos") ||
    name.includes("receipt") ||
    name.includes("thermal") ||
    name.includes("pos80") ||
    mfr.includes("printer") ||
    mfr.includes("stmicroelectronics") ||
    mfr.includes("epson") ||
    mfr.includes("xprinter")
  ) {
    return true;
  }

  // 3. Check for USB interface class 7 (Printer class)
  if (device.configuration?.interfaces) {
    const hasPrinterClass = device.configuration.interfaces.some((iface: any) =>
      iface.alternates?.some((alt: any) => alt.interfaceClass === 7)
    );
    if (hasPrinterClass) return true;
  }

  return true;
}

/**
 * Try auto-reconnecting to previously granted USB or Serial printer
 */
export async function tryAutoReconnectUsbPrinter(): Promise<ConnectedUsbPrinter | null> {
  if (typeof window === "undefined") return null;

  // 1. Try WebUSB
  if ("usb" in navigator) {
    try {
      const devices = await (navigator as any).usb.getDevices();
      if (devices && devices.length > 0) {
        const savedPrinterId = localStorage.getItem("kitchen_usb_printer_saved_id");

        // Priority 1: match saved printer ID
        let targetDevice = devices.find(
          (d: any) => `${d.vendorId}_${d.productId}` === savedPrinterId
        );

        // Priority 2: find first device that is actually a printer (not an adapter)
        if (!targetDevice) {
          targetDevice = devices.find((d: any) => isLikelyPrinter(d));
        }

        if (targetDevice) {
          const connected = await setupWebUsbDevice(targetDevice);
          if (connected) {
            activePrinter = connected;
            notifyListeners();
            return connected;
          }
        }
      }
    } catch (err) {
      console.warn("Auto-reconnect WebUSB error:", err);
    }
  }

  // 2. Try WebSerial
  if ("serial" in navigator) {
    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports && ports.length > 0) {
        const port = ports[0];
        await port.open({ baudRate: 9600 });
        activePrinter = {
          name: "USB Serial Thermal Printer",
          type: "webserial",
          serialPort: port,
        };
        notifyListeners();
        return activePrinter;
      }
    } catch (err) {
      console.warn("Auto-reconnect WebSerial error:", err);
    }
  }

  return null;
}

let isSettingUpDevice = false;

async function setupWebUsbDevice(device: any): Promise<ConnectedUsbPrinter | null> {
  if (isSettingUpDevice) return null;
  isSettingUpDevice = true;

  try {
    if (!device.opened) {
      await device.open();
    }

    if (device.configuration === null) {
      try {
        await device.selectConfiguration(1);
      } catch (configErr) {
        console.warn("selectConfiguration error:", configErr);
      }
    }

    // Find printer interface (class 7 is printer, or first interface with an OUT endpoint)
    let selectedInterface = device.configuration?.interfaces.find((iface: any) =>
      iface.alternates?.some(
        (alt: any) =>
          alt.interfaceClass === 7 ||
          alt.endpoints?.some((ep: any) => ep.direction === "out")
      )
    );

    if (!selectedInterface && device.configuration?.interfaces?.length) {
      selectedInterface = device.configuration.interfaces[0];
    }

    if (!selectedInterface) {
      console.error("No usable USB interface found on printer");
      return null;
    }

    const ifaceNumber = selectedInterface.interfaceNumber;
    try {
      await device.claimInterface(ifaceNumber);
    } catch (claimErr) {
      // On macOS, the OS kernel printer driver owns the interface, so WebUSB cannot claim it
      console.warn("Could not claim USB interface (macOS driver may be locking it):", claimErr);
      return null;
    }

    const alternate = selectedInterface.alternates?.[0];
    const outEp = alternate?.endpoints?.find((ep: any) => ep.direction === "out");

    return {
      name: device.productName || "POS80 Thermal Printer",
      type: "webusb",
      device,
      interfaceNumber: ifaceNumber,
      outEndpoint: outEp ? outEp.endpointNumber : 1,
    };
  } catch (err) {
    console.warn("Failed to setup WebUSB device:", err);
    return null;
  } finally {
    isSettingUpDevice = false;
  }
}

/**
 * Prompt user to select their USB thermal printer (pair once)
 */
export async function connectUsbPrinter(): Promise<ConnectedUsbPrinter | null> {
  if (typeof window === "undefined") return null;

  // 1. First try WebUSB
  if ("usb" in navigator) {
    try {
      let device: any;
      try {
        // Filter specifically for printers first (class 7 is USB Printer Class)
        device = await (navigator as any).usb.requestDevice({
          filters: [{ classCode: 7 }],
        });
      } catch (filterErr: any) {
        if (filterErr?.name === "NotFoundError") {
          return null;
        }
        // Fallback to all devices if classCode filter isn't supported by the device
        device = await (navigator as any).usb.requestDevice({ filters: [] });
      }

      if (device) {
        if (!isLikelyPrinter(device)) {
          alert(`"${device.productName || 'Device'}" is an adapter/hub, not a printer. Please select your "POS80 Printer USB".`);
          return null;
        }

        const connected = await setupWebUsbDevice(device);
        if (connected) {
          localStorage.setItem(
            "kitchen_usb_printer_saved_id",
            `${device.vendorId}_${device.productId}`
          );
          activePrinter = connected;
          notifyListeners();
          return connected;
        }
      }
    } catch (usbErr: any) {
      if (usbErr?.name === "NotFoundError") {
        return null;
      }
      console.warn("WebUSB request failed, trying WebSerial...", usbErr);
    }
  }

  // 2. Fallback to WebSerial if WebUSB fails or device is a virtual COM port
  if ("serial" in navigator) {
    try {
      const port = await (navigator as any).serial.requestPort();
      if (port) {
        try {
          await port.open({ baudRate: 9600 });
        } catch (openErr) {
          // Already open
        }
        activePrinter = {
          name: "USB Serial Thermal Printer",
          type: "webserial",
          serialPort: port,
        };
        notifyListeners();
        return activePrinter;
      }
    } catch (serialErr) {
      console.warn("WebSerial request failed:", serialErr);
    }
  }

  return null;
}

export function disconnectUsbPrinter(): void {
  if (activePrinter?.device?.opened) {
    try {
      activePrinter.device.close();
    } catch (e) {}
  }
  if (activePrinter?.serialPort) {
    try {
      activePrinter.serialPort.close();
    } catch (e) {}
  }
  activePrinter = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("kitchen_usb_printer_saved_id");
  }
  notifyListeners();
}

/**
 * Print directly & silently to the connected USB thermal printer
 */
export async function printDirectToUsb(data: Uint8Array): Promise<boolean> {
  if (!activePrinter) {
    return false;
  }

  try {
    if (activePrinter.type === "webusb" && activePrinter.device) {
      const device = activePrinter.device;
      if (!device.opened) {
        await device.open();
      }
      const endpoint = activePrinter.outEndpoint || 1;
      const bufferToSend = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      );
      const result = await device.transferOut(endpoint, bufferToSend);
      return result.status === "ok";
    }

    if (activePrinter.type === "webserial" && activePrinter.serialPort) {
      const port = activePrinter.serialPort;
      if (!port.readable) {
        await port.open({ baudRate: 9600 });
      }
      const writer = port.writable.getWriter();
      await writer.write(data);
      writer.releaseLock();
      return true;
    }
  } catch (err) {
    console.error("Direct USB print error:", err);
    return false;
  }

  return false;
}
