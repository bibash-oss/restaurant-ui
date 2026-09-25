"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Container,
  Paper,
  Title,
  Text,
  Badge,
  Group,
  Stack,
  Divider,
  Button,
  Table,
  Box,
  Alert,
  ThemeIcon,
  CopyButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconClock,
  IconArmchair,
  IconCopy,
  IconCheck as IconCheckSmall,
  IconToolsKitchen2,
  IconArrowLeft,
  IconAlertCircle,
  IconReceipt,
  IconCreditCard,
  IconBrandStripe,
} from "@tabler/icons-react";
import { APIGetPaymentSession, PaymentSessionResponse } from "@/api/payment";
import { Loading } from "@/components/common/Loading";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<PaymentSessionResponse | null>(null);
  const [pollCount, setPollCount] = useState<number>(0);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError("No payment session ID found in URL.");
      setLoading(false);
      return;
    }

    try {
      const res: any = await APIGetPaymentSession(sessionId);
      const data: PaymentSessionResponse = res?.data || res;

      if (data) {
        setSessionData(data);

        // If the order has been created and confirmed by the Stripe webhook
        if (data.status === "COMPLETED" && data.order) {
          setLoading(false);
          // Clear any stored restaurant cart
          if (typeof window !== "undefined" && data.order.restaurantId) {
            localStorage.removeItem(`dining_cart_${data.order.restaurantId}`);
            localStorage.removeItem("last_checkout_restaurant_id");
          }
          return;
        }

        // If still pending, retry up to 8 times (every 1.5 seconds) to wait for the Stripe webhook
        if (data.status === "PENDING" && pollCount < 8) {
          setTimeout(() => {
            setPollCount((prev) => prev + 1);
          }, 1500);
          return;
        }

        setLoading(false);
      } else {
        setError("Unable to find payment details for this session.");
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to load payment session:", err);
      // If server returned 404 or connection error, retry briefly
      if (pollCount < 4) {
        setTimeout(() => {
          setPollCount((prev) => prev + 1);
        }, 1500);
      } else {
        setError(
          typeof err === "string"
            ? err
            : err?.message || "Failed to verify payment status. Please check your bank or contact staff."
        );
        setLoading(false);
      }
    }
  }, [sessionId, pollCount]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <Container size="sm" py={80}>
        <Paper p="xl" radius="lg" withBorder shadow="sm" style={{ textAlign: "center" }}>
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="teal" variant="light">
              <IconClock size={32} />
            </ThemeIcon>
            <Title order={3}>Confirming Payment with Stripe...</Title>
            <Text c="dimmed" size="sm" maw={400}>
              Please hold on while we secure your payment and notify the kitchen. This only takes a
              moment!
            </Text>
            <Loading message="Syncing payment session..." minHeight="80px" />
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (error || !sessionData) {
    return (
      <Container size="sm" py={60}>
        <Paper p="xl" radius="lg" withBorder shadow="sm">
          <Stack align="center" gap="md" style={{ textAlign: "center" }}>
            <ThemeIcon size={64} radius="xl" color="red" variant="light">
              <IconAlertCircle size={32} />
            </ThemeIcon>
            <Title order={3}>Payment Verification Issue</Title>
            <Text c="dimmed" size="sm" maw={440}>
              {error || "We couldn't confirm this payment session. If your card was charged, your order is likely safe with the kitchen."}
            </Text>
            <Group mt="md">
              <Button
                variant="default"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.back()}
              >
                Go Back
              </Button>
              <Button color="orange" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    );
  }

  const order = sessionData.order;
  const restaurantId = order?.restaurantId || "";
  const restaurantName = order?.restaurant?.name || "Kitchen";
  const tableNumber = order?.table?.number || "Your Table";
  const orderItems = order?.orderItems || [];
  const orderIdShort = order?.id ? order.id.slice(0, 8).toUpperCase() : (sessionData.orderId?.slice(0, 8).toUpperCase() || "CONFIRMED");

  return (
    <Box style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", padding: "40px 16px" }}>
      <Container size="sm">
        <Paper
          p={{ base: "md", sm: "xl" }}
          radius="lg"
          withBorder
          shadow="md"
          style={{ backgroundColor: "#ffffff" }}
        >
          {/* Header Banner */}
          <Stack align="center" gap="xs" style={{ textAlign: "center" }} mb="lg">
            <ThemeIcon
              size={72}
              radius="xl"
              color="teal"
              variant="filled"
              style={{
                boxShadow: "0 8px 24px rgba(18, 184, 134, 0.35)",
              }}
            >
              <IconCheck size={40} stroke={2.5} />
            </ThemeIcon>
            <Title order={2} style={{ color: "#111827", fontWeight: 800 }}>
              Payment Successful!
            </Title>
            <Text c="dimmed" size="sm">
              Your order has been paid in full and sent straight to the kitchen.
            </Text>
            <Group gap="xs" mt={4}>
              <Badge color="teal" variant="light" size="lg" leftSection={<IconCreditCard size={14} />}>
                PAID VIA STRIPE
              </Badge>
              <Badge color="blue" variant="light" size="lg" leftSection={<IconToolsKitchen2 size={14} />}>
                ORDER CONFIRMED
              </Badge>
            </Group>
          </Stack>

          <Divider my="md" />

          {/* Quick Info Grid */}
          <Paper p="md" radius="md" style={{ backgroundColor: "#f9fafb" }} withBorder mb="lg">
            <Group justify="space-between" wrap="wrap">
              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Restaurant
                </Text>
                <Text size="sm" fw={700}>
                  {restaurantName}
                </Text>
              </Box>

              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Table
                </Text>
                <Group gap={4}>
                  <IconArmchair size={16} color="var(--color-primary)" />
                  <Text size="sm" fw={700}>
                    {tableNumber}
                  </Text>
                </Group>
              </Box>

              <Box>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Order Number
                </Text>
                <Group gap={4}>
                  <Text size="sm" fw={700} ff="monospace">
                    #{orderIdShort}
                  </Text>
                  {order?.id && (
                    <CopyButton value={order.id} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied" : "Copy full ID"} withArrow position="right">
                          <ActionIcon color={copied ? "teal" : "gray"} variant="subtle" size="xs" onClick={copy}>
                            {copied ? <IconCheckSmall size={12} /> : <IconCopy size={12} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  )}
                </Group>
              </Box>
            </Group>
          </Paper>
          {/* Special Instructions / Notes */}
          {order?.notes && (
            <Text color="orange" title="Special Instructions" variant="light" mb="md">
              {order.notes}
              kkkmmmjj
            </Text>
          )}


          {/* Bottom Action Buttons */}
          <Stack gap="sm">
            {restaurantId && (
              <Button
                size="md"
                fullWidth
                color="orange"
                style={{ backgroundColor: "var(--color-primary)" }}
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => router.push(`/restaurant/${restaurantId}`)}
              >
                Back to Restaurant Menu
              </Button>
            )}

          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <Container size="sm" py={80}>
          <Loading message="Loading payment confirmation..." minHeight="200px" />
        </Container>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
