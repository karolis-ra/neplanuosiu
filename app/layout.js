import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import "leaflet/dist/leaflet.css";
import "react-datepicker/dist/react-datepicker.css";

export const metadata = {
  title: "Neplanuosiu",
  description: "Vaikų gimtadienių planavimo platforma",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="min-h-full">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <Navbar />
        {/* padding-top to avoid content under fixed navbar */}
        <main className="flex-1 pt-15">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
