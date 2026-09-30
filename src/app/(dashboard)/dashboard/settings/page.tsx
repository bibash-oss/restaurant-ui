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
  Avatar,
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
  IconUpload,
  IconTrash,
  IconPhoto,
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

  const restaurantTitle = restaurant?.name || user?.restaurant?.name || "Restaurant Menu";
  const restaurantInitial = (restaurantTitle || "R").trim().charAt(0).toUpperCase();

  // Check restaurant/user profile logo or localStorage uploaded logo
  const defaultLogo =
    restaurant?.imgUrl ||
    user?.restaurant?.imgUrl ||
    "";
  const [customLogoUrl, setCustomLogoUrl] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined" && restaurantId) {
      const saved = localStorage.getItem(`restaurant_qr_custom_logo_${restaurantId}`);
      if (saved) {
        setCustomLogoUrl(saved);
      }
    }
  }, [restaurantId]);

  const activeLogo = customLogoUrl || defaultLogo || "";

  // Fallback initial badge SVG when no logo image is available
  const firstLetterBadgeSrc = React.useMemo(() => {
    if (!restaurantTitle) return undefined;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#ea580c"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="26" fill="url(#badgeGrad)"/>
        <rect x="5" y="5" width="90" height="90" rx="22" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity="0.3"/>
        <text x="50" y="65" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="44" fill="#ffffff">${restaurantInitial}</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [restaurantTitle, restaurantInitial]);

  // Center QR image: logo if available, else first letter
  const qrCenterImageSrc = React.useMemo(() => {
    if (!activeLogo) return firstLetterBadgeSrc;
    if (activeLogo.startsWith("data:") || activeLogo.startsWith("blob:")) {
      return activeLogo;
    }
    // Remote URLs (e.g. storage.googleapis.com, external uploads) must be proxied to avoid CORS blocking when rendering on canvas
    return `/api/proxy-image?url=${encodeURIComponent(activeLogo)}`;
  }, [activeLogo, firstLetterBadgeSrc]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomLogoUrl(dataUrl);
        if (restaurantId) {
          localStorage.setItem(`restaurant_qr_custom_logo_${restaurantId}`, dataUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogo = () => {
    setCustomLogoUrl("");
    if (restaurantId) {
      localStorage.removeItem(`restaurant_qr_custom_logo_${restaurantId}`);
    }
  };

  const handleDownload = (includeBranding: boolean = true) => {
    const canvas = document.getElementById("restaurant-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    const safeName = (restaurantTitle || "restaurant")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "restaurant";

    const triggerDownload = (url: string, name: string) => {
      const downloadLink = document.createElement("a");
      downloadLink.download = name;
      downloadLink.href = url;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setDownloadedFileName(name);
      setTimeout(() => setDownloadedFileName(null), 4000);
    };

    const drawRoundRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    };

    const drawCenterLogoToContext = (
      c: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      onDone: () => void
    ) => {
      if (!qrCenterImageSrc) {
        onDone();
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Draw white rounded background behind logo
        c.fillStyle = "#ffffff";
        c.shadowColor = "rgba(0, 0, 0, 0.15)";
        c.shadowBlur = Math.round(size * 0.12);
        drawRoundRect(c, cx - 4, cy - 4, size + 8, size + 8, Math.round(size * 0.2));
        c.fill();
        c.shadowColor = "transparent";
        c.shadowBlur = 0;

        c.save();
        drawRoundRect(c, cx, cy, size, size, Math.round(size * 0.16));
        c.clip();
        c.drawImage(img, cx, cy, size, size);
        c.restore();
        onDone();
      };
      img.onerror = () => {
        onDone();
      };
      img.src = qrCenterImageSrc;
    };

    if (!includeBranding) {
      const standaloneCanvas = document.createElement("canvas");
      standaloneCanvas.width = 512;
      standaloneCanvas.height = 512;
      const sCtx = standaloneCanvas.getContext("2d");
      if (!sCtx) {
        triggerDownload(canvas.toDataURL("image/png"), `${safeName}-qr-only.png`);
        return;
      }
      sCtx.drawImage(canvas, 0, 0, 512, 512);

      const logoSize = 110;
      const logoPos = (512 - logoSize) / 2;
      drawCenterLogoToContext(sCtx, logoPos, logoPos, logoSize, () => {
        try {
          triggerDownload(standaloneCanvas.toDataURL("image/png"), `${safeName}-qr-only.png`);
        } catch {
          triggerDownload(canvas.toDataURL("image/png"), `${safeName}-qr-only.png`);
        }
      });
      return;
    }

    // High quality branded card with Restaurant Name for tables and counters
    const exportCanvas = document.createElement("canvas");
    const width = 640;
    const height = 820;
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) {
      triggerDownload(canvas.toDataURL("image/png"), `${safeName}-menu-qr.png`);
      return;
    }

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Subtle outer border
    ctx.strokeStyle = "#e9ecef";
    ctx.lineWidth = 4;
    drawRoundRect(ctx, 20, 20, width - 40, height - 40, 24);
    ctx.stroke();

    // Header badge: DIGITAL MENU
    const badgeText = "DIGITAL MENU";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const badgeWidth = 140;
    const badgeHeight = 32;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = 50;
    ctx.fillStyle = "#fff4e6";
    drawRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 16);
    ctx.fill();
    ctx.fillStyle = "#e8590c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, width / 2, badgeY + badgeHeight / 2);

    // Restaurant Name
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const nameY = 120;
    let displayName = restaurantTitle;
    if (ctx.measureText(displayName).width > width - 80) {
      while (ctx.measureText(displayName + "…").width > width - 80 && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += "…";
    }
    ctx.fillText(displayName, width / 2, nameY);

    // Subtitle
    ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#6c757d";
    ctx.fillText("Scan with phone camera to view menu & order", width / 2, nameY + 34);

    // Draw QR canvas in the center
    const qrSize = 420;
    const qrX = (width - qrSize) / 2;
    const qrY = nameY + 62;

    // QR container box
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#dee2e6";
    ctx.lineWidth = 2;
    drawRoundRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20);
    ctx.fill();
    ctx.stroke();

    ctx.drawImage(canvas, qrX, qrY, qrSize, qrSize);

    // Footer instruction
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#e8590c";
    ctx.fillText("Scan to Order", width / 2, qrY + qrSize + 50);

    ctx.font = "13px monospace";
    ctx.fillStyle = "#868e96";
    let displayUrl = qrCodeUrl;
    if (displayUrl.length > 55) {
      displayUrl = displayUrl.slice(0, 52) + "...";
    }
    ctx.fillText(displayUrl, width / 2, qrY + qrSize + 76);

    const centerLogoSize = 90;
    const centerLogoX = qrX + (qrSize - centerLogoSize) / 2;
    const centerLogoY = qrY + (qrSize - centerLogoSize) / 2;

    drawCenterLogoToContext(ctx, centerLogoX, centerLogoY, centerLogoSize, () => {
      const fileName = `${safeName}-menu-qr.png`;
      try {
        const pngUrl = exportCanvas.toDataURL("image/png");
        triggerDownload(pngUrl, fileName);
      } catch {
        triggerDownload(canvas.toDataURL("image/png"), fileName);
      }
    });
  };

  const handlePrint = () => {
    const canvas = document.getElementById("restaurant-qr-canvas") as HTMLCanvasElement | null;
    if (!canvas || !qrCodeUrl) return;

    const dataUrl = canvas.toDataURL("image/png");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
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
              p="lg"
              radius="md"
              withBorder
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
                borderColor: "var(--color-border)",
                flexShrink: 0,
                minWidth: 230,
              }}
            >
              <Badge variant="light" color="orange" size="xs" radius="sm" mb={4}>
                DIGITAL MENU
              </Badge>
              <Text
                fw={700}
                size="md"
                ta="center"
                style={{
                  color: "#1a1a1a",
                  maxWidth: 200,
                  lineHeight: 1.25,
                  marginBottom: 8,
                  wordBreak: "break-word",
                }}
              >
                {restaurantTitle}
              </Text>

              <Box
                style={{
                  padding: 8,
                  borderRadius: 12,
                  backgroundColor: "#ffffff",
                  border: "1px solid #f1f3f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {qrCodeUrl ? (
                  <Box
                    style={{
                      position: "relative",
                      width: 190,
                      height: 190,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <QRCodeCanvas
                      id="restaurant-qr-canvas"
                      value={qrCodeUrl}
                      size={512}
                      level="H"
                      marginSize={2}
                      imageSettings={
                        qrCenterImageSrc
                          ? {
                              src: qrCenterImageSrc,
                              height: 110,
                              width: 110,
                              excavate: true,
                              crossOrigin: "anonymous",
                            }
                          : undefined
                      }
                      style={{
                        width: 190,
                        height: 190,
                        display: "block",
                      }}
                    />
                    {/* Visual Center Logo Overlay */}
                    {qrCenterImageSrc && (
                      <Box
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: "#ffffff",
                          padding: 3,
                          boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          pointerEvents: "none",
                        }}
                      >
                        {activeLogo ? (
                          <img
                            src={activeLogo}
                            alt="Logo"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              borderRadius: 7,
                            }}
                          />
                        ) : (
                          <Box
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: 7,
                              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#ffffff",
                              fontWeight: 900,
                              fontSize: 18,
                            }}
                          >
                            {restaurantInitial}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
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

              <Badge variant="light" color="orange" size="sm" mt="sm">
                Scan to Order
              </Badge>
              <Text size="xs" c="dimmed" mt={4} ta="center">
                Point camera to view menu
              </Text>
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
                  onClick={() => handleDownload(true)}
                  disabled={!qrCodeUrl}
                >
                  {downloadedFileName ? "Saved to Downloads!" : "Download QR Code (with Name)"}
                </Button>

                <Button
                  variant="default"
                  leftSection={<IconDownload size={16} />}
                  onClick={() => handleDownload(false)}
                  disabled={!qrCodeUrl}
                  title="Download only the raw QR code matrix"
                >
                  Download QR Only
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
