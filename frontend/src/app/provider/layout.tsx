import { Metadata } from "next";
import ProviderClientLayout from "./ProviderClientLayout";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProviderClientLayout>{children}</ProviderClientLayout>;
}

