import "./globals.css";
import Navbar from "./components/Navbar";
import "leaflet/dist/leaflet.css";
import "react-datepicker/dist/react-datepicker.css";

export const metadata = {
  title: "Neplanuosiu",
  description: "Vaikų gimtadienių planavimo platforma",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <Navbar />
        {/* padding-top to avoid content under fixed navbar */}
        <main className="pt-15">{children}</main>
      </body>
    </html>
  );
}
