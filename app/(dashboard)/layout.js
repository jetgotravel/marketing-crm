import Sidebar from "../../components/sidebar";

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="md:ml-60 pb-20 md:pb-0">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
