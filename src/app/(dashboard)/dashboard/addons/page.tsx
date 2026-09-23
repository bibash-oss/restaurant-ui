"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Card,
  Table,
  Group,
  Text,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Switch,
  Stack,
  Box,
  ActionIcon,
  Alert,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  APIGetAddonsByRestaurant,
  APICreateAddon,
  APIUpdateAddon,
  APIDeleteAddon,
} from "@/api/addons";
import { Addon } from "@/types";

interface AddonFormData {
  name: string;
  price: number;
  isActive?: boolean;
}

export default function AddonsPage() {
  const { restaurantId } = useAuth();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddonFormData>({
    defaultValues: {
      name: "",
      price: 0,
      isActive: true,
    },
  });

  const loadAddons = useCallback(async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await APIGetAddonsByRestaurant(restaurantId);
      if (res?.data) {
        setAddons(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : "Failed to load addons");
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadAddons();
  }, [loadAddons]);

  const handleOpenAdd = () => {
    setEditingAddon(null);
    reset({ name: "", price: 0, isActive: true });
    openModal();
  };

  const handleOpenEdit = (addon: Addon) => {
    setEditingAddon(addon);
    reset({
      name: addon.name,
      price: Number(addon.price) || 0,
      isActive: addon.isActive !== false,
    });
    openModal();
  };

  const onSubmit = async (data: AddonFormData) => {
    if (!restaurantId) return;
    try {
      if (editingAddon) {
        const payload = {
          name: data.name,
          price: Number(data.price),
          isActive: data.isActive,
        };
        await APIUpdateAddon(editingAddon.id, payload);
      } else {
        const payload = {
          restaurantId,
          name: data.name,
          price: Number(data.price),
        };
        await APICreateAddon(payload);
      }
      closeModal();
      loadAddons();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to save addon");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this add-on?")) return;
    try {
      await APIDeleteAddon(id);
      loadAddons();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to delete addon");
    }
  };

  if (isLoading) {
    return <Loading message="Loading restaurant add-ons..." />;
  }

  return (
    <Box>
      <PageHeader
        title="Add-ons & Modifiers"
        description="Extra ingredients, sides, and customizations that can be attached to dishes"
        action={
          <Group>
            <Button
              variant="light"
              color="gray"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={loadAddons}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={handleOpenAdd}
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Add Modifier
            </Button>
          </Group>
        }
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Notice" color="red" mb="md">
          {error}
        </Alert>
      )}

      <Card
        padding="lg"
        radius="md"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        {addons.length === 0 ? (
          <EmptyState
            title="No add-ons created yet"
            description="Create extras such as Extra Cheese, Bacon, Gluten-free bun, or Double Patty."
            icon={<IconPlus size={48} />}
            action={
              <Button
                size="xs"
                onClick={handleOpenAdd}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Create First Add-on
              </Button>
            }
          />
        ) : (
          <Box style={{ overflowX: "auto" }}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Extra Price</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {addons.map((addon) => (
                  <Table.Tr key={addon.id}>
                    <Table.Td>
                      <Text size="sm" fw={600} style={{ color: "var(--color-text)" }}>
                        {addon.name}
                      </Text>
                      <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                        ID: {addon.id.slice(0, 12)}...
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        +${Number(addon.price).toFixed(2)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={addon.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Group gap={4} justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={() => handleOpenEdit(addon)}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDelete(addon.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Card>

      {/* Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={<Text fw={700}>{editingAddon ? "Edit Add-on" : "Create New Add-on"}</Text>}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md">
            <TextInput
              label="Add-on Name"
              placeholder="e.g. Extra Cheese, Truffle Dip"
              required
              error={errors.name?.message}
              {...register("name", { required: "Name is required" })}
            />

            <Controller
              name="price"
              control={control}
              rules={{
                required: "Price is required",
                min: { value: 0, message: "Price cannot be negative" },
              }}
              render={({ field }) => (
                <NumberInput
                  label="Extra Price ($)"
                  placeholder="1.50"
                  prefix="$"
                  decimalScale={2}
                  min={0}
                  value={field.value}
                  onChange={(val) => field.onChange(Number(val))}
                  error={errors.price?.message}
                  required
                />
              )}
            />

            {editingAddon && (
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch
                    label="Active & Available to Order"
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
                {editingAddon ? "Save Changes" : "Create Add-on"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Box>
  );
}
