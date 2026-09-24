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
import { printThermalReceipt, ReceiptData, ReceiptItem } from "@/utils/thermalReceipt";
import {
  connectUsbPrinter,
  disconnectUsbPrinter,
  subscribePrinterStatus,
  tryAutoReconnectUsbPrinter,
  ConnectedUsbPrinter,
  isUsbPrintSupported,
} from "@/utils/usbPrinter";
import {
  getLanPrinterConfig,
  saveLanPrinterConfig,
  checkLanPrinterStatus,
  printTestReceiptToLan,
  discoverLanPrinters,
  autoDetectAndSaveThermalPrinter,
  checkPrintAgentActive,
  LanPrinterConfig,
  DiscoveredPrinter,
} from "@/utils/lanPrinter";

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
  const printedOrderIdsRef = useRef<Set<string>>(new Set());
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

  // LAN / Network Thermal Printer state
  const [lanConfig, setLanConfig] = useState<LanPrinterConfig>(() => getLanPrinterConfig());
  const [lanOnline, setLanOnline] = useState<boolean | null>(null);
  const [lanModalOpened, { open: openLanModal, close: closeLanModal }] = useDisclosure(false);
  const [lanIpInput, setLanIpInput] = useState<string>(lanConfig.ip);
  const [lanPortInput, setLanPortInput] = useState<string>(String(lanConfig.port || 9100));
  const [isTestingLan, setIsTestingLan] = useState<boolean>(false);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [lanTestResult, setLanTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [agentActive, setAgentActive] = useState<boolean | null>(null);
  const [agentModalOpened, { open: openAgentModal, close: closeAgentModal }] = useDisclosure(false);

  useEffect(() => {
    checkPrintAgentActive().then(setAgentActive);
    const config = getLanPrinterConfig();
    setLanConfig(config);
    setLanIpInput(config.ip);
    setLanPortInput(String(config.port || 9100));

    if (config.ip) {
      checkLanPrinterStatus(config.ip, config.port).then((res) => {
        setLanOnline(res.online);
      });
    } else {
      // Auto-detect printer dynamically on the local network if no IP configured
      setIsDiscovering(true);
      autoDetectAndSaveThermalPrinter()
        .then((found) => {
          setIsDiscovering(false);
          if (found) {
            const updated = getLanPrinterConfig();
            setLanConfig(updated);
            setLanIpInput(updated.ip);
            setLanPortInput(String(updated.port));
            setLanOnline(true);
          }
        })
        .catch(() => {
          setIsDiscovering(false);
        });
    }
  }, []);

  useEffect(() => {
    if (lanConfig.ip) {
      checkLanPrinterStatus(lanConfig.ip, lanConfig.port).then((res) => {
        setLanOnline(res.online);
      });
    } else {
      setLanOnline(null);
    }
  }, [lanConfig.ip, lanConfig.port]);

  const handleDiscoverLan = async () => {
    setIsDiscovering(true);
    setLanTestResult(null);
    try {
      const printers = await discoverLanPrinters();
      setDiscoveredPrinters(printers);
      if (printers.length === 0) {
        setLanTestResult({
          success: false,
          message: "No raw port 9100 printers detected on your local subnet. Please verify printer is powered on and connected to your router.",
        });
      } else {
        const selected = printers[0];
        if (selected) {
          setLanIpInput(selected.ip);
          setLanPortInput(String(selected.port));
          setLanTestResult({
            success: true,
            message: `Found ${printers.length} LAN printer device(s). Selected: ${selected.ip}:${selected.port}`,
          });
        }
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
    try {
      const res = await checkLanPrinterStatus(lanIpInput.trim(), parseInt(lanPortInput, 10));
      if (res.online) {
        setLanTestResult({
          success: true,
          message: `Success! Printer is reachable at ${lanIpInput}:${lanPortInput}`,
        });
      } else {
        setLanTestResult({
          success: false,
          message: res.error || "Cannot connect to printer at this IP",
        });
      }
    } finally {
      setIsTestingLan(false);
    }
  };

  const handlePrintTestSlip = async () => {
    setIsPrintingTestSlip(true);
    setLanTestResult(null);
    try {
      const res = await printTestReceiptToLan(lanIpInput.trim(), parseInt(lanPortInput, 10));
      setLanTestResult(res);
      if (res.success) {
        setLanOnline(true);
      }
    } finally {
      setIsPrintingTestSlip(false);
    }
  };

  const handleSaveLan = () => {
    const updated = saveLanPrinterConfig({
      ip: lanIpInput.trim(),
      port: parseInt(lanPortInput, 10) || 9100,
      enabled: true,
    });
    setLanConfig(updated);
    checkLanPrinterStatus(updated.ip, updated.port).then((res) => setLanOnline(res.online));
    closeLanModal();
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
      async (order: Order, itemsToPrint?: OrderItem[]) => {
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

          return {
            name: it.menuItem?.name || `Item ${it.menuItemId?.slice(0, 8) || ""}`,
            quantity: it.quantity || 1,
            price: Number(it.price ?? it.menuItem?.price ?? 0),
            addons: mappedAddons,
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

        return await printThermalReceipt(receiptData);
      },
      [getTableNumber]
    );

    // Check incoming orders for new ones to automatically print & sound alert
    const checkAndAutoPrintNewOrders = useCallback(
      async (incomingOrders: Order[]) => {
        if (!initialLoadDoneRef.current) {
          // Initial load: record existing orders so past orders are never auto-printed
          incomingOrders.forEach((o) => printedOrderIdsRef.current.add(o.id));
          initialLoadDoneRef.current = true;
          return;
        }

        // Detect orders that haven't been printed yet
        const brandNewOrders = incomingOrders.filter(
          (o) => !printedOrderIdsRef.current.has(o.id)
        );

        if (brandNewOrders.length === 0) return;

        for (const newOrder of brandNewOrders) {
          printedOrderIdsRef.current.add(newOrder.id);
          setLatestPrintedOrderId(newOrder.id);

          // Sound chime for the kitchen staff
          if (soundAlertRef.current) {
            playOrderChime();
          }

          // Automatic 80mm thermal receipt printing
          if (autoPrintRef.current) {
            await handlePrintOrder(newOrder);
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
          const fetchedOrders: Order[] = Array.isArray((ordersRes.value as any).data)
            ? (ordersRes.value as any).data
            : [];
          setOrders(fetchedOrders);
          fetchedOrders.forEach((o) => printedOrderIdsRef.current.add(o.id));
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
            const fetchedOrders: Order[] = ordersRes.data;
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

              {/* LAN Network Thermal Printer Badge & Quick Config */}
              <Tooltip label="Click to configure or auto-detect your Ethernet/LAN Thermal Printer">
                <Badge
                  color={lanConfig.ip ? (lanOnline ? "teal" : lanOnline === false ? "red" : "gray") : "blue"}
                  variant="filled"
                  size="lg"
                  style={{ cursor: "pointer" }}
                  leftSection={<IconNetwork size={14} />}
                  onClick={() => {
                    checkPrintAgentActive().then(setAgentActive);
                    const cfg = getLanPrinterConfig();
                    setLanConfig(cfg);
                    setLanIpInput(cfg.ip);
                    setLanPortInput(String(cfg.port || 9100));
                    setLanTestResult(null);
                    openLanModal();
                  }}
                >
                  LAN: {lanConfig.ip ? `${lanConfig.ip} (${lanOnline ? "Online" : lanOnline === false ? "Offline" : "Checking..."})` : "Auto-Detect Printer"}
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

              <Group justify="space-between">
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
                  Print 80mm Receipt
                </Button>
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
              <Text fw={700}>LAN / Network Thermal Printer Setup</Text>
            </Group>
          }
          size="lg"
          radius="md"
        >
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Text size="sm" c="dimmed">
                Configure your 80mm thermal receipt printer over your local network.
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

            {/* Auto-Detection Card */}
            <Card withBorder padding="md" radius="md" style={{ background: "var(--mantine-color-teal-0)" }}>
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Box>
                  <Group gap="xs">
                    <Text fw={700} size="sm">Auto-Detect on Local Network</Text>
                    <Badge size="xs" color="teal" variant="light">Fast Subnet Scan</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Scans your router subnet for raw ESC/POS thermal printers on port 9100
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
                    const isSelected = lanIpInput.trim() === p.ip;
                    return (
                      <Paper
                        key={p.ip}
                        withBorder
                        p="xs"
                        radius="sm"
                        style={{
                          cursor: "pointer",
                          borderColor: isSelected ? "var(--mantine-color-teal-6)" : undefined,
                          backgroundColor: isSelected ? "var(--mantine-color-teal-1)" : "white",
                        }}
                        onClick={() => {
                          setLanIpInput(p.ip);
                          setLanPortInput(String(p.port));
                          setLanTestResult(null);
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap">
                            <IconPrinter size={22} color="var(--mantine-color-teal-7)" />
                            <Box>
                              <Group gap="xs">
                                <Text size="sm" fw={700}>{p.name}</Text>
                                <Badge size="xs" color="teal" variant="light">Port {p.port}</Badge>
                                {p.source === "local-agent" ? (
                                  <Badge size="xs" color="blue" variant="outline">via Local Agent</Badge>
                                ) : (
                                  <Badge size="xs" color="gray" variant="outline">via Server Route</Badge>
                                )}
                              </Group>
                              <Text size="xs" c="dimmed">IP: {p.ip}</Text>
                            </Box>
                          </Group>
                          <Button
                            size="xs"
                            variant={isSelected ? "filled" : "light"}
                            color="teal"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLanIpInput(p.ip);
                              setLanPortInput(String(p.port));
                              setLanTestResult(null);
                            }}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </Button>
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Card>

            <Divider label="Active Printer Settings" labelPosition="center" />

            <TextInput
              label="Printer IP Address"
              placeholder="e.g. 192.168.1.100"
              value={lanIpInput}
              onChange={(e) => setLanIpInput(e.currentTarget.value)}
              description="Automatically detected by Auto-Detect, or enter manually"
            />

            <TextInput
              label="Port"
              placeholder="9100"
              value={lanPortInput}
              onChange={(e) => setLanPortInput(e.currentTarget.value)}
              description="Standard thermal printer raw port is 9100"
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
                  disabled={!lanIpInput.trim()}
                  onClick={handleTestLan}
                >
                  Ping Connection
                </Button>
                <Button
                  variant="filled"
                  color="teal"
                  loading={isPrintingTestSlip}
                  disabled={!lanIpInput.trim()}
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
                <Button color="teal" onClick={handleSaveLan} disabled={!lanIpInput.trim()}>
                  Save & Set Active
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

