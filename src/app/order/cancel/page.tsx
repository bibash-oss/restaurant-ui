"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Button,
  Box,
  ThemeIcon,
  Group,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconShoppingCart,
} from "@tabler/icons-react";

export default function OrderCancelPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("last_checkout_restaurant_id");
      if (stored) {
        setRestaurantId(stored);
      }
    }
  }, []);

  return (
    <Box style={{ backgroundColor: "#f8f9fa", minHeight: "100vh", padding: "60px 16px" }}>
      <Container size="xs">
        <Paper p="xl" radius="lg" withBorder shadow="sm" style={{ backgroundColor: "#ffffff" }}>
          <Stack align="center" gap="md" style={{ textAlign: "center" }}>
            <ThemeIcon size={64} radius="xl" color="orange" variant="light">
              <IconAlertTriangle size={34} />
            </ThemeIcon>

            <Title order={3} style={{ color: "#1f2937", fontWeight: 700 }}>
              Payment Cancelled
            </Title>

            <Text c="dimmed" size="sm" maw={380}>
              You did not complete your payment with Stripe. No charges were made to your card, and your
              items are still saved in your cart.
            </Text>

            <Stack gap="xs" w="100%" mt="md">
              {restaurantId ? (
                <Button
                  size="md"
                  color="orange"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  leftSection={<IconShoppingCart size={18} />}
                  onClick={() => router.push(`/restaurant/${restaurantId}`)}
                >
                  Return to Cart & Menu
                </Button>
              ) : (
                <Button
                  size="md"
                  color="orange"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => router.back()}
                >
                  Go Back to Restaurant
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
