"use client";

import { create } from "zustand";
import { ReactNode } from "react";

export type PopupType = "success" | "error" | "warning" | "info" | "confirm";

export interface PopupState {
  isOpen: boolean;
  type: PopupType;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  autoCloseTimeout?: number;
}

interface PopupStore extends PopupState {
  openPopup: (params: Omit<PopupState, "isOpen">) => void;
  closePopup: () => void;
}

export const usePopupStore = create<PopupStore>((set) => ({
  isOpen: false,
  type: "info",
  title: "",
  message: "",
  openPopup: (params) => set({ isOpen: true, ...params }),
  closePopup: () =>
    set((state) => ({
      ...state,
      isOpen: false,
      onConfirm: undefined,
      onCancel: undefined,
    })),
}));

export const popup = {
  success: (title: string, message: ReactNode, timeout?: number) => {
    usePopupStore.getState().openPopup({
      type: "success",
      title,
      message,
      autoCloseTimeout: timeout,
    });
  },
  error: (title: string, message: ReactNode, timeout?: number) => {
    usePopupStore.getState().openPopup({
      type: "error",
      title,
      message,
      autoCloseTimeout: timeout,
    });
  },
  confirm: (
    title: string,
    message: ReactNode,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText = "Confirm",
    cancelText = "Cancel"
  ) => {
    usePopupStore.getState().openPopup({
      type: "confirm",
      title,
      message,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
    });
  },
};
