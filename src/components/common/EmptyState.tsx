"use client";

import React from "react";
import { Center, Stack, Title, Text, Box } from "@mantine/core";
import { IconInbox } from "@tabler/icons-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <Center
      style={{
        padding: "3rem 1.5rem",
        borderRadius: "8px",
        border: "1px dashed var(--color-border-dark)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      <Stack align="center" gap="xs">
        <Box style={{ color: "var(--color-text-muted)" }}>
          {icon || <IconInbox size={48} stroke={1.5} />}
        </Box>
        <Title order={4} style={{ color: "var(--color-text)", marginTop: "0.5rem" }}>
          {title}
        </Title>
        {description && (
          <Text size="sm" style={{ color: "var(--color-text-muted)", maxWidth: 360, textAlign: "center" }}>
            {description}
          </Text>
        )}
        {action && <Box mt="sm">{action}</Box>}
      </Stack>
    </Center>
  );
};
