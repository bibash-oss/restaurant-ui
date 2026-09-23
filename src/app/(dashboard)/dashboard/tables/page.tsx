"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  SimpleGrid,
  Card,
  Group,
  Text,
  Button,
  Modal,
  TextInput,
  Switch,
  Stack,
  Box,
  Badge,
  ActionIcon,
  Alert,
  Title,
  Table as MantineTable,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArmchair,
  IconPlus,
  IconPencil,
  IconTrash,
  IconReceipt,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  APIGetTablesByRestaurant,
  APICreateTable,
  APIUpdateTable,
  APIDeleteTable,
} from "@/api/tables";
import { APIGetOrdersByTable } from "@/api/orders";
import { Table as TableType, Order } from "@/types";

interface TableFormData {
  number: string;
  isActive?: boolean;
}

export default function TablesPage() {
  const { restaurantId } = useAuth();
  const [tables, setTables] = useState<TableType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit / Create Modal
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);

  // Table Orders Modal
  const [ordersModalOpened, { open: openOrdersModal, close: closeOrdersModal }] = useDisclosure(false);
  const [activeTableForOrders, setActiveTableForOrders] = useState<TableType | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TableFormData>({
    defaultValues: {
      number: "",
      isActive: true,
    },
  });

  const loadTables = useCallback(async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await APIGetTablesByRestaurant(restaurantId);
      if (res?.data) {
        setTables(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : "Failed to load tables");
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const handleOpenAdd = () => {
    setEditingTable(null);
    reset({ number: "", isActive: true });
    openModal();
  };

  const handleOpenEdit = (table: TableType) => {
    setEditingTable(table);
    reset({ number: table.number, isActive: table.isActive !== false });
    openModal();
  };

  const onSubmit = async (data: TableFormData) => {
    if (!restaurantId) return;
    try {
      if (editingTable) {
        const payload = {
          number: data.number,
          isActive: data.isActive,
        };
        await APIUpdateTable(editingTable.id, payload);
      } else {
        const payload = {
          restaurantId,
          number: data.number,
        };
        await APICreateTable(payload);
      }
      closeModal();
      loadTables();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to save table");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;
    try {
      await APIDeleteTable(id);
      loadTables();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to delete table");
    }
  };

  const handleViewOrders = async (table: TableType) => {
    setActiveTableForOrders(table);
    openOrdersModal();
    setLoadingOrders(true);
    try {
      const res: any = await APIGetOrdersByTable(table.id);
      if (res?.data) {
        setTableOrders(Array.isArray(res.data) ? res.data : []);
      } else {
        setTableOrders([]);
      }
    } catch {
      setTableOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  if (isLoading) {
    return <Loading message="Loading restaurant tables..." />;
  }

  return (
    <Box>
      <PageHeader
        title="Restaurant Tables"
        description="Manage dining tables, active seatings, and view current table orders"
        action={
          <Group>
            <Button
              variant="light"
              color="gray"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={loadTables}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenAdd}
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Add Table
            </Button>
          </Group>
        }
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Notice" color="red" mb="md">
          {error}
        </Alert>
      )}

      {tables.length === 0 ? (
        <Card padding="xl" radius="md">
          <EmptyState
            title="No tables configured"
            description="Configure tables for your dining area so customers and waiters can place orders."
            icon={<IconArmchair size={48} />}
            action={
              <Button
                size="xs"
                onClick={handleOpenAdd}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Create First Table
              </Button>
            }
          />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {tables.map((table) => (
            <Card
              key={table.id}
              padding="lg"
              radius="md"
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Group justify="space-between" align="center" mb="xs">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "8px",
                      backgroundColor: "var(--color-primary-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-primary)",
                    }}
                  >
                    <IconArmchair size={22} />
                  </Box>
                  <StatusBadge status={table.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                </Group>

                <Title order={3} style={{ color: "var(--color-text)", margin: "0.25rem 0" }}>
                  Table {table.number}
                </Title>
                <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                  ID: {table.id.slice(0, 12)}...
                </Text>
              </Box>

              <Box mt="lg">
                <Divider mb="sm" style={{ borderColor: "var(--color-border)" }} />
                <Group justify="space-between">
                  <Button
                    variant="light"
                    size="xs"
                    color="gray"
                    leftSection={<IconReceipt size={14} />}
                    onClick={() => handleViewOrders(table)}
                  >
                    Orders
                  </Button>
                  <Group gap={4}>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      onClick={() => handleOpenEdit(table)}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(table.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Box>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {/* Create / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={<Text fw={700}>{editingTable ? "Edit Table" : "Add New Table"}</Text>}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md">
            <TextInput
              label="Table Number / Identifier"
              placeholder="e.g. T-01, Rooftop-A"
              required
              error={errors.number?.message}
              {...register("number", { required: "Table number is required" })}
            />

            {editingTable && (
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    label="Active & Available"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {editingTable ? "Save Changes" : "Create Table"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Table Orders Modal */}
      <Modal
        opened={ordersModalOpened}
        onClose={closeOrdersModal}
        title={
          <Group gap="xs">
            <IconReceipt size={20} />
            <Text fw={700}>Orders for Table {activeTableForOrders?.number}</Text>
          </Group>
        }
        size="lg"
      >
        {loadingOrders ? (
          <Loading message="Fetching table orders..." minHeight="140px" />
        ) : tableOrders.length === 0 ? (
          <EmptyState
            title="No orders at this table"
            description="There are currently no orders placed for this table."
          />
        ) : (
          <MantineTable striped highlightOnHover>
            <MantineTable.Thead>
              <MantineTable.Tr>
                <MantineTable.Th>Order Ref</MantineTable.Th>
                <MantineTable.Th>Placed</MantineTable.Th>
                <MantineTable.Th>Status</MantineTable.Th>
              </MantineTable.Tr>
            </MantineTable.Thead>
            <MantineTable.Tbody>
              {tableOrders.map((order) => (
                <MantineTable.Tr key={order.id}>
                  <MantineTable.Td>
                    <Text size="sm" fw={600}>
                      #{order.id.slice(0, 8)}
                    </Text>
                  </MantineTable.Td>
                  <MantineTable.Td>
                    <Text size="xs">
                      {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : "-"}
                    </Text>
                  </MantineTable.Td>
                  <MantineTable.Td>
                    <StatusBadge status={order.status} />
                  </MantineTable.Td>
                </MantineTable.Tr>
              ))}
            </MantineTable.Tbody>
          </MantineTable>
        )}
      </Modal>
    </Box>
  );
}
