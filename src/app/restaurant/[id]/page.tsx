"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Container,
  Card,
  Group,
  Text,
  Title,
  Badge,
  SimpleGrid,
  Stack,
  Box,
  Button,
  TextInput,
  Textarea,
  Checkbox,
  ActionIcon,
  Drawer,
  Modal,
  Select,
  Divider,
  Flex,
  Paper,
  Skeleton,
  Alert,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconSearch,
  IconToolsKitchen2,
  IconMapPin,
  IconShoppingCart,
  IconPlus,
  IconMinus,
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconX,
  IconArmchair,
  IconCreditCard,
  IconBrandStripe,
} from "@tabler/icons-react";
import { APIGetCategoriesByRestaurant, APIGetMenuItemsByRestaurant } from "@/api/menu";
import { APIGetTablesByRestaurant } from "@/api/tables";
import { APICreateOrder } from "@/api/orders";
import { APICreateCheckoutSession } from "@/api/payment";
import { MenuItem, MenuCategory, Table as TableType, Restaurant, Addon } from "@/types";

export interface CartAddonSelection {
  addonId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  quantity: number;
  addons: CartAddonSelection[];
}

export default function RestaurantMenuPage() {
  const params = useParams();
  const restaurantId = params.id as string;

  // Data states
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<TableType[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cart & Order states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<{
    tableName: string;
    totalAmount: number;
  } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>("");

  // Addon customization modal states
  const [selectedMenuItemForAddons, setSelectedMenuItemForAddons] = useState<MenuItem | null>(null);
  const [addonSelections, setAddonSelections] = useState<Record<string, { quantity: number; selected: boolean }>>({});
  const [addonModalOpened, { open: openAddonModal, close: closeAddonModal }] = useDisclosure(false);

  // Drawers & Modals
  const [cartOpened, { open: openCart, close: closeCart }] = useDisclosure(false);
  const [tableModalOpened, { open: openTableModal, close: closeTableModal }] = useDisclosure(false);

  // Restore cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && restaurantId) {
      try {
        const savedCart = localStorage.getItem(`dining_cart_${restaurantId}`);
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCart(parsed);
          }
        }
      } catch (e) {
        console.warn("Failed to load saved cart", e);
      }
    }
  }, [restaurantId]);

  // Sync cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined" && restaurantId) {
      try {
        if (cart.length > 0) {
          localStorage.setItem(`dining_cart_${restaurantId}`, JSON.stringify(cart));
        } else {
          localStorage.removeItem(`dining_cart_${restaurantId}`);
        }
      } catch (e) {
        console.warn("Failed to sync cart to storage", e);
      }
    }
  }, [cart, restaurantId]);

  // Load menu & table data
  useEffect(() => {
    if (!restaurantId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    Promise.allSettled([
      APIGetTablesByRestaurant(restaurantId),
      APIGetCategoriesByRestaurant(restaurantId),
      APIGetMenuItemsByRestaurant(restaurantId),
    ])
      .then(([tablesRes, catsRes, itemsRes]) => {
        if (!isMounted) return;

        let loadedCategories: MenuCategory[] = [];
        let loadedItems: MenuItem[] = [];
        let loadedTables: TableType[] = [];

        // 1. Process Tables first
        if (tablesRes.status === "fulfilled" && (tablesRes.value as any)?.data) {
          loadedTables = Array.isArray((tablesRes.value as any).data)
            ? (tablesRes.value as any).data
            : [];
          setTables(loadedTables);

          // Check if table is stored in localStorage
          const stored = typeof window !== "undefined"
            ? localStorage.getItem(`dining_table_${restaurantId}`)
            : null;

          if (stored && loadedTables.some((t) => t.id === stored)) {
            setSelectedTableId(stored);
          } else if (loadedTables.length > 0) {
            // Prompt customer to select their table on arrival
            openTableModal();
          }
        }

        // 2. Process Categories
        if (catsRes.status === "fulfilled" && (catsRes.value as any)?.data) {
          loadedCategories = Array.isArray((catsRes.value as any).data)
            ? (catsRes.value as any).data
            : [];
          setCategories(loadedCategories);

          // Extract restaurant info if available in category response
          if (loadedCategories.length > 0 && (loadedCategories[0] as any).restaurant) {
            setRestaurant((loadedCategories[0] as any).restaurant);
          }
        }

        // 3. Process Menu Items
        if (itemsRes.status === "fulfilled" && (itemsRes.value as any)?.data) {
          loadedItems = Array.isArray((itemsRes.value as any).data)
            ? (itemsRes.value as any).data
            : [];
          setMenuItems(loadedItems);

          // Extract restaurant info if not already set
          if (loadedItems.length > 0 && (loadedItems[0] as any).restaurant) {
            setRestaurant((loadedItems[0] as any).restaurant);
          }
        } else if (itemsRes.status === "rejected") {
          const reason = itemsRes.reason;
          setError(
            typeof reason === "string"
              ? reason
              : reason?.message || "Failed to connect to backend server at " + (process.env.NEXT_PUBLIC_API_BASE_URL || "")
          );
        }

        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load restaurant menu:", err);
        setError("Unable to load menu. Please refresh or try again.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [restaurantId]);

  // Filter items by category and search term
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategoryId === "ALL" || item.categoryId === selectedCategoryId;

      const matchesSearch =
        searchQuery.trim() === "" ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategoryId, searchQuery]);

  // Cart operations
  const handleOpenAddonModal = (item: MenuItem) => {
    setSelectedMenuItemForAddons(item);
    const initialSelections: Record<string, { quantity: number; selected: boolean }> = {};
    (item.addons || []).forEach((ad) => {
      initialSelections[ad.id] = { quantity: 1, selected: false };
    });
    setAddonSelections(initialSelections);
    openAddonModal();
  };

  const addToCart = (item: MenuItem, chosenAddons: CartAddonSelection[] = []) => {
    const addonKey = chosenAddons
      .map((a) => `${a.addonId}:${a.quantity}`)
      .sort()
      .join("|");
    const cartItemId = `${item.id}_${addonKey}`;

    setCart((prev) => {
      const existing = prev.find((ci) => ci.cartItemId === cartItemId);
      if (existing) {
        return prev.map((ci) =>
          ci.cartItemId === cartItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          cartItemId,
          menuItem: item,
          quantity: 1,
          addons: chosenAddons,
        },
      ];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.cartItemId === cartItemId);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        return prev.filter((ci) => ci.cartItemId !== cartItemId);
      }
      return prev.map((ci) =>
        ci.cartItemId === cartItemId ? { ...ci, quantity: ci.quantity - 1 } : ci
      );
    });
  };

  const incrementCartItem = (cartItemId: string) => {
    setCart((prev) =>
      prev.map((ci) =>
        ci.cartItemId === cartItemId ? { ...ci, quantity: ci.quantity + 1 } : ci
      )
    );
  };

  const deleteFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.cartItemId !== cartItemId));
  };

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartTotalPrice = useMemo(() => {
    return cart.reduce((sum, item) => {
      const itemBase = Number(item.menuItem.price || 0);
      const addonsBase = (item.addons || []).reduce(
        (aSum, a) => aSum + Number(a.price || 0) * (a.quantity || 1),
        0
      );
      return sum + (itemBase + addonsBase) * item.quantity;
    }, 0);
  }, [cart]);

  const selectedTable = useMemo(() => {
    return tables.find((t) => t.id === selectedTableId) || null;
  }, [tables, selectedTableId]);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;

    if (!selectedTableId) {
      openTableModal();
      setOrderError("Please select your table first before placing an order.");
      return;
    }

    setIsPlacingOrder(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const payload: any = {
        restaurantId,
        tableId: selectedTableId,
        notes: orderNotes.trim() || undefined,
        items: cart.map((ci) => {
          const itemPayload: any = {
            menuItemId: ci.menuItem.id,
            quantity: ci.quantity,
          };
          if (ci.addons && ci.addons.length > 0) {
            itemPayload.addons = ci.addons.map((ad) => ({
              addonId: ad.addonId,
              quantity: ad.quantity,
            }));
          } else {
            itemPayload.addons = [];
          }
          return itemPayload;
        }),
      };

      // Create Stripe Checkout Session on the backend
      const res: any = await APICreateCheckoutSession(payload);
      const checkoutData = res?.data || res;
      const checkoutUrl = checkoutData?.checkoutUrl;

      if (checkoutUrl) {
        // Save restaurant ID & table ID so cancel or back navigation returns seamlessly
        if (typeof window !== "undefined") {
          localStorage.setItem("last_checkout_restaurant_id", restaurantId);
          localStorage.setItem(`dining_table_${restaurantId}`, selectedTableId);
        }
        // Redirect customer directly to Stripe hosted checkout
        window.location.href = checkoutUrl;
        return;
      }

      throw new Error(res?.error || res?.message || "Failed to initialize payment session with Stripe.");
    } catch (err: any) {
      console.error("Failed to initiate Stripe checkout:", err);
      setOrderError(
        typeof err === "string" ? err : err?.message || err?.error || "Failed to connect to payment gateway. Please try again."
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <Box style={{ backgroundColor: "#fafaf9", minHeight: "100vh", paddingBottom: 100 }}>
      {/* Restaurant Banner Header */}
      <Box
        style={{
          background: "linear-gradient(135deg, #1a1b23 0%, #2b2c34 100%)",
          color: "#ffffff",
          paddingTop: 36,
          paddingBottom: 36,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Container size="lg">
          <Flex
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align={{ base: "flex-start", sm: "center" }}
            gap="md"
          >
            <Box>
              <Group gap="xs" mb={4}>
                <Badge
                  color="orange"
                  variant="filled"
                  style={{ backgroundColor: "var(--color-primary)", textTransform: "none" }}
                  size="sm"
                >
                  Live Digital Menu
                </Badge>
                <Badge color="green" variant="dot" size="sm">
                  Accepting Orders
                </Badge>
              </Group>

              <Title order={2} style={{ fontWeight: 800, letterSpacing: "-0.5px" }}>
                {restaurant?.name || "Restaurant Menu"}
              </Title>

              {restaurant?.address && (
                <Group gap={6} mt={6} style={{ color: "#a1a1aa" }}>
                  <IconMapPin size={16} />
                  <Text size="sm">{restaurant.address}</Text>
                </Group>
              )}

              {/* Table Selector / Indicator */}
              <Group gap="xs" mt={10}>
                {selectedTable ? (
                  <Badge
                    size="md"
                    color="orange"
                    variant="filled"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      cursor: "pointer",
                      paddingLeft: 12,
                      paddingRight: 12,
                      height: 28,
                    }}
                    leftSection={<IconArmchair size={15} />}
                    onClick={openTableModal}
                  >
                    Dining at: {selectedTable.number} • Tap to Change
                  </Badge>
                ) : (
                  <Button
                    size="xs"
                    color="orange"
                    variant="filled"
                    style={{ backgroundColor: "var(--color-primary)" }}
                    leftSection={<IconArmchair size={15} />}
                    onClick={openTableModal}
                  >
                    Select Your Table Number
                  </Button>
                )}
              </Group>
            </Box>

            {/* Quick Cart Button on Header (Desktop) */}
            {cartTotalItems > 0 && (
              <Button
                leftSection={<IconShoppingCart size={18} />}
                color="orange"
                style={{ backgroundColor: "var(--color-primary)" }}
                onClick={openCart}
                size="md"
                radius="md"
              >
                View Cart ({cartTotalItems}) • ${cartTotalPrice.toFixed(2)}
              </Button>
            )}
          </Flex>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Container size="lg" mt="xl">
        {error && (
          <Alert icon={<IconAlertCircle size={18} />} color="red" mb="lg">
            {error}
          </Alert>
        )}

        {/* Search & Category Filter Controls */}
        <Paper
          p="md"
          radius="md"
          withBorder
          mb="xl"
          style={{
            backgroundColor: "#ffffff",
            borderColor: "var(--color-border)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          }}
        >
          <Stack gap="md">
            {/* Search input */}
            <TextInput
              placeholder="Search dishes, drinks, ingredients..."
              leftSection={<IconSearch size={18} style={{ color: "var(--color-text-muted)" }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              rightSection={
                searchQuery ? (
                  <ActionIcon variant="subtle" color="gray" onClick={() => setSearchQuery("")}>
                    <IconX size={16} />
                  </ActionIcon>
                ) : null
              }
              styles={{
                input: {
                  backgroundColor: "var(--color-surface-hover)",
                  borderColor: "var(--color-border)",
                  fontSize: 14,
                },
              }}
            />

            {/* Category Filter Pills */}
            <Box>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8} style={{ letterSpacing: "0.5px" }}>
                Categories
              </Text>
              <Flex gap="xs" wrap="wrap">
                <Button
                  size="sm"
                  radius="xl"
                  variant={selectedCategoryId === "ALL" ? "filled" : "light"}
                  color="orange"
                  style={
                    selectedCategoryId === "ALL"
                      ? { backgroundColor: "var(--color-primary)" }
                      : { color: "var(--color-text)" }
                  }
                  onClick={() => setSelectedCategoryId("ALL")}
                >
                  All Items ({menuItems.length})
                </Button>

                {categories.map((cat) => {
                  const count = menuItems.filter((i) => i.categoryId === cat.id).length;
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <Button
                      key={cat.id}
                      size="sm"
                      radius="xl"
                      variant={isSelected ? "filled" : "light"}
                      color="orange"
                      style={
                        isSelected
                          ? { backgroundColor: "var(--color-primary)" }
                          : { color: "var(--color-text)" }
                      }
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      {cat.name} ({count})
                    </Button>
                  );
                })}
              </Flex>
            </Box>
          </Stack>
        </Paper>

        {/* Loading Skeletons */}
        {isLoading && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <Card key={idx} padding="md" radius="md" withBorder>
                <Skeleton height={140} radius="md" mb="md" />
                <Skeleton height={20} width="70%" mb="xs" />
                <Skeleton height={14} width="90%" mb="sm" />
                <Skeleton height={26} width="40%" />
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Menu Items Grid */}
        {!isLoading && filteredItems.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {filteredItems.map((item) => {
              const itemCartEntries = cart.filter((ci) => ci.menuItem.id === item.id);
              const totalInCart = itemCartEntries.reduce((s, ci) => s + ci.quantity, 0);
              const hasAddons = item.addons && item.addons.length > 0;

              return (
                <Card
                  key={item.id}
                  padding="lg"
                  radius="md"
                  withBorder
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backgroundColor: "#ffffff",
                    borderColor: "var(--color-border)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <Box>
                    {/* Item Visual Placeholder / Image */}
                    <Box
                      style={{
                        height: 130,
                        borderRadius: 8,
                        backgroundColor: "var(--color-primary-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 14,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {item.imageUrl &&
                      item.imageUrl.startsWith("http") &&
                      !item.imageUrl.includes("example.com") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <IconToolsKitchen2 size={44} style={{ color: "var(--color-primary)", opacity: 0.8 }} />
                      )}

                      {item.category && (
                        <Badge
                          size="xs"
                          variant="filled"
                          color="dark"
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            backgroundColor: "rgba(0,0,0,0.65)",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          {item.category.name}
                        </Badge>
                      )}
                    </Box>

                    {/* Title & Price */}
                    <Group justify="space-between" align="flex-start" mb={4}>
                      <Title order={5} style={{ color: "var(--color-text)", fontWeight: 700 }}>
                        {item.name}
                      </Title>
                      <Text fw={700} size="md" style={{ color: "var(--color-primary)" }}>
                        ${Number(item.price || 0).toFixed(2)}
                      </Text>
                    </Group>

                    {/* Description */}
                    <Text size="xs" c="dimmed" lineClamp={2} mb="sm">
                      {item.description || "Freshly prepared with quality ingredients."}
                    </Text>

                    {/* Addons preview if available */}
                    {hasAddons && (
                      <Box mb="md">
                        <Text size="10px" fw={600} c="dimmed" tt="uppercase" mb={4}>
                          Available Add-ons:
                        </Text>
                        <Flex gap={4} wrap="wrap">
                          {item.addons!.map((addon) => (
                            <Badge key={addon.id} variant="outline" color="gray" size="xs">
                              +{addon.name} (${Number(addon.price).toFixed(2)})
                            </Badge>
                          ))}
                        </Flex>
                      </Box>
                    )}
                  </Box>

                  {/* Add / Quantity Controls */}
                  <Box mt="md">
                    <Divider mb="sm" style={{ borderColor: "var(--color-border)" }} />
                    {hasAddons ? (
                      <Button
                        fullWidth
                        variant="light"
                        color="orange"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => handleOpenAddonModal(item)}
                        size="sm"
                        radius="md"
                      >
                        {totalInCart > 0 ? `Add More (${totalInCart} in cart)` : "Customize & Add"}
                      </Button>
                    ) : totalInCart > 0 ? (
                      <Group justify="space-between">
                        <Group gap={6}>
                          <ActionIcon
                            variant="light"
                            color="orange"
                            size="md"
                            radius="md"
                            onClick={() => removeFromCart(`${item.id}_`)}
                          >
                            <IconMinus size={16} />
                          </ActionIcon>
                          <Text fw={700} size="sm" style={{ minWidth: 24, textAlign: "center" }}>
                            {totalInCart}
                          </Text>
                          <ActionIcon
                            variant="filled"
                            color="orange"
                            style={{ backgroundColor: "var(--color-primary)" }}
                            size="md"
                            radius="md"
                            onClick={() => addToCart(item, [])}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        </Group>

                        <Text size="xs" fw={600} style={{ color: "var(--color-text-secondary)" }}>
                          ${(totalInCart * (item.price || 0)).toFixed(2)}
                        </Text>
                      </Group>
                    ) : (
                      <Button
                        fullWidth
                        variant="light"
                        color="orange"
                        leftSection={<IconPlus size={16} />}
                        onClick={() => addToCart(item, [])}
                        size="sm"
                        radius="md"
                      >
                        Add to Order
                      </Button>
                    )}
                  </Box>
                </Card>
              );
            })}
          </SimpleGrid>
        )}

        {/* Empty state */}
        {!isLoading && filteredItems.length === 0 && (
          <Paper
            p="xl"
            radius="md"
            withBorder
            style={{
              textAlign: "center",
              backgroundColor: "#ffffff",
              borderColor: "var(--color-border)",
            }}
          >
            <Box
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "var(--color-primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                color: "var(--color-primary)",
              }}
            >
              <IconToolsKitchen2 size={32} />
            </Box>
            <Title order={4} mb="xs" style={{ color: "var(--color-text)" }}>
              No dishes found
            </Title>
            <Text size="sm" c="dimmed" mb="lg">
              {searchQuery
                ? `No menu items match "${searchQuery}" in this category.`
                : "No items available in this category yet."}
            </Text>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategoryId("ALL");
              }}
            >
              Clear Filters
            </Button>
          </Paper>
        )}
      </Container>

      {/* Floating Cart Bar (Bottom on Mobile & Desktop) - hidden when drawer is open so it NEVER blocks place order button */}
      {cartTotalItems > 0 && !cartOpened && (
        <Box
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 540,
            zIndex: 999,
          }}
        >
          <Paper
            p="sm"
            radius="xl"
            style={{
              backgroundColor: "#1a1b23",
              color: "#ffffff",
              boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Group justify="space-between" align="center" px="sm">
              <Group gap="xs">
                <Box
                  style={{
                    backgroundColor: "var(--color-primary)",
                    borderRadius: "50%",
                    width: 34,
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {cartTotalItems}
                </Box>
                <Box>
                  <Text size="sm" fw={700}>
                    ${cartTotalPrice.toFixed(2)}
                  </Text>
                  <Text size="10px" c="dimmed">
                    {cartTotalItems} {cartTotalItems === 1 ? "item" : "items"} in cart
                  </Text>
                </Box>
              </Group>

              <Button
                color="indigo"
                style={{
                  backgroundColor: "#635BFF",
                  boxShadow: "0 2px 10px rgba(99, 91, 255, 0.35)",
                }}
                radius="xl"
                size="sm"
                leftSection={<IconCreditCard size={16} />}
                onClick={openCart}
              >
                Review & Pay with Stripe →
              </Button>
            </Group>
          </Paper>
        </Box>
      )}

      {/* Cart & Checkout Drawer */}
      <Drawer
        opened={cartOpened}
        onClose={closeCart}
        position="right"
        title={
          <Group gap="xs">
            <IconShoppingCart size={20} style={{ color: "var(--color-primary)" }} />
            <Text fw={700} size="md">
              Your Dining Order
            </Text>
          </Group>
        }
        styles={{
          header: { borderBottom: "1px solid var(--color-border)" },
        }}
      >
        <Stack justify="space-between" style={{ minHeight: "calc(100vh - 100px)" }}>
          <Box>
            {/* Table Selector */}
            {tables.length > 0 && (
              <Box mb="md">
                <Select
                  label="Select Your Table"
                  placeholder="Choose your table"
                  data={tables.map((t) => ({ value: t.id, label: t.number }))}
                  value={selectedTableId}
                  onChange={setSelectedTableId}
                  size="sm"
                />
              </Box>
            )}

            {/* Order Feedback */}
            {orderSuccess && (
              <Paper
                p="md"
                radius="md"
                withBorder
                mb="md"
                style={{
                  backgroundColor: "#f0fdf4",
                  borderColor: "#86efac",
                }}
              >
                <Group justify="space-between" align="center" mb="xs">
                  <Group gap="xs">
                    <IconCheck size={20} color="#16a34a" />
                    <Text fw={700} size="sm" c="green.8">
                      Order Placed Successfully!
                    </Text>
                  </Group>
                  <Badge color="green" variant="light">
                    #{orderSuccess.slice(0, 8).toUpperCase()}
                  </Badge>
                </Group>

                <Text size="xs" c="dimmed" mb="xs">
                  Table: <b>{lastPlacedOrder?.tableName || selectedTable?.number || "N/A"}</b> •{" "}
                  Total: <b>${(lastPlacedOrder?.totalAmount ?? 0).toFixed(2)}</b>
                </Text>

                <Text size="xs" c="gray.7">
                  Your order has been sent directly to the kitchen! The kitchen team is preparing your food.
                </Text>
              </Paper>
            )}

            {orderError && (
              <Alert icon={<IconAlertCircle size={18} />} color="red" mb="md">
                {orderError}
              </Alert>
            )}

            {/* Items List */}
            {cart.length === 0 && !orderSuccess && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Your cart is empty. Tap any dish to add!
              </Text>
            )}

            {cart.length === 0 && orderSuccess && (
              <Box py="md" ta="center">
                <Text size="xs" c="dimmed" mb="sm">
                  Ready to add more items to your table?
                </Text>
                <Button
                  variant="light"
                  color="orange"
                  size="xs"
                  onClick={() => {
                    closeCart();
                  }}
                >
                  Browse Menu
                </Button>
              </Box>
            )}

            {cart.length > 0 && (
              <Stack gap="sm">
                {cart.map((ci) => {
                  const itemUnitPrice =
                    Number(ci.menuItem.price || 0) +
                    (ci.addons || []).reduce(
                      (s, a) => s + Number(a.price || 0) * (a.quantity || 1),
                      0
                    );
                  const lineTotal = itemUnitPrice * ci.quantity;

                  return (
                    <Paper
                      key={ci.cartItemId}
                      p="sm"
                      radius="sm"
                      withBorder
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <Group justify="space-between" align="flex-start">
                        <Box style={{ flex: 1 }}>
                          <Text size="sm" fw={600}>
                            {ci.menuItem.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            ${itemUnitPrice.toFixed(2)} each
                          </Text>
                          {ci.addons && ci.addons.length > 0 && (
                            <Stack gap={2} mt={4}>
                              {ci.addons.map((ad, idx) => (
                                <Text key={idx} size="11px" c="teal.7" fw={500}>
                                  + {ad.quantity > 1 ? `${ad.quantity}x ` : ""}{ad.name} (+${(ad.price * ad.quantity).toFixed(2)})
                                </Text>
                              ))}
                            </Stack>
                          )}
                        </Box>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => deleteFromCart(ci.cartItemId)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>

                      <Group justify="space-between" align="center" mt="xs">
                        <Group gap={6}>
                          <ActionIcon
                            size="xs"
                            variant="light"
                            color="gray"
                            onClick={() => removeFromCart(ci.cartItemId)}
                          >
                            <IconMinus size={12} />
                          </ActionIcon>
                          <Text size="xs" fw={700}>
                            {ci.quantity}
                          </Text>
                          <ActionIcon
                            size="xs"
                            variant="light"
                            color="gray"
                            onClick={() => incrementCartItem(ci.cartItemId)}
                          >
                            <IconPlus size={12} />
                          </ActionIcon>
                        </Group>

                        <Text size="sm" fw={700} style={{ color: "var(--color-primary)" }}>
                          ${lineTotal.toFixed(2)}
                        </Text>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <Box pt="md" style={{ borderTop: "1px solid var(--color-border)" }}>
              <Textarea
                label="Special Instructions / Notes"
                placeholder="e.g. Please serve starters first, bring extra napkins"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.currentTarget.value)}
                minRows={2}
                maxRows={3}
                mb="md"
              />

              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  Items Subtotal
                </Text>
                <Text size="sm" fw={600}>
                  ${cartTotalPrice.toFixed(2)}
                </Text>
              </Group>

              <Group justify="space-between" mb="md">
                <Text size="md" fw={700}>
                  Total Amount
                </Text>
                <Title order={3} style={{ color: "var(--color-primary)" }}>
                  ${cartTotalPrice.toFixed(2)}
                </Title>
              </Group>

              <Button
                fullWidth
                size="lg"
                color="indigo"
                style={{
                  backgroundColor: "#635BFF",
                  boxShadow: "0 4px 16px rgba(99, 91, 255, 0.4)",
                  height: 52,
                }}
                leftSection={<IconCreditCard size={20} />}
                loading={isPlacingOrder}
                loaderProps={{ type: "dots" }}
                onClick={handlePlaceOrder}
              >
                {isPlacingOrder ? "Connecting to Stripe..." : `Pay with Stripe • $${cartTotalPrice.toFixed(2)}`}
              </Button>

              <Group justify="center" gap={6} mt="xs">
                <IconBrandStripe size={18} color="#635BFF" />
                <Text size="11px" c="dimmed">
                  Guaranteed safe & secure checkout powered by Stripe (AUD)
                </Text>
              </Group>
            </Box>
          )}
        </Stack>
      </Drawer>

      {/* Table Selection Modal on Arrival or Change */}
      <Modal
        opened={tableModalOpened}
        onClose={closeTableModal}
        title={
          <Group gap="xs">
            <IconArmchair size={22} style={{ color: "var(--color-primary)" }} />
            <Text fw={700} size="lg">
              Select Your Table
            </Text>
          </Group>
        }
        centered
        radius="md"
      >
        <Text size="sm" c="dimmed" mb="lg">
          Please choose your table number so the kitchen knows where to serve your order:
        </Text>

        {tables.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No tables registered for this restaurant yet.
          </Text>
        ) : (
          <SimpleGrid cols={2} spacing="md">
            {tables.map((table) => {
              const isSelected = selectedTableId === table.id;
              return (
                <Button
                  key={table.id}
                  variant={isSelected ? "filled" : "outline"}
                  color="orange"
                  style={isSelected ? { backgroundColor: "var(--color-primary)" } : {}}
                  size="md"
                  leftSection={<IconArmchair size={18} />}
                  onClick={() => {
                    setSelectedTableId(table.id);
                    if (typeof window !== "undefined") {
                      localStorage.setItem(`dining_table_${restaurantId}`, table.id);
                    }
                    closeTableModal();
                  }}
                >
                  {table.number}
                </Button>
              );
            })}
          </SimpleGrid>
        )}
      </Modal>

      {/* Addon Customization Modal */}
      <Modal
        opened={addonModalOpened}
        onClose={closeAddonModal}
        title={
          <Group gap="xs">
            <IconToolsKitchen2 size={20} color="var(--color-primary)" />
            <Text fw={700} size="md">
              Customize {selectedMenuItemForAddons?.name}
            </Text>
          </Group>
        }
        centered
        radius="md"
      >
        {selectedMenuItemForAddons && (
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Box>
                <Text size="xs" c="dimmed">
                  BASE ITEM
                </Text>
                <Text fw={700} size="md">
                  {selectedMenuItemForAddons.name}
                </Text>
              </Box>
              <Text fw={700} size="lg" style={{ color: "var(--color-primary)" }}>
                ${Number(selectedMenuItemForAddons.price || 0).toFixed(2)}
              </Text>
            </Group>

            {selectedMenuItemForAddons.description && (
              <Text size="xs" c="dimmed">
                {selectedMenuItemForAddons.description}
              </Text>
            )}

            <Divider />

            <Text size="sm" fw={600}>
              Select Add-ons:
            </Text>

            <Stack gap="xs">
              {(selectedMenuItemForAddons.addons || []).map((addon) => {
                const current = addonSelections[addon.id] || { quantity: 1, selected: false };
                return (
                  <Paper
                    key={addon.id}
                    p="sm"
                    radius="sm"
                    withBorder
                    style={{
                      borderColor: current.selected ? "var(--color-primary)" : "var(--color-border)",
                      backgroundColor: current.selected ? "#fff7ed" : "#ffffff",
                    }}
                  >
                    <Group justify="space-between" align="center">
                      <Checkbox
                        label={
                          <Box>
                            <Text size="sm" fw={500}>
                              {addon.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              +${Number(addon.price).toFixed(2)} each
                            </Text>
                          </Box>
                        }
                        checked={current.selected}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setAddonSelections((prev) => ({
                            ...prev,
                            [addon.id]: { ...prev[addon.id], selected: checked },
                          }));
                        }}
                      />

                      {current.selected && (
                        <Group gap={6}>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="gray"
                            onClick={() => {
                              setAddonSelections((prev) => ({
                                ...prev,
                                [addon.id]: {
                                  ...prev[addon.id],
                                  quantity: Math.max(1, (prev[addon.id]?.quantity || 1) - 1),
                                },
                              }));
                            }}
                          >
                            <IconMinus size={12} />
                          </ActionIcon>
                          <Text size="xs" fw={700} style={{ minWidth: 16, textAlign: "center" }}>
                            {current.quantity}
                          </Text>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="gray"
                            onClick={() => {
                              setAddonSelections((prev) => ({
                                ...prev,
                                [addon.id]: {
                                  ...prev[addon.id],
                                  quantity: (prev[addon.id]?.quantity || 1) + 1,
                                },
                              }));
                            }}
                          >
                            <IconPlus size={12} />
                          </ActionIcon>
                        </Group>
                      )}
                    </Group>
                  </Paper>
                );
              })}
            </Stack>

            <Divider />

            {/* Calculated item + addons subtotal */}
            {(() => {
              const base = Number(selectedMenuItemForAddons.price || 0);
              const addonsSum = (selectedMenuItemForAddons.addons || []).reduce((acc, ad) => {
                const sel = addonSelections[ad.id];
                if (sel?.selected) {
                  return acc + Number(ad.price || 0) * (sel.quantity || 1);
                }
                return acc;
              }, 0);
              const total = base + addonsSum;

              return (
                <Button
                  fullWidth
                  size="md"
                  color="orange"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  onClick={() => {
                    const chosen: CartAddonSelection[] = [];
                    (selectedMenuItemForAddons.addons || []).forEach((ad) => {
                      const sel = addonSelections[ad.id];
                      if (sel?.selected) {
                        chosen.push({
                          addonId: ad.id,
                          name: ad.name,
                          price: Number(ad.price || 0),
                          quantity: sel.quantity || 1,
                        });
                      }
                    });
                    addToCart(selectedMenuItemForAddons, chosen);
                    closeAddonModal();
                  }}
                >
                  Add to Order • ${total.toFixed(2)}
                </Button>
              );
            })()}
          </Stack>
        )}
      </Modal>
    </Box>
  );
}

