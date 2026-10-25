import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Boxes, Building2, ClipboardList, ChevronDown, Globe2, LayoutDashboard, LogOut, Menu, Plus, Puzzle, ShieldCheck, Ship, X } from 'lucide-react'
import { listOrganizations } from '@/services/organizations.functions'
import { supabase } from '@/integrations/supabase/client'
import { retryServerCall } from '@/lib/server-retry'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/brand'

const modules = [
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/entity-types', label: 'Entity types', icon: Boxes },
  { to: '/trade', label: 'Manufacturers & products', icon: Building2 },
  { to: '/logistics', label: 'Shipping & transport', icon: Ship },
  { to: '/governance', label: 'Workflows & access', icon: ShieldCheck },
] as const

/**
 * Persistent workspace layout: the organization switcher and module navigation
 * stay visible on every signed-in page. The browser's organization choice is
 * only a preference; each module still resolves membership on the server.
 */
export function AppShell({ user, activeOrgId, onSelectOrg, displayName, title, sidebarExtra, children }: {
  user: { id: string; email?: string | undefined }
  activeOrgId: string | undefined
  /** Defaults to reopening the current module for the chosen organization. */
  onSelectOrg?: (id: string) => void
  displayName?: string | undefined
  title: string
  sidebarExtra?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate(); const cache = useQueryClient()
  const pathname = useRouterState({ select: s => s.location.pathname })
  const [mobile, setMobile] = useState(false)
  const fetchOrganizations = useServerFn(listOrganizations)
  const orgs = useQuery({ queryKey: ['organizations', user.id], queryFn: () => retryServerCall(() => fetchOrganizations(), { beforeRetry: () => supabase.auth.refreshSession() }) })
  function selectOrg(id: string) {
    localStorage.setItem('weorex.activeOrgId', id)
    if (onSelectOrg) onSelectOrg(id)
    else void navigate({ to: pathname, search: { org: id } })
  }
  async function signOut() { await cache.cancelQueries(); cache.clear(); localStorage.removeItem('weorex.activeOrgId'); await supabase.auth.signOut(); await navigate({ to: '/auth', replace: true }) }
  const navClass = (active: boolean) => `nav-button mb-1 ${active ? 'selected' : ''}`
  return <div className="workspace"><aside className={`workspace-sidebar overflow-y-auto ${mobile ? 'is-open' : ''}`}>
    <div className="flex items-center justify-between"><Brand/><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close navigation" onClick={() => setMobile(false)}><X/></Button></div>
    <div className="mt-9 mb-6"><label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Organization</label><div className="org-picker mt-2"><Building2 className="size-4 text-primary"/><select aria-label="Active organization" value={activeOrgId ?? ''} onChange={e => selectOrg(e.target.value)}>{!activeOrgId && <option value="">Choose organization</option>}{orgs.data?.map(org => <option value={org.id} key={org.id}>{org.name}</option>)}</select><ChevronDown className="pointer-events-none size-4"/></div></div>
    <nav className="grid" onClick={() => setMobile(false)}>
      <Button variant="ghost" className={navClass(pathname === '/dashboard')} asChild><Link to="/dashboard"><LayoutDashboard/>Dashboard</Link></Button>
      {modules.map(m => <Button key={m.to} variant="ghost" className={navClass(pathname === m.to)} asChild disabled={!activeOrgId}><Link to={m.to} search={{ org: activeOrgId ?? '' }}><m.icon/>{m.label}</Link></Button>)}
      <Button variant="ghost" className={navClass(pathname === '/extension-connect')} asChild><Link to="/extension-connect" search={{ requested: false, redirect: null, state: null }}><Puzzle/>Browser capture</Link></Button>
    </nav>
    {sidebarExtra}
    <div className="mt-6 border-t pt-4"><Button variant="ghost" className="w-full justify-start text-muted-foreground" asChild><Link to="/onboarding"><Plus/>New organization</Link></Button></div>
    <div className="sidebar-bottom"><div className="mb-5 flex items-center gap-2 text-xs text-primary"><ShieldCheck className="size-4"/>Secure workspace</div><div className="flex min-w-0 items-center gap-3 border-t pt-5"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary">{(displayName || user.email || 'W').slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{displayName || 'Your account'}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div><Button title="Sign out" aria-label="Sign out" variant="ghost" size="icon" onClick={signOut}><LogOut/></Button></div></div>
  </aside>
  <div className="workspace-main"><header className="workspace-header"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu/></Button><span className="text-muted-foreground">{orgs.data?.find(o => o.id === activeOrgId)?.name ?? 'Workspace'}</span><span className="text-border">/</span><span>{title}</span></div><span className="flex items-center gap-2 text-xs text-muted-foreground"><Globe2 className="size-3.5"/>Weorex</span></header>{children}</div>
  </div>
}
