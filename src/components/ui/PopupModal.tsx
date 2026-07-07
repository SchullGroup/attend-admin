"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePopupStore } from "@/lib/popup-store";
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";

export function PopupModal() {
  const {
    isOpen,
    type,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    autoCloseTimeout,
    closePopup,
  } = usePopupStore();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && autoCloseTimeout) {
      timer = setTimeout(() => {
        closePopup();
      }, autoCloseTimeout);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, autoCloseTimeout, closePopup]);

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closePopup();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closePopup();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel();
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />;
      case "error":
        return <AlertCircle className="w-12 h-12 text-destructive mb-4" />;
      case "warning":
      case "confirm":
        return <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />;
      case "info":
      default:
        return <Info className="w-12 h-12 text-blue-500 mb-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md text-center flex flex-col items-center">
        <DialogHeader className="flex flex-col items-center">
          {getIcon()}
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base mt-2 text-center">
            {message}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="w-full flex sm:justify-center gap-2 mt-6">
          {(type === "confirm" || cancelText) && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
            >
              {cancelText || "Cancel"}
            </Button>
          )}
          
          <Button
            className={`flex-1 ${type === 'error' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}`}
            onClick={handleConfirm}
          >
            {confirmText || (type === "confirm" ? "Confirm" : "Ok")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
