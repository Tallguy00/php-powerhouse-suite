import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import CustomerDashboard from "./pages/dashboard/CustomerDashboard.tsx";
import CustomerOutages from "./pages/dashboard/CustomerOutages.tsx";
import CustomerBills from "./pages/dashboard/CustomerBills.tsx";
import CustomerBillDetail from "./pages/dashboard/CustomerBillDetail.tsx";
import CustomerConsumption from "./pages/dashboard/CustomerConsumption.tsx";
import AdminDashboard from "./pages/dashboard/AdminDashboard.tsx";
import TechnicianDashboard from "./pages/dashboard/TechnicianDashboard.tsx";
import TechnicianTasks from "./pages/dashboard/TechnicianTasks.tsx";
import TechnicianOutages from "./pages/dashboard/TechnicianOutages.tsx";
import AdminCustomers from "./pages/admin/AdminCustomers.tsx";
import AdminMeters from "./pages/admin/AdminMeters.tsx";
import AdminTariffs from "./pages/admin/AdminTariffs.tsx";
import AdminOutages from "./pages/admin/AdminOutages.tsx";
import AdminPayments from "./pages/admin/AdminPayments.tsx";
import AdminBills from "./pages/admin/AdminBills.tsx";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<CustomerDashboard />} />
              <Route path="/dashboard/outages" element={<CustomerOutages />} />
              <Route path="/dashboard/bills" element={<CustomerBills />} />
              <Route path="/dashboard/bills/:id" element={<CustomerBillDetail />} />
              <Route path="/dashboard/consumption" element={<CustomerConsumption />} />
              <Route path="/dashboard/*" element={<CustomerDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/meters" element={<AdminMeters />} />
              <Route path="/admin/tariffs" element={<AdminTariffs />} />
              <Route path="/admin/outages" element={<AdminOutages />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/bills" element={<AdminBills />} />
              <Route path="/admin/*" element={<AdminDashboard />} />
              <Route path="/technician" element={<TechnicianDashboard />} />
              <Route path="/technician/tasks" element={<TechnicianTasks />} />
              <Route path="/technician/outages" element={<TechnicianOutages />} />
              <Route path="/technician/*" element={<TechnicianDashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
