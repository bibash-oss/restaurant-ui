"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  Paper,
  Table,
  Group,
  Text,
  Select,
  Button,
  Modal,
  Stack,
  Box,
  Badge,
  Divider,
  Alert,
  Title,
  Switch,
  ActionIcon,
  Tooltip,
  TextInput,
  Tabs,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconRefresh,
  IconReceipt,
  IconEye,
  IconAlertCircle,
  IconPrinter,
  IconVolume,
  IconVolumeOff,
  IconBellRinging,
  IconUsb,
  IconNetwork,
  IconCheck,
  IconSearch,
  IconDownload,
} from "@tabler/icons-react";
import { PrintAgentModal } from "@/components/printing/PrintAgentModal";
import { useAuth } from "@/features/auth/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  APIGetOrdersByRestaurant,
  APIUpdateOrderStatus,
  APIGetItemsByOrder,
} from "@/api/orders";
import { APIGetTablesByRestaurant } from "@/api/tables";
import { Order, OrderItem, OrderStatus, Table as TableType } from "@/types";
import {
  printThermalReceipt,
  printStationTicket,
  ReceiptData,
  ReceiptItem,
  PrintThermalOptions,
} from "@/utils/thermalReceipt";
import {
  connectUsbPrinter,
  disconnectUsbPrinter,
  subscribePrinterStatus,
  tryAutoReconnectUsbPrinter,
  ConnectedUsbPrinter,
  isUsbPrintSupported,
} from "@/utils/usbPrinter";
import {
  getStationPrinterConfig,
  saveStationPrinterConfig,
  getDualPrinterConfig,
  checkLanPrinterStatus,
  printTestReceiptToLan,
  discoverLanPrinters,
  autoDetectAndSaveThermalPrinter,
  checkPrintAgentActive,
  StationPrinterConfig,
  PrinterStation,
  DiscoveredPrinter,
} from "@/utils/lanPrinter";

// Key for persisting printed order IDs across page refreshes and remounts
const STORAGE_KEY_PRINTED_ORDERS = "kitchen_printed_order_ids";

function getPersistedPrintedOrderIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PRINTED_ORDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return new Set();
}

function persistPrintedOrderId(orderId: string) {
  if (typeof window === "undefined" || !orderId) return;
  try {
    const current = getPersistedPrintedOrderIds();
    current.add(orderId);
    // Keep at most 500 recent IDs to avoid storage bloat
    const list = Array.from(current).slice(-500);
    sessionStorage.setItem(STORAGE_KEY_PRINTED_ORDERS, JSON.stringify(list));
  } catch (e) {
    // Ignore storage write errors
  }
}

// Deduplicate order list by order ID and merge/preserve items if present
function deduplicateOrders(orderList: Order[]): Order[] {
  if (!orderList || !Array.isArray(orderList)) return [];
  const map = new Map<string, Order>();
  for (const o of orderList) {
    if (!o || !o.id) continue;
    if (!map.has(o.id)) {
      map.set(o.id, o);
    } else {
      // Keep whichever entry has items
      const existing = map.get(o.id)!;
      const existingItems = existing.items || (existing as any).orderItems || [];
      const newItems = o.items || (o as any).orderItems || [];
      if (newItems.length > existingItems.length) {
        map.set(o.id, o);
      }
    }
  }
  return Array.from(map.values());
}

// Dual-tone POS order chime using Web Audio API
function playOrderChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playTone(587.33, now, 0.35); // D5
    playTone(880.0, now + 0.14, 0.55); // A5
  } catch (err) {
    console.warn("Could not play audio chime:", err);
  }
}

