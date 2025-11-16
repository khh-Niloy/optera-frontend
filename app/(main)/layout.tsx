import TopNavbar from "@/components/TopNavbar";
import FloatingBottomNav from "@/components/FloatingBottomNav";
// import { ToastProvider } from "@/utils/ToastProvider";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* <ToastProvider /> */}
      <main className="min-h-dvh bg-white">
        <TopNavbar />
        <div className="pt-16 pb-24">{children}</div>
        <FloatingBottomNav />
      </main>
    </>
  );
}
