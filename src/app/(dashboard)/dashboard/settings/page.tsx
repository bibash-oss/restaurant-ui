"use client";

import React from "react";
import {
  Card,
  Group,
  Text,
  Title,
  Stack,
  Box,
  Badge,
  SimpleGrid,
  Divider,
  Button,
  Paper,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconBuildingStore,
  IconUserCircle,
  IconQrcode,
  IconDownload,
  IconCheck,
  IconDeviceMobile,
  IconPrinter,
  IconWifi,
} from "@tabler/icons-react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/features/auth/context/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { checkPrintAgentActive } from "@/utils/lanPrinter";
import { PrintAgentModal } from "@/components/printing/PrintAgentModal";

export default function SettingsPage() {
  const { restaurant, user } = useAuth();
  const [downloadedFileName, setDownloadedFileName] = React.useState<string | null>(null);

  const [networkIp, setNetworkIp] = React.useState<string>("192.168.1.91:3000");
  const [useNetworkIp, setUseNetworkIp] = React.useState<boolean>(true);

  const [agentActive, setAgentActive] = React.useState<boolean | null>(null);
  const [agentModalOpened, { open: openAgentModal, close: closeAgentModal }] = useDisclosure(false);

  React.useEffect(() => {
    checkPrintAgentActive().then(setAgentActive);
  }, []);

  // Resolve QR URL from user profile, restaurant or fallback
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const restaurantId = user?.restaurantId || restaurant?.id || "";

  const rawQrUrl =
    user?.qrUrl ||
    restaurant?.qrUrl ||
    (restaurantId ? `${origin}/restaurant/${restaurantId}` : "");

  // If scanning from phone, replace localhost with Wi-Fi network IP so mobile phone doesn't fail
  const qrCodeUrl = React.useMemo(() => {
    if (!rawQrUrl) return "";
    if (useNetworkIp && (isLocalhost || rawQrUrl.includes("localhost"))) {
      return rawQrUrl.replace(
        /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
        `http://${networkIp}`
      );
    }
    return rawQrUrl;
  }, [rawQrUrl, useNetworkIp, isLocalhost, networkIp]);

  const handleDownload = () => {
    const canvas = document.getElementById("restaurant-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    const safeName = (restaurant?.name || "restaurant")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "restaurant";
    const fileName = `${safeName}-menu-qr.png`;

    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.download = fileName;
    downloadLink.href = pngUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setDownloadedFileName(fileName);
    setTimeout(() => setDownloadedFileName(null), 4000);
  };

  const handlePrint = () => {
    const canvas = document.getElementById("restaurant-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas || !qrCodeUrl) return;

    const dataUrl = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const restaurantTitle = restaurant?.name || "Restaurant Menu";
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print QR Code - ${restaurantTitle}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              margin: 0;
              padding: 24px;
              color: #212529;
              background-color: #fff;
            }
            .card {
              border: 2px dashed #ced4da;
              border-radius: 20px;
              padding: 40px;
              text-align: center;
              max-width: 400px;
              width: 100%;
              box-sizing: border-box;
            }
            .logo-badge {
              display: inline-block;
              background: #fff4e6;
              color: #e8590c;
              font-size: 13px;
              font-weight: 700;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              padding: 6px 14px;
              border-radius: 20px;
              margin-bottom: 12px;
            }
            h1 {
              font-size: 26px;
              margin: 0 0 8px 0;
              color: #212529;
            }
            .subtitle {
              font-size: 14px;
              color: #6c757d;
              margin: 0 0 24px 0;
            }
            .qr-wrapper {
              display: inline-block;
              padding: 16px;
              background: #ffffff;
              border: 1px solid #e9ecef;
              border-radius: 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              margin-bottom: 20px;
            }
            img {
              display: block;
              width: 240px;
              height: 240px;
            }
            .instruction {
              font-size: 15px;
              font-weight: 600;
              color: #e8590c;
              margin-bottom: 8px;
            }
            .url {
              font-size: 11px;
              font-family: monospace;
              color: #868e96;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo-badge">Digital Menu</div>
            <h1>${restaurantTitle}</h1>
            <p class="subtitle">Scan the QR code with your phone camera to view the menu & order</p>
            <div class="qr-wrapper">
              <img src="${dataUrl}" alt="Restaurant QR Code" />
            </div>
            <div class="instruction">Scan with camera to order</div>
            <div class="url">${qrCodeUrl}</div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };



  return (
    <Box>
      <PageHeader
        title="Restaurant Details & Settings"
        description="View current restaurant branch configuration, customer ordering QR code, and active staff profile"
      />

      <Stack gap="xl">
        {/* QR Code & Digital Menu Card */}
        <Card
          padding="xl"
          radius="md"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <Group align="flex-start" justify="space-between" mb="lg">
            <Group align="center" gap="md">
              <Box
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "10px",
                  backgroundColor: "var(--color-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <IconQrcode size={26} />
              </Box>
              <Box>
                <Title order={4} style={{ color: "var(--color-text)" }}>
                  Customer Menu & Table Ordering QR Code
                </Title>
                <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                  Direct link for customers to scan, view live menu, and place orders
                </Text>
              </Box>
            </Group>

            <Badge color="green" variant="light">
              Live & Scannable
            </Badge>
          </Group>

          <Divider mb="lg" style={{ borderColor: "var(--color-border)" }} />

          <Flex
            direction={{ base: "column", sm: "row" }}
            gap={{ base: "lg", sm: "xl" }}
            align={{ base: "center", sm: "flex-start" }}
          >
            {/* Left: QR Canvas Preview */}
            <Paper
              p="md"
              radius="md"
              withBorder
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                borderColor: "var(--color-border)",
                flexShrink: 0,
              }}
            >
              <Box
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {qrCodeUrl ? (
                  <QRCodeCanvas
                    id="restaurant-qr-canvas"
                    value={qrCodeUrl}
                    size={512}
                    level="H"
                    marginSize={2}
                    style={{
                      width: 190,
                      height: 190,
                      display: "block",
                    }}
                  />
                ) : (
                  <Box
                    style={{
                      width: 190,
                      height: 190,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    <Text size="xs">No QR URL Available</Text>
                  </Box>
                )}
              </Box>
              <Badge variant="light" color="orange" size="sm" mt="xs">
                Scan to Order
              </Badge>
            </Paper>

            {/* Right: URL, Action Buttons, and Guidance */}
            <Stack gap="md" style={{ flex: 1, width: "100%" }}>

              <Group gap="xs">
                <Badge variant="light" color="blue" size="sm" leftSection={<IconWifi size={14} />}>
                  Network Scannable: {qrCodeUrl ? qrCodeUrl.split("/restaurant/")[0] : ""}
                </Badge>
              </Group>

              <Group gap="sm" wrap="wrap">
                <Button
                  leftSection={downloadedFileName ? <IconCheck size={18} /> : <IconDownload size={18} />}
                  color={downloadedFileName ? "teal" : "orange"}
                  style={{
                    backgroundColor: downloadedFileName ? "var(--color-success)" : "var(--color-primary)",
                    transition: "all 0.2s ease",
                  }}
                  onClick={handleDownload}
                  disabled={!qrCodeUrl}
                >
                  {downloadedFileName ? "Saved to Downloads!" : "Download QR Code (PNG)"}
                </Button>

                <Button
                  variant="default"
                  leftSection={<IconPrinter size={18} />}
                  onClick={handlePrint}
                  disabled={!qrCodeUrl}
                >
                  Print Table Stand
                </Button>
              </Group>

              {downloadedFileName && (
                <Text size="xs" style={{ color: "var(--color-success)" }} fw={500}>
                  ✓ Downloaded <b>{downloadedFileName}</b> — check your browser&apos;s Downloads folder.
                </Text>
              )}

              <Paper
                p="sm"
                radius="sm"
                style={{
                  backgroundColor: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <Group gap="xs" align="flex-start" wrap="nowrap">
                  <IconDeviceMobile
                    size={20}
                    style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 2 }}
                  />
                  <Text size="xs" c="dimmed">
                    Display this QR code on dining tables, counter displays, or promotional tent cards.
                    Customers can scan using their mobile camera without needing to download any app to
                    browse the menu and order.
                  </Text>
                </Group>
              </Paper>
            </Stack>
          </Flex>
        </Card>

        {/* Restaurant and Profile Details Grid */}
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Restaurant Card */}
          <Card
            padding="xl"
            radius="md"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <Group align="flex-start" mb="md">
              <Box
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "10px",
                  backgroundColor: "var(--color-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <IconBuildingStore size={26} />
              </Box>
              <Box>
                <Title order={4} style={{ color: "var(--color-text)" }}>
                  {restaurant?.name || "Restaurant"}
                </Title>
                <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                  Active Operating Context
                </Text>
              </Box>
            </Group>

            <Divider mb="md" style={{ borderColor: "var(--color-border)" }} />

            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Status
                </Text>
                <Badge color={restaurant?.isActive !== false ? "green" : "gray"} variant="light">
                  {restaurant?.isActive !== false ? "Operational" : "Inactive"}
                </Badge>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Restaurant ID
                </Text>
                <Text size="sm" fw={600} style={{ fontFamily: "monospace" }}>
                  {restaurant?.id || "N/A"}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Address
                </Text>
                <Text size="sm" fw={500}>
                  {restaurant?.address || "Main Dining Area"}
                </Text>
              </Group>

              {restaurant?.slug && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Identifier Slug
                  </Text>
                  <Text size="sm">{restaurant.slug}</Text>
                </Group>
              )}
            </Stack>
          </Card>

          {/* User Profile Card */}
          <Card
            padding="xl"
            radius="md"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <Group align="flex-start" mb="md">
              <Box
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "10px",
                  backgroundColor: "var(--color-surface-hover)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-secondary)",
                }}
              >
                <IconUserCircle size={26} />
              </Box>
              <Box>
                <Title order={4} style={{ color: "var(--color-text)" }}>
                  Staff Profile
                </Title>
                <Text size="xs" style={{ color: "var(--color-text-muted)" }}>
                  Current Logged In User
                </Text>
              </Box>
            </Group>

            <Divider mb="md" style={{ borderColor: "var(--color-border)" }} />

            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Name
                </Text>
                <Text size="sm" fw={600}>
                  {user?.name || "Admin"}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Email
                </Text>
                <Text size="sm">{user?.email || "admin@example.com"}</Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  System Role
                </Text>
                <Badge color="orange" variant="light">
                  {user?.role || "ADMIN"}
                </Badge>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Account Status
                </Text>
                <Badge color="green" variant="dot">
                  Active
                </Badge>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>

        {/* Receipt Printer & Kitchen Print Agent Card */}
        <Card
          padding="xl"
          radius="md"
          style={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <Flex
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align={{ base: "flex-start", sm: "center" }}
            gap="md"
          >
            <Group align="flex-start" gap="md">
              <Box
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "10px",
                  backgroundColor: "var(--mantine-color-teal-0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--mantine-color-teal-7)",
                }}
              >
                <IconPrinter size={26} />
              </Box>
              <Box>
                <Group gap="xs">
                  <Title order={4} style={{ color: "var(--color-text)" }}>
                    Thermal Receipt Printing & Desktop Agent
                  </Title>
                  <Badge
                    color={agentActive ? "teal" : "gray"}
                    variant={agentActive ? "filled" : "outline"}
                    size="sm"
                  >
                    {agentActive ? "Agent Connected" : "Agent Inactive"}
                  </Badge>
                </Group>
                <Text size="xs" style={{ color: "var(--color-text-muted)" }} mt={4}>
                  Install the Kitchen Print Agent on your restaurant Windows/Mac/Linux PC for silent 80mm thermal receipt printing and local network printer auto-discovery.
                </Text>
              </Box>
            </Group>

            <Group gap="sm" wrap="wrap">
              <Button
                color="teal"
                variant="filled"
                leftSection={<IconDownload size={18} />}
                onClick={openAgentModal}
              >
                Download Print Agent
              </Button>
            </Group>
          </Flex>
        </Card>

        {/* Print Agent Download & Help Modal */}
        <PrintAgentModal
          opened={agentModalOpened}
          onClose={closeAgentModal}
          agentActive={agentActive}
          onStatusChange={(active) => setAgentActive(active)}
        />
      </Stack>
    </Box>
  );
}
