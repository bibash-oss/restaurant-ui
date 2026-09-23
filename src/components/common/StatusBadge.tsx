"use client";

import React from "react";
import { Badge } from "@mantine/core";
import { OrderStatus } from "@/types";

interface StatusBadgeProps {
  status: OrderStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const upper = status?.toUpperCase();

  switch (upper) {
    case "PENDING":
      return (
        <Badge variant="light" color="yellow" size="sm">
          Pending
        </Badge>
      );
    case "CONFIRMED":
      return (
        <Badge variant="light" color="blue" size="sm">
          Confirmed
        </Badge>
      );
    case "PREPARING":
      return (
        <Badge variant="light" color="orange" size="sm">
          Preparing
        </Badge>
      );
    case "READY":
      return (
        <Badge variant="light" color="teal" size="sm">
          Ready
        </Badge>
      );
    case "SERVED":
    case "COMPLETED":
      return (
        <Badge variant="light" color="green" size="sm">
          {upper === "SERVED" ? "Served" : "Completed"}
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="light" color="red" size="sm">
          Cancelled
        </Badge>
      );
    case "ACTIVE":
      return (
        <Badge variant="dot" color="green" size="sm">
          Active
        </Badge>
      );
    case "INACTIVE":
      return (
        <Badge variant="dot" color="gray" size="sm">
          Inactive
        </Badge>
      );
    default:
      return (
        <Badge variant="light" color="gray" size="sm">
          {status}
        </Badge>
      );
  }
};
