"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { setCookie, deleteCookie } from "cookies-next";
import { User, Restaurant } from "@/types";
import { APILogin, APIGetMe } from "@/api/auth";
import { getCurrentUserToken } from "@/utils/helpers/getCurrentUser";

export interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  restaurant: Restaurant | null;
  restaurantId: string | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    try {
      const res: any = await APIGetMe();
      if (res && res.data) {
        setUser(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch user profile", error);
      deleteCookie("token");
      deleteCookie("username");
      deleteCookie("role");
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    const existingToken = getCurrentUserToken();
    if (typeof existingToken === "string" && existingToken) {
      setToken(existingToken);
      fetchProfile().finally(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const login = async (credentials: LoginCredentials) => {
    const res: any = await APILogin(credentials);
    const receivedToken = res?.data?.token;

    if (!receivedToken) {
      throw new Error("No token returned by server");
    }

    setToken(receivedToken);
    setCookie("token", receivedToken, { maxAge: 60 * 60 * 24 * 7, path: "/" });

    // Fetch full profile immediately
    const profileRes: any = await APIGetMe();
    if (profileRes && profileRes.data) {
      setUser(profileRes.data);
      if (profileRes.data.name) {
        setCookie("username", profileRes.data.name, { maxAge: 60 * 60 * 24 * 7, path: "/" });
      }
      if (profileRes.data.role) {
        setCookie("role", profileRes.data.role, { maxAge: 60 * 60 * 24 * 7, path: "/" });
      }
    }

    router.push("/dashboard");
  };

  const logout = () => {
    deleteCookie("token", { path: "/" });
    deleteCookie("username", { path: "/" });
    deleteCookie("role", { path: "/" });
    setUser(null);
    setToken(null);
    router.push("/login");
  };

  const restaurant = user?.restaurant || null;
  const restaurantId = user?.restaurantId || restaurant?.id || null;
  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurant,
        restaurantId,
        token,
        isLoading,
        isAuthenticated,
        login,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
