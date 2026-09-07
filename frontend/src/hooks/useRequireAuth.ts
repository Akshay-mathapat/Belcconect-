"use client";

import { useState, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";

export interface RequireAuthOptions {
  action: () => void;
  returnTo: string;
  title?: string;
  description?: string;
}

export function useRequireAuth() {
  const { currentUser } = useAuthStore();
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    returnTo: string;
    title?: string;
    description?: string;
  }>({
    isOpen: false,
    returnTo: "/"
  });

  const requireAuth = useCallback(
    ({ action, returnTo, title, description }: RequireAuthOptions) => {
      // Check if user is logged in
      if (currentUser && currentUser.id) {
        action();
      } else {
        setDialogState({
          isOpen: true,
          returnTo,
          title,
          description
        });
      }
    },
    [currentUser]
  );

  const closeAuthDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    isAuthenticated: !!currentUser?.id,
    currentUser,
    requireAuth,
    authDialogProps: {
      isOpen: dialogState.isOpen,
      onClose: closeAuthDialog,
      returnTo: dialogState.returnTo,
      title: dialogState.title,
      description: dialogState.description
    }
  };
}
