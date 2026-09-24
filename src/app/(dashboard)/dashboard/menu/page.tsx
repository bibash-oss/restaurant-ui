"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Tabs,
  Card,
  Table,
  Group,
  Text,
  Button,
  Modal,
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Switch,
  MultiSelect,
  Stack,
  Box,
  Badge,
  ActionIcon,
  Alert,
  SimpleGrid,
  Image,
  SegmentedControl,
  Center,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconToolsKitchen2,
  IconCategory,
  IconPaperclip,
  IconRefresh,
  IconAlertCircle,
  IconGlassFull,
} from "@tabler/icons-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  APIGetCategoriesByRestaurant,
  APICreateCategory,
  APIUpdateCategory,
  APIDeleteCategory,
  APIGetMenuItemsByRestaurant,
  APICreateMenuItem,
  APIUpdateMenuItem,
  APIDeleteMenuItem,
  APIAssignAddonsToMenuItem,
  APIGetAddonsByMenuItem,
} from "@/api/menu";
import { APIGetAddonsByRestaurant } from "@/api/addons";
import { MenuCategory, MenuItem, Addon } from "@/types";

interface ItemFormData {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  menuType: "BAR" | "KITCHEN";
  isActive: boolean;
}

interface CategoryFormData {
  name: string;
}

