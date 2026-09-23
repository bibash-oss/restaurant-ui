"use client";

import React from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";

interface LoadingProps {
  message?: string;
  minHeight?: string | number;
}

export const Loading: React.FC<LoadingProps> = ({
  message = "Loading...",
  minHeight = "250px",
}) => {
  return (
    <Center style={{ minHeight, width: "100%" }}>
      <Stack align="center" gap="sm">
        <Loader color="orange" size="md" type="dots" />
        <Text size="sm" style={{ color: "var(--color-text-muted)" }}>
          {message}
        </Text>
      </Stack>
    </Center>
  );
};
