"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  SimpleGrid,
  Card,
  Text,
  Group,
  Title,
  Stack,
  Button,
  Table,
  Box,
  Alert,
  Select,
} from "@mantine/core";
import {
  IconReceipt,
  IconToolsKitchen2,
  IconArmchair,
  IconPlus,
  IconArrowRight,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { APIGetOrdersByRestaurant, APIUpdateOrderStatus } from "@/api/orders";
import { APIGetTablesByRestaurant } from "@/api/tables";
import { APIGetMenuItemsByRestaurant } from "@/api/menu";
import { APIGetAddonsByRestaurant } from "@/api/addons";
import { Order, Table as TableType, MenuItem, Addon, OrderStatus } from "@/types";

export default function DashboardOverviewPage() {
  const { restaurant, restaurantId } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [ordersRes, tablesRes, menuRes, addonsRes] = await Promise.allSettled([
        APIGetOrdersByRestaurant(restaurantId),
        APIGetTablesByRestaurant(restaurantId),
        APIGetMenuItemsByRestaurant(restaurantId),
        APIGetAddonsByRestaurant(restaurantId),
      ]);

      if (ordersRes.status === "fulfilled" && (ordersRes.value as any)?.data) {
        setOrders(Array.isArray((ordersRes.value as any).data) ? (ordersRes.value as any).data : []);
      }
      if (tablesRes.status === "fulfilled" && (tablesRes.value as any)?.data) {
        setTables(Array.isArray((tablesRes.value as any).data) ? (tablesRes.value as any).data : []);
      }
      if (menuRes.status === "fulfilled" && (menuRes.value as any)?.data) {
        setMenuItems(Array.isArray((menuRes.value as any).data) ? (menuRes.value as any).data : []);
      }
      if (addonsRes.status === "fulfilled" && (addonsRes.value as any)?.data) {
        setAddons(Array.isArray((addonsRes.value as any).data) ? (addonsRes.value as any).data : []);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : "Failed to load dashboard statistics");
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await APIUpdateOrderStatus(orderId, { status: newStatus });
      // Update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err: any) {
      console.error("Failed to update order status", err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const activeOrders = orders.filter(
    (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED"
  );

  const stats = [
    {
      title: "Active Orders",
      value: activeOrders.length,
      icon: <IconReceipt size={28} />,
      color: "var(--color-primary)",
      bgColor: "var(--color-primary-light)",
      link: "/dashboard/orders",
    },
    {
      title: "Tables",
      value: tables.length,
      icon: <IconArmchair size={28} />,
      color: "var(--color-secondary)",
      bgColor: "var(--color-surface-hover)",
      link: "/dashboard/tables",
    },
    {
      title: "Menu Items",
      value: menuItems.length,
      icon: <IconToolsKitchen2 size={28} />,
      color: "var(--color-warning)",
      bgColor: "var(--color-warning-light)",
      link: "/dashboard/menu",
    },
    {
      title: "Active Add-ons",
      value: addons.filter((a) => a.isActive !== false).length,
      icon: <IconPlus size={28} />,
      color: "var(--color-success)",
      bgColor: "var(--color-success-light)",
      link: "/dashboard/addons",
    },
  ];

  if (isLoading) {
    return <Loading message="Loading restaurant data..." />;
  }

  return (
    <Box>
      <PageHeader
        title={`Welcome to ${restaurant?.name || "Kitchen"}`}
        description={`Restaurant ID: ${restaurantId || "N/A"} • ${restaurant?.address || "Main Branch"}`}
        action={
          <Button
            variant="light"
            color="gray"
            size="sm"
            leftSection={<IconRefresh size={16} />}
            onClick={loadData}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Notice"
          color="red"
          variant="light"
          mb="lg"
        >
          {error}
        </Alert>
      )}

      {/* KPI Stats Grid */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            padding="lg"
            radius="md"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  {stat.title}
                </Text>
                <Title order={2} style={{ color: "var(--color-text)" }}>
                  {stat.value}
                </Title>
              </Stack>
              <Box
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "10px",
                  backgroundColor: stat.bgColor,
                  color: stat.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {stat.icon}
              </Box>
            </Group>
            <Group justify="flex-end" mt="md">
              <Button
                component={Link}
                href={stat.link}
                variant="subtle"
                size="xs"
                color="gray"
                rightSection={<IconArrowRight size={14} />}
              >
                View
              </Button>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Recent Orders Section */}
      <Card
        padding="lg"
        radius="md"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={4} style={{ color: "var(--color-text)" }}>
              Recent Orders
            </Title>
            <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
              Real-time incoming customer orders and kitchen tickets
            </Text>
          </Box>
          <Button
            component={Link}
            href="/dashboard/orders"
            variant="light"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
          >
            All Orders
          </Button>
        </Group>

        {orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="When customers place orders at tables, they will show up here."
          />
        ) : (
          <Box style={{ overflowX: "auto" }}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order ID</Table.Th>
                  <Table.Th>Table</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.slice(0, 5).map((order) => {
                  const tableNumber =
                    order.table?.number ||
                    tables.find((t) => t.id === order.tableId)?.number ||
                    "Table";

                  return (
                    <Table.Tr key={order.id}>
                      <Table.Td>
                        <Text size="sm" fw={600} style={{ color: "var(--color-text)" }}>
                          #{order.id.slice(0, 8)}
                        </Text>
                        <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : ""}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {tableNumber}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {order.items?.length ?? 1} item(s)
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
                          disabled={updatingOrderId === order.id}
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
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Card>
    </Box>
  );
}
