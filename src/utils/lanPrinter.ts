"use client";

import { buildEscPosTestReceipt } from "./escpos";

export type PrinterStation = "kitchen" | "bar";

export interface StationPrinterConfig {
  ip: string;
  port: number;
  enabled: boolean;
}

export type LanPrinterConfig = StationPrinterConfig;

export interface DualPrinterConfig {
  kitchen: StationPrinterConfig;
  bar: StationPrinterConfig;
}

export interface DiscoveredPrinter {
  ip: string;
  port: number;
  name: string;
  source?: "local-agent" | "server-route";
}

const LOCAL_AGENT_URL = "http://127.0.0.1:8088";

const DEFAULT_STATION_CONFIG: Record<PrinterStation, StationPrinterConfig> = {
  kitchen: {
    ip: "",
    port: 9100,
    enabled: true,
  },
  bar: {
    ip: "",
    port: 9100,
    enabled: false,
  },
};

export function getStationPrinterConfig(station: PrinterStation): StationPrinterConfig {
  if (typeof window === "undefined") return { ...DEFAULT_STATION_CONFIG[station] };
  try {
    const key = station === "kitchen" ? "kitchen_lan_printer_config" : "bar_lan_printer_config";
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATION_CONFIG[station], ...parsed };
    }
  } catch (e) {}
  return { ...DEFAULT_STATION_CONFIG[station] };
}

export function saveStationPrinterConfig(
  station: PrinterStation,
  config: Partial<StationPrinterConfig>
): StationPrinterConfig {
  const current = getStationPrinterConfig(station);
  const updated = { ...current, ...config };
  if (typeof window !== "undefined") {
    const key = station === "kitchen" ? "kitchen_lan_printer_config" : "bar_lan_printer_config";
    localStorage.setItem(key, JSON.stringify(updated));
  }
  return updated;
}

export function getDualPrinterConfig(): DualPrinterConfig {
  return {
    kitchen: getStationPrinterConfig("kitchen"),
    bar: getStationPrinterConfig("bar"),
  };
}

export function getLanPrinterConfig(): LanPrinterConfig {
  return getStationPrinterConfig("kitchen");
}

export function saveLanPrinterConfig(config: Partial<LanPrinterConfig>): LanPrinterConfig {
  return saveStationPrinterConfig("kitchen", config);
}

/**
 * Checks if the local Kitchen Print Agent is running on the user's PC
 */
