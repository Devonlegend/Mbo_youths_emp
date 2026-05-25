import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm",
});

export const metadata = {
  title: "RMHCDT Youth Portal",
  description: "Royal Mbo Host Community Development Trust - Youth Beneficiary Portal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={sora.variable + " " + dmSans.variable}>
        {children}
      </body>
    </html>
  );
}