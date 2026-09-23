"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Center, Container, Loader } from "@mantine/core";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { useAuth } from "@/features/auth/context/AuthContext";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Loader color="orange" size="lg" />
      </Center>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-background)",
        padding: "1rem",
      }}
    >
      <Container size="xs" p={0} style={{ display: "flex", justifyContent: "center" }}>
        <LoginForm />
      </Container>
    </main>
  );
}
