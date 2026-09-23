"use client";

import React from "react";
import { Group, Title, Text, Box, Stack } from "@mantine/core";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <Box mb="xl" style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1rem" }}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2} style={{ color: "var(--color-text)", fontWeight: 700, letterSpacing: "-0.5px" }}>
            {title}
          </Title>
          {description && (
            <Text size="sm" style={{ color: "var(--color-text-muted)" }}>
              {description}
            </Text>
          )}
        </Stack>
        {action && <Box>{action}</Box>}
      </Group>
    </Box>
  );
};
