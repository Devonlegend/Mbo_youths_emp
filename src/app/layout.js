import ReactDOM from "react-dom";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import AdminThemeProvider from "./admin/components/AdminThemeProvider";

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
  other: {
    "format-detection": "telephone=no, email=no, address=no",
  },
};

export default function RootLayout({ children }) {
  ReactDOM.preconnect("https://res.cloudinary.com");
  ReactDOM.preload(
    "https://res.cloudinary.com/dwn6p3qmd/image/upload/f_auto,q_auto,w_80,h_80,c_fill,g_face,r_max/v1784673040/mboyouths_ssedqs.png",
    { as: "image" }
  );

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={sora.variable + " " + dmSans.variable}>
        <AdminThemeProvider>
          {children}
        </AdminThemeProvider>
      </body>
    </html>
  );
}