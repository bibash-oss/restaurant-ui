"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Stack,
  Alert,
  Box,
} from "@mantine/core";
import { IconAlertCircle, IconChefHat } from "@tabler/icons-react";
import { useAuth, LoginCredentials } from "../context/AuthContext";

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (data: LoginCredentials) => {
    setErrorMessage(null);
    try {
      await login(data);
    } catch (err: any) {
      setErrorMessage(
        typeof err === "string"
          ? err
          : err?.message || "Failed to log in. Please check your credentials."
      );
    }
  };

  return (
    <Paper
      withBorder
      shadow="md"
      p={36}
      radius="lg"
      style={{
        width: "100%",
        maxWidth: 440,
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <Stack align="center" gap="xs" mb="lg">
        <Box
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            backgroundColor: "var(--color-primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-primary)",
          }}
        >
          <IconChefHat size={28} />
        </Box>
        <Title
          order={2}
          style={{
            color: "var(--color-text)",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          Kitchen Portal
        </Title>
        <Text size="sm" style={{ color: "var(--color-text-muted)" }}>
          Sign in to manage orders, menu & tables
        </Text>
      </Stack>

      {errorMessage && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Login Error"
          color="red"
          variant="light"
          mb="md"
        >
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="md">
          <TextInput
            label="Email"
            placeholder="admin@example.com"
            required
            error={errors.email?.message}
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: "Invalid email address",
              },
            })}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: {
                value: 6,
                message: "Password must be at least 6 characters",
              },
            })}
          />

          <Button
            type="submit"
            fullWidth
            mt="sm"
            loading={isSubmitting}
            style={{
              backgroundColor: "var(--color-primary)",
              color: "#ffffff",
            }}
          >
            Sign In
          </Button>
        </Stack>
      </form>
    </Paper>
  );
};
