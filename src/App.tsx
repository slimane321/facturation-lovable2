import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DataProvider } from "@/contexts/DataContext";
import { DocumentProvider } from "@/contexts/DocumentContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuditProvider } from "@/contexts/AuditContext";
import { RoleProvider } from "@/contexts/RoleContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import AuthGuard from "@/components/AuthGuard";
import Layout from "@/components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import CreateInvoice from "./pages/CreateInvoice";
import InvoiceDetail from "./pages/InvoiceDetail";
import Clients from "./pages/Clients";
import Products from "./pages/Products";
import Reports from "./pages/Reports";
import Comptabilite from "./pages/Comptabilite";
import Devis from "./pages/Devis";
import BonCommande from "./pages/BonCommande";
import BonLivraison from "./pages/BonLivraison";
import Achats from "./pages/Achats";
import Settings from "./pages/Settings";
import ClientStatement from "./pages/ClientStatement";
import NotFound from "./pages/NotFound";
import PrintBatch from "./pages/PrintBatch";
import VerifyInvoice from "./pages/VerifyInvoice";
import UserManagement from "./pages/UserManagement";
import Notifications from "./pages/Notifications";
import StockHub from "./pages/StockHub";
import Depenses from "./pages/Depenses";
import Fournisseurs from "./pages/Fournisseurs";
import Caisse from "./pages/Caisse";
import AuditJournal from "./pages/AuditJournal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <SettingsProvider>
          <RoleProvider>
            <AuditProvider>
              <DataProvider>
                <DocumentProvider>
                  <NotificationProvider>
                    <TooltipProvider>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <Routes>
                          {/* Public routes */}
                          <Route path="/login" element={<Login />} />
                          <Route path="/verify/:id" element={<VerifyInvoice />} />

                          {/* Protected routes */}
                          <Route
                            element={
                              <AuthGuard>
                                <Layout />
                              </AuthGuard>
                            }
                          >
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/invoices" element={<Invoices />} />
                            <Route path="/invoices/new" element={<CreateInvoice />} />
                            <Route path="/invoices/:id" element={<InvoiceDetail />} />
                            <Route path="/clients" element={<Clients />} />
                            <Route path="/clients/statement" element={<ClientStatement />} />
                            <Route path="/products" element={<Products />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/comptabilite" element={<Comptabilite />} />
                            <Route path="/devis" element={<Devis />} />
                            <Route path="/bc" element={<BonCommande />} />
                            <Route path="/bl" element={<BonLivraison />} />
                            <Route path="/achats" element={<Achats />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/users" element={<UserManagement />} />
                            <Route path="/notifications" element={<Notifications />} />
                            <Route path="/stock" element={<StockHub />} />
                            <Route path="/depenses" element={<Depenses />} />
                            <Route path="/fournisseurs" element={<Fournisseurs />} />
                            <Route path="/caisse" element={<Caisse />} />
                            <Route path="/audit" element={<AuditJournal />} />
                          </Route>
                          <Route path="/print-batch" element={<PrintBatch />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </BrowserRouter>
                    </TooltipProvider>
                  </NotificationProvider>
                </DocumentProvider>
              </DataProvider>
            </AuditProvider>
          </RoleProvider>
        </SettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
