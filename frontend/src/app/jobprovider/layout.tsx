import { Metadata } from "next";
import JobProviderClientLayout from "./JobProviderClientLayout";

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
  return <JobProviderClientLayout>{children}</JobProviderClientLayout>;
}

