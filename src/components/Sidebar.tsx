import { Link, useLocation } from 'react-router-dom';
import { useLang } from '@/contexts/LanguageContext';
import { useRole } from '@/contexts/RoleContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, FileText, Users, Package, Plus,
  Settings, Star, ChevronDown, Globe, BarChart2,
  FileCheck, ShoppingCart, Truck, ShoppingBag, BookOpen, UserCog, Bell, Warehouse, Receipt, LogOut,
  Building2, Banknote, Shield, Radio, Menu, X
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button
      onClick={logout}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
    >
      <LogOut className="w-4 h-4" />
      Déconnexion
    </button>
  );
}

interface NavGroupProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function NavGroup({ label, defaultOpen = false, children }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors">
        <span>{label}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const { t, lang, setLang } = useLang();
  const { can, currentUser, isAdmin } = useRole();
  const { unreadCount } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  const linkCls = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
    active
      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
  );

  const NavItem = ({ href, icon: Icon, label, badge }: { href: string; icon: any; label: string; badge?: number }) => (
    <Link to={href} className={linkCls(isActive(href))} onClick={() => setMobileOpen(false)}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && badge > 0 && (
        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );

  const sidebarContent = (
    <>
      {/* Logo + DGI Badge */}
      <div className="px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center shadow-sm">
            <Star className="w-5 h-5 text-gold-foreground fill-gold-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-tight">{t.appName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-tight">{t.tagline}</p>
          </div>
        </div>
        {/* DGI Status Badge */}
        <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-medium text-primary">{t.secureSystem}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scroll-area">
        {/* Dashboard */}
        <NavItem href="/" icon={LayoutDashboard} label={t.dashboard} />

        {/* Quick Action */}
        {can('create_invoice') && (
          <Link
            to="/invoices/new"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-gold/10 text-gold hover:bg-gold/20 transition-all duration-150 my-2"
          >
            <Plus className="w-4 h-4" />
            {t.createInvoice}
          </Link>
        )}

        {/* Ventes & Clients */}
        <NavGroup label="Ventes & Clients" defaultOpen={
          isActive('/invoices') || isActive('/clients')
        }>
          <NavItem href="/invoices" icon={FileText} label={t.invoices} />
          <NavItem href="/clients" icon={Users} label={t.clients} />
          <NavItem href="/clients/statement" icon={BookOpen} label={t.clientStatement} />
        </NavGroup>

        {/* Documents Commerciaux */}
        <NavGroup label={t.commercialDocs} defaultOpen={
          isActive('/devis') || isActive('/bc') || isActive('/bl')
        }>
          <NavItem href="/devis" icon={FileCheck} label={t.devis} />
          <NavItem href="/bc" icon={ShoppingCart} label={t.bonCommande} />
          <NavItem href="/bl" icon={Truck} label={t.bonLivraison} />
        </NavGroup>

        {/* Achats & Stock */}
        <NavGroup label="Achats & Stock" defaultOpen={
          isActive('/fournisseurs') || isActive('/achats') || isActive('/products') || isActive('/stock')
        }>
          <NavItem href="/fournisseurs" icon={Building2} label="Fournisseurs" />
          <NavItem href="/achats" icon={ShoppingBag} label={t.achats} />
          <NavItem href="/products" icon={Package} label={t.products} />
          <NavItem href="/stock" icon={Warehouse} label="Hub de Stock" />
        </NavGroup>

        {/* Finances & Trésorerie */}
        <NavGroup label="Finances & Trésorerie" defaultOpen={
          isActive('/caisse') || isActive('/depenses') || isActive('/reports')
        }>
          <NavItem href="/caisse" icon={Banknote} label="Caisse / Cash Flow" />
          <NavItem href="/depenses" icon={Receipt} label="Dépenses" />
          <NavItem href="/reports" icon={BarChart2} label={t.reports} />
        </NavGroup>

        {/* Conformité & Comptabilité */}
        <NavGroup label="Conformité & Comptabilité" defaultOpen={
          isActive('/comptabilite') || isActive('/audit')
        }>
          <NavItem href="/comptabilite" icon={BookOpen} label={t.accounting} />
          {isAdmin && <NavItem href="/audit" icon={Shield} label="Journal d'Audit" />}
        </NavGroup>

        {/* System */}
        <NavItem href="/notifications" icon={Bell} label="Notifications" badge={unreadCount} />
        {isAdmin && <NavItem href="/users" icon={UserCog} label="Utilisateurs" />}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{currentUser.name}</p>
            <p className="text-[10px] text-sidebar-foreground/40 capitalize">{currentUser.role}</p>
          </div>
        </div>
        <button
          onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-150"
        >
          <Globe className="w-4 h-4" />
          <span className="font-medium">{lang === 'fr' ? 'العربية' : 'Français'}</span>
        </button>
        {can('access_settings') && (
          <Link to="/settings" onClick={() => setMobileOpen(false)} className={linkCls(isActive('/settings'))}>
            <Settings className="w-4 h-4" />
            {t.settings}
          </Link>
        )}
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-card border border-border shadow-md"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col h-full w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        "fixed z-40 lg:relative lg:z-auto transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}
