"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  Text,
  Badge,
  Button,
  Stack,
  Box,
  Avatar,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconLayoutDashboard,
  IconReceipt,
  IconToolsKitchen2,
  IconArmchair,
  IconPlus,
  IconSettings,
  IconLogout,
  IconChefHat,
} from "@tabler/icons-react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Loading } from "@/components/common/Loading";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [opened, { toggle, close }] = useDisclosure();
  const { user, restaurant, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <Loading message="Authenticating restaurant portal..." minHeight="100vh" />;
  }

  const navItems = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: <IconLayoutDashboard size={20} stroke={1.5} />,
    },
    {
      label: "Orders",
      href: "/dashboard/orders",
      icon: <IconReceipt size={20} stroke={1.5} />,
    },
    {
      label: "Menu & Categories",
      href: "/dashboard/menu",
      icon: <IconToolsKitchen2 size={20} stroke={1.5} />,
    },
    {
      label: "Tables",
      href: "/dashboard/tables",
      icon: <IconArmchair size={20} stroke={1.5} />,
    },
    {
      label: "Add-ons",
      href: "/dashboard/addons",
      icon: <IconPlus size={20} stroke={1.5} />,
    },
    {
      label: "Settings",
      href: "/dashboard/settings",
      icon: <IconSettings size={20} stroke={1.5} />,
    },
  ];

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: {
          backgroundColor: "var(--color-background)",
          minHeight: "100vh",
        },
        navbar: {
          backgroundColor: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
        },
        header: {
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="xs">
              <Box
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  backgroundColor: "var(--color-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <IconChefHat size={22} />
              </Box>
              <Box>
                <Title order={4} style={{ color: "var(--color-text)", lineHeight: 1.2 }}>
                  {restaurant?.name || "Kitchen Portal"}
                </Title>
                <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                  {restaurant?.address || "Admin Workspace"}
                </Text>
              </Box>
            </Group>
          </Group>

          <Group gap="sm">
            <Badge variant="light" color="green" size="sm">
              Live Kitchen
            </Badge>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconLogout size={16} />}
              onClick={logout}
            >
              Sign Out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack justify="space-between" h="100%">
          <Box>
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              c="dimmed"
              mb="sm"
              style={{ letterSpacing: "0.5px" }}
            >
              Management
            </Text>

            <Stack gap={4}>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={item.icon}
                    active={isActive}
                    onClick={close}
                    styles={{
                      root: {
                        borderRadius: "8px",
                        fontWeight: isActive ? 600 : 500,
                        backgroundColor: isActive
                          ? "var(--color-primary-light)"
                          : "transparent",
                        color: isActive
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                        "&:hover": {
                          backgroundColor: "var(--color-surface-hover)",
                        },
                      },
                    }}
                  />
                );
              })}
            </Stack>
          </Box>

          <Box>
            <Divider mb="sm" style={{ borderColor: "var(--color-border)" }} />
            <Group gap="sm" wrap="nowrap">
              <Avatar color="orange" radius="xl">
                {user?.name?.charAt(0)?.toUpperCase() || "A"}
              </Avatar>
              <Box style={{ overflow: "hidden" }}>
                <Text size="sm" fw={600} truncate style={{ color: "var(--color-text)" }}>
                  {user?.name || "Admin Staff"}
                </Text>
                <Text size="xs" truncate style={{ color: "var(--color-text-muted)" }}>
                  {user?.email || ""}
                </Text>
              </Box>
            </Group>
          </Box>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
