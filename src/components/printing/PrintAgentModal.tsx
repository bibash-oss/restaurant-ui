"use client";

import React, { useState } from "react";
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Card,
  Button,
  SimpleGrid,
  Alert,
  Divider,
  Paper,
  Box,
  Anchor,
  Tabs,
  Code,
} from "@mantine/core";
import {
  IconBrandWindows,
  IconBrandApple,
  IconDownload,
  IconCheck,
  IconAlertCircle,
  IconRefresh,
  IconPrinter,
} from "@tabler/icons-react";
import { checkPrintAgentActive } from "@/utils/lanPrinter";

interface PrintAgentModalProps {
  opened: boolean;
  onClose: () => void;
  agentActive: boolean | null;
  onStatusChange?: (active: boolean) => void;
}

export function PrintAgentModal({
  opened,
  onClose,
  agentActive,
  onStatusChange,
}: PrintAgentModalProps) {
  const [checking, setChecking] = useState(false);
  const [localActive, setLocalActive] = useState<boolean | null>(agentActive);

  React.useEffect(() => {
    setLocalActive(agentActive);
  }, [agentActive]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const active = await checkPrintAgentActive();
      setLocalActive(active);
      if (onStatusChange) {
        onStatusChange(active);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPrinter size={22} color="var(--mantine-color-teal-6)" />
          <Text fw={700} size="md">
            Kitchen Print Agent
          </Text>
          <Badge
            size="sm"
            color={localActive ? "teal" : "gray"}
            variant={localActive ? "filled" : "outline"}
          >
            {localActive ? "Connected (Port 8088)" : "Not Detected"}
          </Badge>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        {/* Status Banner */}
        {localActive ? (
          <Alert
            color="teal"
            icon={<IconCheck size={18} />}
            title="Local Print Agent is Active & Ready"
            radius="md"
          >
            Direct ESC/POS silent receipt printing and instant subnet auto-discovery are operational on this PC. No browser print dialogs needed.
          </Alert>
        ) : (
          <Alert
            color="blue"
            icon={<IconAlertCircle size={18} />}
            title="Install Print Agent on your Restaurant / POS PC"
            radius="md"
          >
            Install this lightweight local utility on the computer connected to your thermal receipt printers. No zip extraction needed — just download and double-click to run!
          </Alert>
        )}

        {/* Download Packages Cards */}
        <Text fw={700} size="sm" c="dimmed" tt="uppercase" mt="xs">
          Direct 1-Click Installers (No Extraction Needed)
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {/* Windows Package */}
          <Card withBorder padding="md" radius="md" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Box>
              <Group gap="xs" mb="xs">
                <IconBrandWindows size={24} color="#0078d4" />
                <Text fw={700} size="md">Windows (POS)</Text>
              </Group>
              <Badge size="xs" color="blue" variant="light" mb="xs">
                1-Click Direct .exe (No Zip)
              </Badge>
              <Text size="xs" c="dimmed" mb="sm">
                Direct executable for Windows POS terminals. Installs and runs in the background on double-click.
              </Text>
            </Box>
            <Stack gap={4}>
              <Button
                component="a"
                href="/api/downloads/print-agent/KitchenPrintAgent.exe"
                download="KitchenPrintAgent.exe"
                size="sm"
                variant="filled"
                color="blue"
                leftSection={<IconDownload size={16} />}
                fullWidth
              >
                Download for Windows (.exe)
              </Button>
              <Anchor
                href="/api/downloads/print-agent/kitchen-print-agent-windows.zip"
                download="kitchen-print-agent-windows.zip"
                size="xs"
                ta="center"
                c="dimmed"
              >
                Alternative: ZIP Archive
              </Anchor>
            </Stack>
          </Card>

          {/* macOS Package */}
          <Card withBorder padding="md" radius="md" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Box>
              <Group gap="xs" mb="xs">
                <IconBrandApple size={24} color="#555" />
                <Text fw={700} size="md">macOS</Text>
              </Group>
              <Badge size="xs" color="gray" variant="light" mb="xs">
                1-Click Native Installer (.pkg)
              </Badge>
              <Text size="xs" c="dimmed" mb="sm">
                Standard Apple installer wizard. Installs into Applications and auto-runs on login with zero extraction.
              </Text>
            </Box>
            <Stack gap={4}>
              <Button
                component="a"
                href="/api/downloads/print-agent/KitchenPrintAgent.pkg"
                download="KitchenPrintAgent.pkg"
                size="sm"
                variant="light"
                color="dark"
                leftSection={<IconDownload size={16} />}
                fullWidth
              >
                Download for macOS (.pkg)
              </Button>
              <Anchor
                href="/api/downloads/print-agent/KitchenPrintAgent.dmg"
                download="KitchenPrintAgent.dmg"
                size="xs"
                ta="center"
                c="dimmed"
              >
                Alternative: DMG Disk Image
              </Anchor>
            </Stack>
          </Card>
        </SimpleGrid>

        <Divider label="How To Run" labelPosition="center" my="xs" />

        {/* Installation Instructions */}
        <Tabs defaultValue="windows">
          <Tabs.List grow>
            <Tabs.Tab value="windows" leftSection={<IconBrandWindows size={14} />}>
              Windows (1-Click)
            </Tabs.Tab>
            <Tabs.Tab value="macos" leftSection={<IconBrandApple size={14} />}>
              macOS (1-Click)
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="windows" pt="xs">
            <Paper p="sm" withBorder radius="sm" bg="var(--mantine-color-gray-0)">
              <Stack gap="xs">
                <Text size="xs">
                  <b>1.</b> Click <b>Download for Windows (.exe)</b>.
                </Text>
                <Text size="xs">
                  <b>2.</b> Click the downloaded <Code>KitchenPrintAgent.exe</Code> directly in your browser.
                </Text>
                <Text size="xs">
                  <b>3.</b> That&apos;s all! It immediately runs silently in the background and auto-starts every time Windows boots. No zip extraction or terminal needed.
                </Text>
              </Stack>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="macos" pt="xs">
            <Paper p="sm" withBorder radius="sm" bg="var(--mantine-color-gray-0)">
              <Stack gap="xs">
                <Text size="xs">
                  <b>1.</b> Click <b>Download for macOS (.pkg)</b>.
                </Text>
                <Text size="xs">
                  <b>2.</b> Double-click the downloaded <Code>KitchenPrintAgent.pkg</Code> file to open the standard Apple installer wizard.
                </Text>
                <Text size="xs">
                  <b>3.</b> Click <b>Continue</b> and <b>Install</b>. The agent is installed into Applications and starts running in the background automatically on login.
                </Text>
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>

        {/* Footer Actions */}
        <Group justify="space-between" mt="sm">
          <Button
            variant="light"
            color="teal"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            loading={checking}
            onClick={handleCheckStatus}
          >
            Check Agent Connection
          </Button>

          <Button variant="default" size="xs" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
