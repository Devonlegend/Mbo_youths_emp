import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import AdminShell from "./AdminShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-jakarta",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
});

export const metadata = {
  title: "RMHCDT Admin Portal",
  description: "Admin dashboard for RMHCDT Youth Beneficiary Management",
};

export default function AdminLayout({ children }) {
  return (
    <div className={`${jakarta.variable} ${inter.variable}`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}