"use client";

export interface VideoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "customer" | "provider" | "jobprovider";
}

export function VideoGuideModal({ isOpen, onClose }: VideoGuideModalProps) {
  return null;
}