export default function MenuPage() {
  const { restaurantId } = useAuth();

  const [activeTab, setActiveTab] = useState<string | null>("items");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [menuTypeFilter, setMenuTypeFilter] = useState<string>("ALL");

  // Category Modal State
  const [categoryModalOpened, { open: openCategoryModal, close: closeCategoryModal }] =
    useDisclosure(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

  // Item Modal State
  const [itemModalOpened, { open: openItemModal, close: closeItemModal }] =
    useDisclosure(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Assign Addons Modal State
  const [addonModalOpened, { open: openAddonModal, close: closeAddonModal }] =
    useDisclosure(false);
  const [assigningItem, setAssigningItem] = useState<MenuItem | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [savingAddons, setSavingAddons] = useState<boolean>(false);

  // Forms
  const {
    register: registerItem,
    handleSubmit: handleSubmitItem,
    reset: resetItemForm,
    control: controlItem,
    formState: { errors: itemErrors, isSubmitting: isSubmittingItem },
  } = useForm<ItemFormData>({
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      menuType: "KITCHEN",
      isActive: true,
    },
  });

  const {
    register: registerCat,
    handleSubmit: handleSubmitCat,
    reset: resetCatForm,
    formState: { errors: catErrors, isSubmitting: isSubmittingCat },
  } = useForm<CategoryFormData>({
    defaultValues: {
      name: "",
    },
  });

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [catsRes, itemsRes, addonsRes] = await Promise.allSettled([
        APIGetCategoriesByRestaurant(restaurantId),
        APIGetMenuItemsByRestaurant(restaurantId),
        APIGetAddonsByRestaurant(restaurantId),
      ]);

      if (catsRes.status === "fulfilled" && (catsRes.value as any)?.data) {
        setCategories(Array.isArray((catsRes.value as any).data) ? (catsRes.value as any).data : []);
      }
      if (itemsRes.status === "fulfilled" && (itemsRes.value as any)?.data) {
        setItems(Array.isArray((itemsRes.value as any).data) ? (itemsRes.value as any).data : []);
      }
      if (addonsRes.status === "fulfilled" && (addonsRes.value as any)?.data) {
        setAddons(Array.isArray((addonsRes.value as any).data) ? (addonsRes.value as any).data : []);
      }
    } catch (err: any) {
      setError(typeof err === "string" ? err : "Failed to load menu data");
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Category Handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    resetCatForm({ name: "" });
    openCategoryModal();
  };

  const handleOpenEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    resetCatForm({ name: cat.name });
    openCategoryModal();
  };

  const onSubmitCategory = async (data: CategoryFormData) => {
    if (!restaurantId) return;
    try {
      if (editingCategory) {
        await APIUpdateCategory(editingCategory.id, { name: data.name });
      } else {
        await APICreateCategory({ restaurantId, name: data.name });
      }
      closeCategoryModal();
      loadData();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to save category");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await APIDeleteCategory(id);
      loadData();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to delete category");
    }
  };

  // Item Handlers
  const handleOpenAddItem = () => {
    setEditingItem(null);
    resetItemForm({
      categoryId: categories[0]?.id || "",
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      menuType: "KITCHEN",
      isActive: true,
    });
    openItemModal();
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    resetItemForm({
      categoryId: item.categoryId || "",
      name: item.name,
      description: item.description || "",
      price: Number(item.price) || 0,
      imageUrl: item.imageUrl || "",
      menuType: item.menuType === "BAR" ? "BAR" : "KITCHEN",
      isActive: item.isActive !== false,
    });
    openItemModal();
  };

  const onSubmitItem = async (data: ItemFormData) => {
    if (!restaurantId) return;
    try {
      if (editingItem) {
        const updatePayload = {
          name: data.name,
          description: data.description,
          price: Number(data.price),
          imageUrl: data.imageUrl,
          menuType: data.menuType,
          isActive: data.isActive,
        };
        await APIUpdateMenuItem(editingItem.id, updatePayload);
      } else {
        const createPayload = {
          restaurantId,
          categoryId: data.categoryId,
          name: data.name,
          description: data.description,
          price: Number(data.price),
          imageUrl: data.imageUrl,
          menuType: data.menuType,
        };
        await APICreateMenuItem(createPayload);
      }
      closeItemModal();
      loadData();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to save menu item");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
      await APIDeleteMenuItem(id);
      loadData();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to delete menu item");
    }
  };

  // Assign Addons Handlers
  const handleOpenAssignAddons = async (item: MenuItem) => {
    setAssigningItem(item);
    openAddonModal();
    try {
      const res: any = await APIGetAddonsByMenuItem(item.id);
      if (res?.data && Array.isArray(res.data)) {
        setSelectedAddonIds(res.data.map((a: any) => a.id));
      } else {
        setSelectedAddonIds([]);
      }
    } catch {
      setSelectedAddonIds([]);
    }
  };

  const handleSaveAssignedAddons = async () => {
    if (!assigningItem) return;
    setSavingAddons(true);
    try {
      await APIAssignAddonsToMenuItem(assigningItem.id, { addonIds: selectedAddonIds });
      closeAddonModal();
      loadData();
    } catch (err: any) {
      alert(typeof err === "string" ? err : "Failed to assign addons");
    } finally {
      setSavingAddons(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (menuTypeFilter === "ALL") return true;
    if (menuTypeFilter === "BAR") return item.menuType === "BAR";
    return item.menuType !== "BAR";
  });

  const kitchenCount = items.filter((i) => i.menuType !== "BAR").length;
  const barCount = items.filter((i) => i.menuType === "BAR").length;

  if (isLoading) {
    return <Loading message="Loading menu catalog..." />;
  }

  return (
    <Box>
      <PageHeader
        title="Menu & Catalog"
        description="Organize categories, dishes, prices, bar drinks, and optional add-ons"
        action={
          <Group>
            <Button
              variant="light"
              color="gray"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={loadData}
            >
              Refresh
            </Button>
            {activeTab === "items" ? (
              <Button
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={handleOpenAddItem}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Add Menu Item
              </Button>
            ) : (
              <Button
                size="sm"
                leftSection={<IconPlus size={16} />}
                onClick={handleOpenAddCategory}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Add Category
              </Button>
            )}
          </Group>
        }
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Notice" color="red" mb="md">
          {error}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List mb="md">
          <Tabs.Tab
            value="items"
            leftSection={<IconToolsKitchen2 size={16} />}
          >
            Menu Items ({items.length})
          </Tabs.Tab>
          <Tabs.Tab
            value="categories"
            leftSection={<IconCategory size={16} />}
          >
            Categories ({categories.length})
          </Tabs.Tab>
        </Tabs.List>

        {/* Menu Items Tab */}
        <Tabs.Panel value="items">
          <Card
            padding="lg"
            radius="md"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            {/* Department Filter Bar */}
            <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
              <SegmentedControl
                size="xs"
                value={menuTypeFilter}
                onChange={setMenuTypeFilter}
                data={[
                  { label: `All Items (${items.length})`, value: "ALL" },
                  {
                    label: `🍳 Kitchen (${kitchenCount})`,
                    value: "KITCHEN",
                  },
                  {
                    label: `🍹 Bar (${barCount})`,
                    value: "BAR",
                  },
                ]}
              />
              <Text size="xs" c="dimmed">
                Showing {filteredItems.length} of {items.length} items
              </Text>
            </Group>

            {items.length === 0 ? (
              <EmptyState
                title="No menu items yet"
                description="Add your restaurant's delicious dishes, appetizers, cocktails, or beverages."
                action={
                  <Button
                    size="xs"
                    onClick={handleOpenAddItem}
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Create First Item
                  </Button>
                }
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title={`No ${menuTypeFilter === "BAR" ? "Bar" : "Kitchen"} items found`}
                description={`Switch filter to view other items or create a new ${menuTypeFilter.toLowerCase()} item.`}
              />
            ) : (
              <Box style={{ overflowX: "auto" }}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Add-ons</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredItems.map((item) => {
                      const categoryName =
                        item.category?.name ||
                        categories.find((c) => c.id === item.categoryId)?.name ||
                        "General";

                      const isBar = item.menuType === "BAR";

                      return (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Group gap="sm">
                              {item.imageUrl ? (
                                <Image
                                  src={item.imageUrl}
                                  alt={item.name}
                                  w={40}
                                  h={40}
                                  radius="md"
                                  fallbackSrc="https://placehold.co/80x80/png?text=Dish"
                                />
                              ) : (
                                <Box
                                  style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "8px",
                                    backgroundColor: isBar ? "var(--mantine-color-grape-0)" : "var(--color-surface-hover)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: isBar ? "var(--mantine-color-grape-6)" : "var(--color-text-muted)",
                                  }}
                                >
                                  {isBar ? <IconGlassFull size={20} /> : <IconToolsKitchen2 size={20} />}
                                </Box>
                              )}
                              <Box>
                                <Text size="sm" fw={600} style={{ color: "var(--color-text)" }}>
                                  {item.name}
                                </Text>
                                {item.description && (
                                  <Text size="xs" style={{ color: "var(--color-text-muted)", maxWidth: 260 }} truncate>
                                    {item.description}
                                  </Text>
                                )}
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="blue" size="sm">
                              {categoryName}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {isBar ? (
                              <Badge color="grape" variant="light" size="sm" leftSection={<IconGlassFull size={12} />}>
                                BAR
                              </Badge>
                            ) : (
                              <Badge color="teal" variant="light" size="sm" leftSection={<IconToolsKitchen2 size={12} />}>
                                KITCHEN
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              ${Number(item.price).toFixed(2)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <StatusBadge status={item.isActive !== false ? "ACTIVE" : "INACTIVE"} />
                          </Table.Td>
                          <Table.Td>
                            <Button
                              variant="light"
                              size="xs"
                              color="orange"
                              leftSection={<IconPaperclip size={14} />}
                              onClick={() => handleOpenAssignAddons(item)}
                            >
                              Addons
                            </Button>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Group gap={4} justify="flex-end">
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={() => handleOpenEditItem(item)}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            )}
          </Card>
        </Tabs.Panel>

        {/* Categories Tab */}
        <Tabs.Panel value="categories">
          <Card
            padding="lg"
            radius="md"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            {categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Organize your menu into sections like Main Courses, Appetizers, Cocktails."
                action={
                  <Button
                    size="xs"
                    onClick={handleOpenAddCategory}
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Create First Category
                  </Button>
                }
              />
            ) : (
              <Box style={{ overflowX: "auto" }}>
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Category Name</Table.Th>
                      <Table.Th>Total Items</Table.Th>
                      <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {categories.map((category) => {
                      const count = items.filter((i) => i.categoryId === category.id).length;
                      return (
                        <Table.Tr key={category.id}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {category.name}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="gray">
                              {count} item(s)
                            </Badge>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Group gap={4} justify="flex-end">
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={() => handleOpenEditCategory(category)}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleDeleteCategory(category.id)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            )}
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Category Modal */}
      <Modal
        opened={categoryModalOpened}
        onClose={closeCategoryModal}
        title={<Text fw={700}>{editingCategory ? "Edit Category" : "Add Menu Category"}</Text>}
      >
        <form onSubmit={handleSubmitCat(onSubmitCategory)} noValidate>
          <Stack gap="md">
            <TextInput
              label="Category Name"
              placeholder="e.g. Gourmet Burgers, Cocktails, Beers"
              required
              error={catErrors.name?.message}
              {...registerCat("name", { required: "Category name is required" })}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCategoryModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmittingCat}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {editingCategory ? "Save Changes" : "Create"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Menu Item Modal */}
      <Modal
        opened={itemModalOpened}
        onClose={closeItemModal}
        title={<Text fw={700}>{editingItem ? "Edit Menu Item" : "New Menu Item"}</Text>}
        size="lg"
      >
        <form onSubmit={handleSubmitItem(onSubmitItem)} noValidate>
          <Stack gap="md">
            {/* Menu Department / Type Selector */}
            <Controller
              name="menuType"
              control={controlItem}
              render={({ field }) => (
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    Menu Department <span style={{ color: "var(--mantine-color-red-6)" }}>*</span>
                  </Text>
                  <SegmentedControl
                    fullWidth
                    color={field.value === "BAR" ? "grape" : "teal"}
                    value={field.value || "KITCHEN"}
                    onChange={(val) => field.onChange((val as "BAR" | "KITCHEN") || "KITCHEN")}
                    data={[
                      {
                        value: "KITCHEN",
                        label: (
                          <Center style={{ gap: 8 }}>
                            <IconToolsKitchen2 size={16} />
                            <span>Kitchen Menu (Food)</span>
                          </Center>
                        ),
                      },
                      {
                        value: "BAR",
                        label: (
                          <Center style={{ gap: 8 }}>
                            <IconGlassFull size={16} />
                            <span>Bar Menu (Drinks)</span>
                          </Center>
                        ),
                      },
                    ]}
                  />
                </Box>
              )}
            />

            {!editingItem && (
              <Controller
                name="categoryId"
                control={controlItem}
                rules={{ required: "Category is required" }}
                render={({ field }) => (
                  <Select
                    label="Category"
                    placeholder="Select category"
                    required
                    data={categories.map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value}
                    onChange={field.onChange}
                    error={itemErrors.categoryId?.message}
                  />
                )}
              />
            )}

            <TextInput
              label="Item Name"
              placeholder="e.g. Classic Cheeseburger, Mojito, IPA Beer"
              required
              error={itemErrors.name?.message}
              {...registerItem("name", { required: "Item name is required" })}
            />

            <Textarea
              label="Description"
              placeholder="Detailed description, ingredients, notes..."
              rows={3}
              {...registerItem("description")}
            />

            <SimpleGrid cols={2}>
              <Controller
                name="price"
                control={controlItem}
                rules={{
                  required: "Price is required",
                  min: { value: 0.01, message: "Price must be greater than 0" },
                }}
                render={({ field }) => (
                  <NumberInput
                    label="Price ($)"
                    placeholder="12.99"
                    prefix="$"
                    decimalScale={2}
                    min={0}
                    value={field.value}
                    onChange={(val) => field.onChange(Number(val))}
                    error={itemErrors.price?.message}
                    required
                  />
                )}
              />

              <TextInput
                label="Image URL"
                placeholder="https://example.com/photo.png"
                {...registerItem("imageUrl")}
              />
            </SimpleGrid>

            {editingItem && (
              <Controller
                name="isActive"
                control={controlItem}
                render={({ field }) => (
                  <Switch
                    label="Active & Available on Menu"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                  />
                )}
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeItemModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmittingItem}
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {editingItem ? "Save Changes" : "Add Item"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Assign Addons Modal */}
      <Modal
        opened={addonModalOpened}
        onClose={closeAddonModal}
        title={
          <Text fw={700}>
            Attach Add-ons to {assigningItem?.name}
          </Text>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Select add-ons that customers can add when ordering this dish.
          </Text>

          {addons.length === 0 ? (
            <Alert color="yellow" title="No Addons available">
              Create add-ons in the Add-ons section first.
            </Alert>
          ) : (
            <MultiSelect
              label="Select Add-ons"
              placeholder="Pick add-ons"
              data={addons.map((a) => ({
                value: a.id,
                label: `${a.name} (+$${Number(a.price).toFixed(2)})`,
              }))}
              value={selectedAddonIds}
              onChange={setSelectedAddonIds}
              searchable
              clearable
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeAddonModal}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssignedAddons}
              loading={savingAddons}
              disabled={addons.length === 0}
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Save Add-ons
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