export default function OrdersPage() {
  const { user, restaurantId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  // Auto-Print & Sound settings (persisted in localStorage)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kitchen_auto_print");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kitchen_sound_alert");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  // Recent order notification banner
  const [latestPrintedOrderId, setLatestPrintedOrderId] = useState<string | null>(null);

  // Refs for tracking order lifecycle across polling intervals
  const initialLoadDoneRef = useRef<boolean>(false);
  const printedOrderIdsRef = useRef<Set<string>>(getPersistedPrintedOrderIds());
  const inFlightPrintingRef = useRef<Set<string>>(new Set());
  const autoPrintRef = useRef<boolean>(autoPrintEnabled);
  const soundAlertRef = useRef<boolean>(soundAlertEnabled);

  // Synchronize refs
  useEffect(() => {
    autoPrintRef.current = autoPrintEnabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("kitchen_auto_print", String(autoPrintEnabled));
    }
  }, [autoPrintEnabled]);

  useEffect(() => {
    soundAlertRef.current = soundAlertEnabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("kitchen_sound_alert", String(soundAlertEnabled));
    }
  }, [soundAlertEnabled]);

  // USB Thermal Printer direct connection state
  const [usbPrinter, setUsbPrinter] = useState<ConnectedUsbPrinter | null>(null);
  const [isConnectingUsb, setIsConnectingUsb] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribePrinterStatus(setUsbPrinter);
    tryAutoReconnectUsbPrinter();
    return () => unsubscribe();
  }, []);

  const handleConnectUsb = async () => {
    setIsConnectingUsb(true);
    try {
      const printer = await connectUsbPrinter();
      if (printer) {
        setUsbPrinter(printer);
      }
    } finally {
      setIsConnectingUsb(false);
    }
  };

  // LAN / Network Thermal Printer state (Kitchen & Bar Stations)
  const [activeStationTab, setActiveStationTab] = useState<PrinterStation>("kitchen");
  const [kitchenConfig, setKitchenConfig] = useState<StationPrinterConfig>(() =>
    getStationPrinterConfig("kitchen")
  );
  const [barConfig, setBarConfig] = useState<StationPrinterConfig>(() =>
    getStationPrinterConfig("bar")
  );
  const [kitchenOnline, setKitchenOnline] = useState<boolean | null>(null);
  const [barOnline, setBarOnline] = useState<boolean | null>(null);

  const [lanModalOpened, { open: openLanModal, close: closeLanModal }] = useDisclosure(false);
  const [stationIpInput, setStationIpInput] = useState<string>(kitchenConfig.ip);
  const [stationPortInput, setStationPortInput] = useState<string>(String(kitchenConfig.port || 9100));
  const [stationEnabled, setStationEnabled] = useState<boolean>(kitchenConfig.enabled);

  const [isTestingLan, setIsTestingLan] = useState<boolean>(false);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [lanTestResult, setLanTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [agentActive, setAgentActive] = useState<boolean | null>(null);
  const [agentModalOpened, { open: openAgentModal, close: closeAgentModal }] = useDisclosure(false);

  // Sync inputs when active station tab changes
  const handleStationTabChange = (tab: string | null) => {
    const station = (tab as PrinterStation) || "kitchen";
    setActiveStationTab(station);
    const cfg = station === "bar" ? barConfig : kitchenConfig;
    setStationIpInput(cfg.ip);
    setStationPortInput(String(cfg.port || 9100));
    setStationEnabled(cfg.enabled);
    setLanTestResult(null);
  };

  useEffect(() => {
    checkPrintAgentActive().then(setAgentActive);
    const kCfg = getStationPrinterConfig("kitchen");
    const bCfg = getStationPrinterConfig("bar");
    setKitchenConfig(kCfg);
    setBarConfig(bCfg);
    setStationIpInput(kCfg.ip);
    setStationPortInput(String(kCfg.port || 9100));
    setStationEnabled(kCfg.enabled);

    if (kCfg.ip && kCfg.enabled) {
      checkLanPrinterStatus(kCfg.ip, kCfg.port).then((res) => {
        setKitchenOnline(res.online);
      });
    }

    if (bCfg.ip && bCfg.enabled) {
      checkLanPrinterStatus(bCfg.ip, bCfg.port).then((res) => {
        setBarOnline(res.online);
      });
    }

    // Auto-detect printer dynamically if kitchen IP is not yet set
    if (!kCfg.ip) {
      setIsDiscovering(true);
      autoDetectAndSaveThermalPrinter("kitchen")
        .then((found) => {
          setIsDiscovering(false);
          if (found) {
            const updated = getStationPrinterConfig("kitchen");
            setKitchenConfig(updated);
            setStationIpInput(updated.ip);
            setStationPortInput(String(updated.port));
            setKitchenOnline(true);
          }
        })
        .catch(() => {
          setIsDiscovering(false);
        });
    }
  }, []);

  // Periodic health check for configured station printers
  useEffect(() => {
    if (kitchenConfig.ip && kitchenConfig.enabled) {
      checkLanPrinterStatus(kitchenConfig.ip, kitchenConfig.port).then((res) => {
        setKitchenOnline(res.online);
      });
    } else {
      setKitchenOnline(null);
    }
  }, [kitchenConfig.ip, kitchenConfig.port, kitchenConfig.enabled]);

  useEffect(() => {
    if (barConfig.ip && barConfig.enabled) {
      checkLanPrinterStatus(barConfig.ip, barConfig.port).then((res) => {
        setBarOnline(res.online);
      });
    } else {
      setBarOnline(null);
    }
  }, [barConfig.ip, barConfig.port, barConfig.enabled]);

  const handleDiscoverLan = async () => {
    setIsDiscovering(true);
    setLanTestResult(null);
    try {
      const printers = await discoverLanPrinters();
      setDiscoveredPrinters(printers);
      if (printers.length === 0) {
        setLanTestResult({
          success: false,
          message: "No raw port 9100 printers detected on your local subnet. Please verify printers are turned on and connected to the router.",
        });
      } else {
        setLanTestResult({
          success: true,
          message: `Found ${printers.length} LAN printer device(s). You can assign each to Kitchen or Bar below.`,
        });
      }
    } catch (err: any) {
      setLanTestResult({
        success: false,
        message: err.message || "Failed to scan local network",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  const [isPrintingTestSlip, setIsPrintingTestSlip] = useState<boolean>(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);

  const handleTestLan = async () => {
    setIsTestingLan(true);
    setLanTestResult(null);
    const stationLabel = activeStationTab === "bar" ? "Bar" : "Kitchen";
    try {
      const res = await checkLanPrinterStatus(stationIpInput.trim(), parseInt(stationPortInput, 10));
      if (res.online) {
        setLanTestResult({
          success: true,
          message: `Success! ${stationLabel} printer is reachable at ${stationIpInput}:${stationPortInput}`,
        });
      } else {
        setLanTestResult({
          success: false,
          message: res.error || `Cannot connect to ${stationLabel} printer at this IP`,
        });
      }
    } finally {
      setIsTestingLan(false);
    }
  };

  const handlePrintTestSlip = async () => {
    setIsPrintingTestSlip(true);
    setLanTestResult(null);
    const stationLabel = activeStationTab === "bar" ? "Bar" : "Kitchen";
    try {
      const res = await printTestReceiptToLan(
        stationIpInput.trim(),
        parseInt(stationPortInput, 10),
        stationLabel
      );
      setLanTestResult(res);
      if (res.success) {
        if (activeStationTab === "kitchen") setKitchenOnline(true);
        else setBarOnline(true);
      }
    } finally {
      setIsPrintingTestSlip(false);
    }
  };

  const handleSaveStation = () => {
    const updated = saveStationPrinterConfig(activeStationTab, {
      ip: stationIpInput.trim(),
      port: parseInt(stationPortInput, 10) || 9100,
      enabled: stationEnabled,
    });
    if (activeStationTab === "kitchen") {
      setKitchenConfig(updated);
      if (updated.ip && updated.enabled) {
        checkLanPrinterStatus(updated.ip, updated.port).then((res) => setKitchenOnline(res.online));
      } else {
        setKitchenOnline(null);
      }
    } else {
      setBarConfig(updated);
      if (updated.ip && updated.enabled) {
        checkLanPrinterStatus(updated.ip, updated.port).then((res) => setBarOnline(res.online));
      } else {
        setBarOnline(null);
      }
    }
    closeLanModal();
  };

  const handleAssignDiscoveredPrinter = (p: DiscoveredPrinter, station: PrinterStation) => {
    const updated = saveStationPrinterConfig(station, {
      ip: p.ip,
      port: p.port,
      enabled: true,
    });
    if (station === "kitchen") {
      setKitchenConfig(updated);
      setKitchenOnline(true);
    } else {
      setBarConfig(updated);
      setBarOnline(true);
    }
    if (activeStationTab === station) {
      setStationIpInput(p.ip);
      setStationPortInput(String(p.port));
      setStationEnabled(true);
    }
    setLanTestResult({
      success: true,
      message: `Assigned ${p.ip}:${p.port} to ${station === "bar" ? "Bar" : "Kitchen"} Station!`,
    });
  };

    // Synchronize state to refs so callbacks never re-create or cause re-render loops
    const tablesRef = useRef<TableType[]>([]);
    useEffect(() => {
      tablesRef.current = tables;
    }, [tables]);

    const userRef = useRef(user);
    useEffect(() => {
      userRef.current = user;
    }, [user]);

    // Detail Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loadingItems, setLoadingItems] = useState<boolean>(false);
    const [isPrintingModal, setIsPrintingModal] = useState<boolean>(false);
    const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

    const getTableNumber = useCallback((tableId: string, orderTable?: TableType) => {
      if (orderTable?.number) return orderTable.number;
      const found = tablesRef.current.find((t) => t.id === tableId);
      return found ? found.number : "Unknown Table";
    }, []);

    // Core receipt printer function
    const handlePrintOrder = useCallback(
      async (
        order: Order,
        itemsToPrint?: OrderItem[],
        station?: PrinterStation,
        options?: PrintThermalOptions
      ) => {
        let finalItems = itemsToPrint;
        if (!finalItems || finalItems.length === 0) {
          const existing = order.items || (order as any).orderItems;
          if (existing && existing.length > 0) {
            finalItems = existing;
          } else {
            try {
              const res: any = await APIGetItemsByOrder(order.id);
              if (res?.data && Array.isArray(res.data)) {
                finalItems = res.data;
              }
            } catch (e) {
              console.error("Failed to load items for printing receipt:", e);
            }
          }
        }

        const tableName = getTableNumber(order.tableId, order.table);
        const receiptItems: ReceiptItem[] = (finalItems || []).map((it) => {
          const rawAddons = it.addons || it.orderItemAddons || (it as any).OrderItemAddons || [];
          const mappedAddons = rawAddons.map((ad: any) => ({
            name: ad.addon?.name || ad.name || "Addon",
            price: Number(ad.addon?.price ?? ad.price ?? 0),
            quantity: Number(ad.quantity || 1),
          }));

          const itemMenuType = (it.menuItem?.menuType ||
            (it as any).menuType ||
            (it.menuItem as any)?.MenuType ||
            "KITCHEN") as "BAR" | "KITCHEN";

          return {
            name: it.menuItem?.name || `Item ${it.menuItemId?.slice(0, 8) || ""}`,
            quantity: it.quantity || 1,
            price: Number(it.price ?? it.menuItem?.price ?? 0),
            addons: mappedAddons,
            menuType: itemMenuType,
          };
        });

        const calculatedTotal =
          order.totalAmount && Number(order.totalAmount) > 0
            ? Number(order.totalAmount)
            : receiptItems.reduce((sum, it) => {
                const itemTotal = it.quantity * it.price;
                const addonsTotal = (it.addons || []).reduce(
                  (aSum, a) => aSum + a.price * (a.quantity || 1),
                  0
                );
                return sum + itemTotal + addonsTotal;
              }, 0);

        const receiptData: ReceiptData = {
          restaurantName: userRef.current?.restaurant?.name || "Kitchen Order",
          restaurantAddress: userRef.current?.restaurant?.address || "",
          orderId: order.id,
          tableName: tableName,
          createdAt: order.createdAt || new Date(),
          items: receiptItems,
          totalAmount: calculatedTotal,
          notes: order.notes,
        };

        const printOptions: PrintThermalOptions = {
          ...(options || {}),
          ...(station ? { station } : {}),
        };

        return await printThermalReceipt(receiptData, printOptions);
      },
      [getTableNumber]
    );

    // Check incoming orders for new ones to automatically print & sound alert
    const checkAndAutoPrintNewOrders = useCallback(
      async (incomingOrders: Order[]) => {
        const uniqueOrders = deduplicateOrders(incomingOrders);

        if (!initialLoadDoneRef.current) {
          // Initial load: mark existing orders as already printed so past orders are never auto-printed
          uniqueOrders.forEach((o) => {
            printedOrderIdsRef.current.add(o.id);
            persistPrintedOrderId(o.id);
          });
          initialLoadDoneRef.current = true;
          return;
        }

        // Find truly new orders that are neither printed nor currently in-flight
        const brandNewOrders: Order[] = [];
        for (const order of uniqueOrders) {
          if (
            !printedOrderIdsRef.current.has(order.id) &&
            !inFlightPrintingRef.current.has(order.id)
          ) {
            // CRITICAL: Immediately lock and register this ID so subsequent ticks or loops never re-trigger it!
            printedOrderIdsRef.current.add(order.id);
            inFlightPrintingRef.current.add(order.id);
            persistPrintedOrderId(order.id);
            brandNewOrders.push(order);
          }
        }

        if (brandNewOrders.length === 0) return;

        for (const newOrder of brandNewOrders) {
          setLatestPrintedOrderId(newOrder.id);

          // Sound chime for the kitchen staff
          if (soundAlertRef.current) {
            playOrderChime();
          }

          // Automatic 80mm thermal receipt printing (silent: background auto-print never spawns window.print dialogs)
          if (autoPrintRef.current) {
            try {
              await handlePrintOrder(newOrder, undefined, undefined, { silent: true });
            } catch (err) {
              console.error("Auto print failed for order:", newOrder.id, err);
            } finally {
              inFlightPrintingRef.current.delete(newOrder.id);
            }
          } else {
            inFlightPrintingRef.current.delete(newOrder.id);
          }
        }
      },
      [handlePrintOrder]
    );

    // Initial load
    const loadInitialData = useCallback(async () => {
      if (!restaurantId) return;
      setIsLoading(true);
      setError(null);
      try {
        const [ordersRes, tablesRes] = await Promise.allSettled([
          APIGetOrdersByRestaurant(restaurantId),
          APIGetTablesByRestaurant(restaurantId),
        ]);

        if (tablesRes.status === "fulfilled" && (tablesRes.value as any)?.data) {
          const fetchedTables = Array.isArray((tablesRes.value as any).data)
            ? (tablesRes.value as any).data
            : [];
          setTables(fetchedTables);
          tablesRef.current = fetchedTables;
        }

        if (ordersRes.status === "fulfilled" && (ordersRes.value as any)?.data) {
          const rawOrders: Order[] = Array.isArray((ordersRes.value as any).data)
            ? (ordersRes.value as any).data
            : [];
          const fetchedOrders = deduplicateOrders(rawOrders);
          setOrders(fetchedOrders);
          fetchedOrders.forEach((o) => {
            printedOrderIdsRef.current.add(o.id);
            persistPrintedOrderId(o.id);
          });
          initialLoadDoneRef.current = true;
        }
      } catch (err: any) {
        setError(typeof err === "string" ? err : "Failed to load orders");
      } finally {
        setIsLoading(false);
      }
    }, [restaurantId]);

    useEffect(() => {
      loadInitialData();
    }, [loadInitialData]);

    // Polling ref to prevent overlapping requests
    const isPollingRef = useRef(false);

    // Background polling for new orders every 5 seconds
    useEffect(() => {
      if (!restaurantId) return;

      const interval = setInterval(async () => {
        if (isPollingRef.current) return;
        isPollingRef.current = true;
        try {
          const ordersRes: any = await APIGetOrdersByRestaurant(restaurantId);
          if (ordersRes?.data && Array.isArray(ordersRes.data)) {
            const fetchedOrders = deduplicateOrders(ordersRes.data);
            setOrders(fetchedOrders);
            checkAndAutoPrintNewOrders(fetchedOrders);
          }
        } catch (e) {
          // silent poll error
        } finally {
          isPollingRef.current = false;
        }
      }, 5000);

      return () => clearInterval(interval);
    }, [restaurantId, checkAndAutoPrintNewOrders]);

    const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
      try {
        await APIUpdateOrderStatus(orderId, { status: newStatus });
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      } catch (err: any) {
        console.error("Failed to update status", err);
      }
    };

    const handleViewOrder = async (order: Order) => {
      setSelectedOrder(order);
      openModal();
      setLoadingItems(true);
      try {
        const itemsRes: any = await APIGetItemsByOrder(order.id);
        if (itemsRes?.data) {
          setOrderItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        } else {
          setOrderItems(order.items || []);
        }
      } catch (err) {
        setOrderItems(order.items || []);
      } finally {
        setLoadingItems(false);
      }
    };

    const filteredOrders = orders.filter((o) => {
      if (statusFilter === "ALL") return true;
      return o.status === statusFilter;
    });

    if (isLoading) {
      return <Loading message="Loading orders..." />;
    }

    return (
      <Box>
        <PageHeader
          title="Kitchen Orders"
          description="Live kitchen orders monitor with automatic 80mm receipt printing"
          action={
            <Group gap="sm" wrap="wrap">
              <Badge
                color="teal"
                variant="light"
                size="lg"
                leftSection={
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      boxShadow: "0 0 8px #10b981",
                    }}
                  />
                }
              >
                Live Sync (3.5s)
              </Badge>

              <Tooltip label="Automatically prints 80mm thermal receipt right when a customer places an order from their phone">
                <Switch
                  label="Auto-Print (80mm)"
                  checked={autoPrintEnabled}
                  onChange={(event) => setAutoPrintEnabled(event.currentTarget.checked)}
                  color="teal"
                  size="sm"
                />
              </Tooltip>

              <Tooltip label="Play sound alert on new incoming orders">
                <Switch
                  label="Sound Alert"
                  checked={soundAlertEnabled}
                  onChange={(event) => setSoundAlertEnabled(event.currentTarget.checked)}
                  color="blue"
                  size="sm"
                  thumbIcon={
                    soundAlertEnabled ? (
                      <IconVolume size={12} color="var(--mantine-color-blue-6)" />
                    ) : (
                      <IconVolumeOff size={12} color="gray" />
                    )
                  }
                />
              </Tooltip>

              {/* Kitchen Station Thermal Printer Badge */}
              <Tooltip label="Click to configure Kitchen Thermal Printer (Food items)">
                <Badge
                  color={
                    kitchenConfig.ip && kitchenConfig.enabled
                      ? kitchenOnline
                        ? "teal"
                        : kitchenOnline === false
                        ? "red"
                        : "gray"
                      : "blue"
                  }
                  variant={kitchenConfig.enabled ? "filled" : "outline"}
                  size="lg"
                  style={{ cursor: "pointer" }}
                  leftSection={<Text size="xs">🍳</Text>}
                  onClick={() => {
                    checkPrintAgentActive().then(setAgentActive);
                    const kCfg = getStationPrinterConfig("kitchen");
                    setKitchenConfig(kCfg);
                    setActiveStationTab("kitchen");
                    setStationIpInput(kCfg.ip);
                    setStationPortInput(String(kCfg.port || 9100));
                    setStationEnabled(kCfg.enabled);
                    setLanTestResult(null);
                    openLanModal();
                  }}
                >
                  Kitchen:{" "}
                  {kitchenConfig.ip
                    ? `${kitchenConfig.ip} (${
                        kitchenOnline
                          ? "Online"
                          : kitchenOnline === false
                          ? "Offline"
                          : "Checking..."
                      })`
                    : "Auto-Detect"}
                </Badge>
              </Tooltip>

              {/* Bar Station Thermal Printer Badge */}
              <Tooltip label="Click to configure Bar Thermal Printer (Drink & Beverage items)">
                <Badge
                  color={
                    barConfig.ip && barConfig.enabled
                      ? barOnline
                        ? "grape"
                        : barOnline === false
                        ? "red"
                        : "gray"
                      : "gray"
                  }
                  variant={barConfig.enabled ? "filled" : "outline"}
                  size="lg"
                  style={{ cursor: "pointer" }}
                  leftSection={<Text size="xs">🍸</Text>}
                  onClick={() => {
                    checkPrintAgentActive().then(setAgentActive);
                    const bCfg = getStationPrinterConfig("bar");
                    setBarConfig(bCfg);
                    setActiveStationTab("bar");
                    setStationIpInput(bCfg.ip);
                    setStationPortInput(String(bCfg.port || 9100));
                    setStationEnabled(bCfg.enabled);
                    setLanTestResult(null);
                    openLanModal();
                  }}
                >
                  Bar:{" "}
                  {barConfig.enabled
                    ? barConfig.ip
                      ? `${barConfig.ip} (${
                          barOnline
                            ? "Online"
                            : barOnline === false
                            ? "Offline"
                            : "Checking..."
                        })`
                      : "Set IP"
                    : "Disabled"}
                </Badge>
              </Tooltip>

              {/* Local Print Agent Status & Download Badge */}
              <Tooltip label={agentActive ? "Kitchen Print Agent connected (Silent background thermal printing enabled). Click to view details." : "Install Kitchen Print Agent for silent background thermal printing and network auto-discovery"}>
                <Badge
                  color={agentActive ? "teal" : "blue"}
                  variant={agentActive ? "outline" : "filled"}
                  size="lg"
                  style={{ cursor: "pointer" }}
                  leftSection={agentActive ? <IconPrinter size={14} /> : <IconDownload size={14} />}
                  onClick={openAgentModal}
                >
                  {agentActive ? "Agent: Active" : "Install Print Agent"}
                </Badge>
              </Tooltip>

              {isUsbPrintSupported() && (
                usbPrinter ? (
                  <Tooltip label="USB Printer Connected. Silent printing active (no print dialog!). Click to disconnect.">
                    <Badge
                      color="teal"
                      variant="filled"
                      size="lg"
                      style={{ cursor: "pointer" }}
                      leftSection={<IconUsb size={14} />}
                      onClick={disconnectUsbPrinter}
                    >
                      USB: {usbPrinter.name.slice(0, 14)} (Silent)
                    </Badge>
                  </Tooltip>
                ) : (
                  <Tooltip label="Connect your USB cable printer once to print directly & silently with NO print dialog!">
                    <Button
                      variant="outline"
                      color="teal"
                      size="sm"
                      loading={isConnectingUsb}
                      leftSection={<IconUsb size={16} />}
                      onClick={handleConnectUsb}
                    >
                      Connect USB Printer (Silent)
                    </Button>
                  </Tooltip>
                )
              )}

              <Button
                variant="light"
                color="gray"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={() => loadInitialData()}
              >
                Refresh
              </Button>
            </Group>
          }
        />

        {latestPrintedOrderId && (
          <Alert
            icon={<IconBellRinging size={18} />}
            title="New Order Received!"
            color="teal"
            mb="md"
            withCloseButton
            onClose={() => setLatestPrintedOrderId(null)}
          >
            Order #{latestPrintedOrderId.slice(0, 8).toUpperCase()} was received and automatically sent to the 80mm thermal receipt printer.
          </Alert>
        )}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Notice" color="red" mb="md">
            {error}
          </Alert>
        )}

        <Card
          padding="md"
          radius="md"
          mb="md"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <Group justify="space-between">
            <Select
              label="Filter by Status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val || "ALL")}
              w={200}
              data={[
                { value: "ALL", label: "All Statuses" },
                { value: "PENDING", label: "Pending" },
                { value: "CONFIRMED", label: "Confirmed" },
                { value: "PREPARING", label: "Preparing" },
                { value: "READY", label: "Ready" },
                { value: "SERVED", label: "Served" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
            <Text size="sm" style={{ color: "var(--color-text-muted)" }}>
              Showing {filteredOrders.length} of {orders.length} order(s)
            </Text>
          </Group>
        </Card>

        <Card
          padding="lg"
          radius="md"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          {filteredOrders.length === 0 ? (
            <EmptyState
              title="No orders found"
              description={
                statusFilter === "ALL"
                  ? "No customer orders have been placed yet."
                  : `No orders matching status '${statusFilter}'.`
              }
              icon={<IconReceipt size={48} />}
            />
          ) : (
            <Box style={{ overflowX: "auto" }}>
              <Table striped highlightOnHover verticalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Order Ref</Table.Th>
                    <Table.Th>Table</Table.Th>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Quick Update</Table.Th>
                    <Table.Th>Thermal Print</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredOrders.map((order) => (
                    <Table.Tr key={order.id}>
                      <Table.Td>
                        <Text size="sm" fw={700} style={{ color: "var(--color-text)" }}>
                          #{order.id.slice(0, 8).toUpperCase()}
                        </Text>
                        <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                          ID: {order.id.slice(0, 16)}...
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color="dark">
                          {getTableNumber(order.tableId, order.table)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : "-"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <StatusBadge status={order.status} />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          w={140}
                          value={order.status}
                          onChange={(val) => {
                            if (val) handleStatusChange(order.id, val as OrderStatus);
                          }}
                          data={[
                            { value: "PENDING", label: "Pending" },
                            { value: "CONFIRMED", label: "Confirmed" },
                            { value: "PREPARING", label: "Preparing" },
                            { value: "READY", label: "Ready" },
                            { value: "SERVED", label: "Served" },
                            { value: "COMPLETED", label: "Completed" },
                            { value: "CANCELLED", label: "Cancelled" },
                          ]}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="light"
                          color="teal"
                          size="xs"
                          loading={printingOrderId === order.id}
                          leftSection={<IconPrinter size={14} />}
                          onClick={async () => {
                            setPrintingOrderId(order.id);
                            try {
                              await handlePrintOrder(order);
                            } finally {
                              setPrintingOrderId(null);
                            }
                          }}
                        >
                          Print (80mm)
                        </Button>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          size="xs"
                          leftSection={<IconEye size={16} />}
                          onClick={() => handleViewOrder(order)}
                        >
                          Details
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}
        </Card>

        {/* Order Details Modal */}
        <Modal
          opened={modalOpened}
          onClose={closeModal}
          title={
            <Group gap="xs">
              <Text fw={700}>Order #{selectedOrder?.id.slice(0, 8).toUpperCase()}</Text>
              {selectedOrder && <StatusBadge status={selectedOrder.status} />}
            </Group>
          }
          size="lg"
        >
          {selectedOrder && (
            <Stack gap="md">
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed">
                    TABLE
                  </Text>
                  <Text fw={600}>{getTableNumber(selectedOrder.tableId, selectedOrder.table)}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">
                    PLACED AT
                  </Text>
                  <Text fw={600}>
                    {selectedOrder.createdAt
                      ? new Date(selectedOrder.createdAt).toLocaleString()
                      : "N/A"}
                  </Text>
                </Box>
              </Group>

              <Divider />

              <Title order={5}>Ordered Items</Title>
              {loadingItems ? (
                <Loading message="Loading items..." minHeight="120px" />
              ) : orderItems.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No item details found for this order.
                </Text>
              ) : (
                <Table withTableBorder withColumnBorders verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th style={{ width: 80, textAlign: "center" }}>Qty</Table.Th>
                      <Table.Th style={{ width: 100, textAlign: "right" }}>Price</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {orderItems.map((item) => {
                      const itemAddons =
                        item.addons || item.orderItemAddons || (item as any).OrderItemAddons || [];

                      return (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {item.menuItem?.name || `Item ${item.menuItemId.slice(0, 8)}`}
                            </Text>
                            {item.menuItem?.description && (
                              <Text size="xs" c="dimmed">
                                {item.menuItem.description}
                              </Text>
                            )}
                            {itemAddons && itemAddons.length > 0 && (
                              <Group gap={4} mt={6} wrap="wrap">
                                {itemAddons.map((ad: any, idx: number) => {
                                  const name = ad.addon?.name || ad.name || "Addon";
                                  const price = Number(ad.addon?.price ?? ad.price ?? 0);
                                  const qty = Number(ad.quantity || 1);
                                  return (
                                    <Badge key={idx} variant="outline" color="teal" size="xs">
                                      + {qty > 1 ? `${qty}x ` : ""}{name}{price > 0 ? ` ($${(price * qty).toFixed(2)})` : ""}
                                    </Badge>
                                  );
                                })}
                              </Group>
                            )}
                          </Table.Td>
                          <Table.Td style={{ textAlign: "center" }}>
                            <Badge variant="filled" color="gray" size="sm">
                              {item.quantity}x
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Text size="sm">
                              {item.price !== undefined
                                ? `$${Number(item.price).toFixed(2)}`
                                : item.menuItem?.price !== undefined
                                  ? `$${Number(item.menuItem.price).toFixed(2)}`
                                  : "-"}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              )}

              {selectedOrder.notes && (
                <Alert color="orange" title="Special Notes / Instructions" variant="light">
                  {selectedOrder.notes}
                </Alert>
              )}

              <Divider />

              <Group justify="space-between" wrap="wrap" gap="xs">
                <Group gap="xs" wrap="wrap">
                  <Button
                    variant="filled"
                    color="teal"
                    loading={isPrintingModal}
                    leftSection={<IconPrinter size={16} />}
                    onClick={async () => {
                      if (!selectedOrder) return;
                      setIsPrintingModal(true);
                      try {
                        await handlePrintOrder(selectedOrder, orderItems);
                      } finally {
                        setIsPrintingModal(false);
                      }
                    }}
                  >
                    Print All Tickets
                  </Button>
                  <Button
                    variant="light"
                    color="orange"
                    size="sm"
                    loading={isPrintingModal}
                    leftSection={<Text size="xs">🍳</Text>}
                    onClick={async () => {
                      if (!selectedOrder) return;
                      setIsPrintingModal(true);
                      try {
                        await handlePrintOrder(selectedOrder, orderItems, "kitchen");
                      } finally {
                        setIsPrintingModal(false);
                      }
                    }}
                  >
                    Kitchen Slip
                  </Button>
                  <Button
                    variant="light"
                    color="grape"
                    size="sm"
                    loading={isPrintingModal}
                    leftSection={<Text size="xs">🍸</Text>}
                    onClick={async () => {
                      if (!selectedOrder) return;
                      setIsPrintingModal(true);
                      try {
                        await handlePrintOrder(selectedOrder, orderItems, "bar");
                      } finally {
                        setIsPrintingModal(false);
                      }
                    }}
                  >
                    Bar Slip
                  </Button>
                </Group>
                <Button variant="default" onClick={closeModal}>
                  Close
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>

        {/* LAN / Network Printer Configuration Modal */}
        <Modal
          opened={lanModalOpened}
          onClose={closeLanModal}
          title={
            <Group gap="xs">
              <IconNetwork size={20} color="var(--mantine-color-teal-6)" />
              <Text fw={700}>Dual Station Thermal Printer Setup (Kitchen & Bar)</Text>
            </Group>
          }
          size="lg"
          radius="md"
        >
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text size="sm" c="dimmed">
                Configure dedicated 80mm thermal printers for Kitchen (Food) and Bar (Drinks).
              </Text>
              <Group gap="xs">
                <Badge
                  size="sm"
                  variant="light"
                  color={agentActive ? "teal" : "blue"}
                  style={{ cursor: "pointer" }}
                  onClick={openAgentModal}
                >
                  {agentActive ? "Print Agent: Active (Local PC) ⚙️" : "Print Gateway: Web Mode"}
                </Badge>
                <Button
                  size="xs"
                  variant={agentActive ? "subtle" : "light"}
                  color="blue"
                  leftSection={<IconDownload size={14} />}
                  onClick={openAgentModal}
                >
                  {agentActive ? "Agent Packages" : "Download Print Agent"}
                </Button>
              </Group>
            </Group>

            {/* Station Selector Tabs */}
            <Tabs value={activeStationTab} onChange={handleStationTabChange} color="teal">
              <Tabs.List grow>
                <Tabs.Tab
                  value="kitchen"
                  leftSection={<Text size="sm">🍳</Text>}
                  rightSection={
                    <Badge
                      size="xs"
                      color={
                        kitchenConfig.enabled
                          ? kitchenOnline
                            ? "teal"
                            : kitchenOnline === false
                            ? "red"
                            : "gray"
                          : "gray"
                      }
                      variant="filled"
                    >
                      {kitchenConfig.enabled
                        ? kitchenOnline
                          ? "Online"
                          : kitchenOnline === false
                          ? "Offline"
                          : "Ready"
                        : "Disabled"}
                    </Badge>
                  }
                >
                  Kitchen Station (Food)
                </Tabs.Tab>
                <Tabs.Tab
                  value="bar"
                  leftSection={<Text size="sm">🍸</Text>}
                  rightSection={
                    <Badge
                      size="xs"
                      color={
                        barConfig.enabled
                          ? barOnline
                            ? "grape"
                            : barOnline === false
                            ? "red"
                            : "gray"
                          : "gray"
                      }
                      variant="filled"
                    >
                      {barConfig.enabled
                        ? barOnline
                          ? "Online"
                          : barOnline === false
                          ? "Offline"
                          : "Ready"
                        : "Disabled"}
                    </Badge>
                  }
                >
                  Bar Station (Drinks)
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            {/* Station Enabled Toggle */}
            <Card withBorder padding="xs" radius="sm">
              <Group justify="space-between" align="center">
                <Box>
                  <Text size="sm" fw={600}>
                    Enable {activeStationTab === "bar" ? "Bar" : "Kitchen"} Station Printing
                  </Text>
                  <Text size="xs" c="dimmed">
                    {activeStationTab === "bar"
                      ? "Automatically print drink & beverage tickets to this printer"
                      : "Automatically print food order tickets to this printer"}
                  </Text>
                </Box>
                <Switch
                  checked={stationEnabled}
                  onChange={(e) => setStationEnabled(e.currentTarget.checked)}
                  color={activeStationTab === "bar" ? "grape" : "teal"}
                />
              </Group>
            </Card>

            {/* Auto-Detection Card */}
            <Card withBorder padding="md" radius="md" style={{ background: "var(--mantine-color-teal-0)" }}>
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Box>
                  <Group gap="xs">
                    <Text fw={700} size="sm">Auto-Detect on Local Network</Text>
                    <Badge size="xs" color="teal" variant="light">Subnet Scan</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Scans your network for port 9100 thermal printers to assign to Kitchen or Bar
                  </Text>
                </Box>
                <Button
                  color="teal"
                  variant="filled"
                  size="sm"
                  loading={isDiscovering}
                  leftSection={<IconSearch size={16} />}
                  onClick={handleDiscoverLan}
                >
                  {isDiscovering ? "Scanning Network..." : "Auto-Detect Printers"}
                </Button>
              </Group>

              {/* Discovered Printers List */}
              {discoveredPrinters.length > 0 && (
                <Stack gap="xs" mt="md">
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                    Found Printers ({discoveredPrinters.length}):
                  </Text>
                  {discoveredPrinters.map((p) => {
                    const isCurrentKitchen = kitchenConfig.ip === p.ip;
                    const isCurrentBar = barConfig.ip === p.ip;
                    return (
                      <Paper
                        key={p.ip}
                        withBorder
                        p="xs"
                        radius="sm"
                        style={{
                          backgroundColor: "white",
                        }}
                      >
                        <Group justify="space-between" wrap="wrap" gap="xs">
                          <Group gap="xs" wrap="nowrap">
                            <IconPrinter size={22} color="var(--mantine-color-teal-7)" />
                            <Box>
                              <Group gap="xs">
                                <Text size="sm" fw={700}>{p.name}</Text>
                                <Badge size="xs" color="teal" variant="light">Port {p.port}</Badge>
                                {isCurrentKitchen && (
                                  <Badge size="xs" color="teal" variant="filled">🍳 Kitchen Assigned</Badge>
                                )}
                                {isCurrentBar && (
                                  <Badge size="xs" color="grape" variant="filled">🍸 Bar Assigned</Badge>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">IP: {p.ip}</Text>
                            </Box>
                          </Group>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant={isCurrentKitchen ? "light" : "filled"}
                              color="teal"
                              onClick={() => handleAssignDiscoveredPrinter(p, "kitchen")}
                            >
                              Assign 🍳 Kitchen
                            </Button>
                            <Button
                              size="xs"
                              variant={isCurrentBar ? "light" : "filled"}
                              color="grape"
                              onClick={() => handleAssignDiscoveredPrinter(p, "bar")}
                            >
                              Assign 🍸 Bar
                            </Button>
                          </Group>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Card>

            <Divider
              label={`${activeStationTab === "bar" ? "🍸 Bar Station" : "🍳 Kitchen Station"} IP Configuration`}
              labelPosition="center"
            />

            <TextInput
              label={`${activeStationTab === "bar" ? "Bar" : "Kitchen"} Printer IP Address`}
              placeholder="e.g. 192.168.1.100"
              value={stationIpInput}
              onChange={(e) => setStationIpInput(e.currentTarget.value)}
              description="IP address of the 80mm thermal receipt printer at this station"
            />

            <TextInput
              label="Port"
              placeholder="9100"
              value={stationPortInput}
              onChange={(e) => setStationPortInput(e.currentTarget.value)}
              description="Standard raw ESC/POS port is 9100"
            />

            {lanTestResult && (
              <Alert
                color={lanTestResult.success ? "teal" : "red"}
                icon={lanTestResult.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                title={lanTestResult.success ? "Connection Verified" : "Notice"}
              >
                {lanTestResult.message}
              </Alert>
            )}

            <Group justify="space-between" mt="md" wrap="wrap" gap="sm">
              <Group gap="xs">
                <Button
                  variant="light"
                  color="blue"
                  loading={isTestingLan}
                  disabled={!stationIpInput.trim()}
                  onClick={handleTestLan}
                >
                  Ping Connection
                </Button>
                <Button
                  variant="filled"
                  color={activeStationTab === "bar" ? "grape" : "teal"}
                  loading={isPrintingTestSlip}
                  disabled={!stationIpInput.trim()}
                  leftSection={<IconPrinter size={16} />}
                  onClick={handlePrintTestSlip}
                >
                  Print Test Slip
                </Button>
              </Group>
              <Group gap="xs">
                <Button variant="default" onClick={closeLanModal}>
                  Cancel
                </Button>
                <Button
                  color={activeStationTab === "bar" ? "grape" : "teal"}
                  onClick={handleSaveStation}
                >
                  Save Station Settings
                </Button>
              </Group>
            </Group>
          </Stack>
        </Modal>

        {/* Print Agent Download and Configuration Modal */}
        <PrintAgentModal
          opened={agentModalOpened}
          onClose={closeAgentModal}
          agentActive={agentActive}
          onStatusChange={(active) => setAgentActive(active)}
        />
      </Box>
    );
}