export async function checkPrintAgentActive(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch(`${LOCAL_AGENT_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(600),
    });
    const data = await res.json();
    return data && data.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Actively discovers devices listening on raw port 9100 across local network subnets.
 * Uses local print agent if available; falls back to Next.js API route.
 */
export async function discoverLanPrinters(): Promise<DiscoveredPrinter[]> {
  // 1. Try local print agent first (handles cloud deployment)
  try {
    const res = await fetch(`${LOCAL_AGENT_URL}/discover`, {
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.printers)) {
      return data.printers.map((p: any) => ({ ...p, source: "local-agent" as const }));
    }
  } catch {}

  // 2. Fallback to server route (works in local dev / on-premise)
  try {
    const res = await fetch("/api/print-lan?discover=true");
    const data = await res.json();
    if (data.success && Array.isArray(data.printers)) {
      return data.printers.map((p: any) => ({ ...p, source: "server-route" as const }));
    }
    return [];
  } catch (e) {
    console.error("Failed to auto-discover LAN printers:", e);
    return [];
  }
}

/**
 * Scans LAN for port 9100 devices and saves first detected device if configured IP is missing
 */
export async function autoDetectAndSaveThermalPrinter(
  station: PrinterStation = "kitchen"
): Promise<DiscoveredPrinter | null> {
  try {
    const printers = await discoverLanPrinters();
    if (printers.length === 0) return null;

    const selected = printers[0];
    saveStationPrinterConfig(station, {
      ip: selected.ip,
      port: selected.port,
      enabled: true,
    });
    return selected;
  } catch (e) {
    console.error(`Error auto-detecting ${station} LAN printer:`, e);
  }
  return null;
}

/**
 * Checks if the LAN printer is online and responding on port 9100
 */
export async function checkLanPrinterStatus(
  ip?: string,
  port?: number
): Promise<{ online: boolean; message?: string; error?: string }> {
  const config = getLanPrinterConfig();
  const targetIp = (ip !== undefined ? ip : config.ip).trim();
  const targetPort = port !== undefined ? port : config.port;

  if (!targetIp) {
    return {
      online: false,
      error: "No printer IP configured. Use Auto-Detect to scan your local network.",
    };
  }

  // 1. Try local print agent
  try {
    const res = await fetch(
      `${LOCAL_AGENT_URL}/ping?ip=${encodeURIComponent(targetIp)}&port=${targetPort}`,
      { signal: AbortSignal.timeout(2000) }
    );
    const data = await res.json();
    if (data && typeof data.online === "boolean") {
      return {
        online: data.online,
        message: data.message,
        error: data.error,
      };
    }
  } catch {}

  // 2. Fallback to Next.js API route
  try {
    const res = await fetch(
      `/api/print-lan?ip=${encodeURIComponent(targetIp)}&port=${targetPort}`
    );
    const data = await res.json();
    return {
      online: !!data.online,
      message: data.message,
      error: data.error,
    };
  } catch (err: any) {
    return {
      online: false,
      error: err.message || "Failed to reach printer or print agent",
    };
  }
}

/**
 * Send raw ESC/POS bytes directly over the local network to the thermal printer.
 * Relays via local print agent when running, or falls back to server route.
 */
export async function printDirectToLan(
  data: Uint8Array,
  ip?: string,
  port?: number
): Promise<boolean> {
  const config = getLanPrinterConfig();
  let targetIp = (ip !== undefined ? ip : config.ip).trim();
  let targetPort = port !== undefined ? port : config.port;

  // If no IP is configured, attempt auto-detecting printer on LAN
  if (!targetIp) {
    const detected = await autoDetectAndSaveThermalPrinter();
    if (detected) {
      targetIp = detected.ip;
      targetPort = detected.port;
    } else {
      console.warn("No LAN printer IP configured and auto-detection found no printers.");
      return false;
    }
  }

  // Convert Uint8Array to base64
  let binary = "";
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  const base64Data = btoa(binary);

  const payload = {
    ip: targetIp,
    port: targetPort,
    data: base64Data,
  };

  // 1. Try local print agent
  try {
    const agentRes = await fetch(`${LOCAL_AGENT_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    const agentData = await agentRes.json();
    if (agentData && agentData.success) {
      return true;
    }
  } catch {}

  // 2. Fallback to Next.js API route
  try {
    const res = await fetch("/api/print-lan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    return !!result.success;
  } catch (err) {
    console.error("LAN print error:", err);
    return false;
  }
}

/**
 * Print a physical test slip to verify paper feeding, printing and cutting
 */
export async function printTestReceiptToLan(
  ip?: string,
  port?: number,
  stationName: string = "Kitchen"
): Promise<{ success: boolean; message: string }> {
  let targetIp = (ip !== undefined ? ip : "").trim();
  let targetPort = port !== undefined ? port : 9100;

  if (!targetIp) {
    const isBar = stationName.toLowerCase() === "bar";
    const cfg = getStationPrinterConfig(isBar ? "bar" : "kitchen");
    targetIp = cfg.ip.trim();
    targetPort = cfg.port || 9100;
  }

  if (!targetIp) {
    const isBar = stationName.toLowerCase() === "bar";
    const detected = await autoDetectAndSaveThermalPrinter(isBar ? "bar" : "kitchen");
    if (detected) {
      targetIp = detected.ip;
      targetPort = detected.port;
    } else {
      return {
        success: false,
        message: `No ${stationName} printer IP set. Please run Auto-Detect to find your thermal printer.`,
      };
    }
  }

  try {
    const escposBytes = buildEscPosTestReceipt(targetIp, targetPort, stationName);
    const ok = await printDirectToLan(escposBytes, targetIp, targetPort);
    if (ok) {
      return {
        success: true,
        message: `Test receipt sent to ${stationName} printer at ${targetIp}:${targetPort}! Check paper.`,
      };
    }
    return {
      success: false,
      message: `Failed to print to ${stationName} printer at ${targetIp}:${targetPort}. Please check if printer is powered on and connected to LAN.`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e.message || `Error printing ${stationName} test receipt`,
    };
  }
}
