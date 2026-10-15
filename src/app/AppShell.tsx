import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Activity, Archive, CalendarDays, ChevronLeft, ChevronRight, CircleHelp, Command, LayoutDashboard, ListTodo, Menu, Moon, Plus, Search, Settings2, Shirt, StickyNote, Sun, Users } from 'lucide-react'
import { useShop } from '../stores/shop'
import QuickCreateDialog from '../features/capture/QuickCreateDialog'
import ConfirmDialogHost from '../components/ConfirmDialogHost'
import { GettingStartedDialog } from '../components/GettingStarted'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, short: 'Today' },
  { to: '/ongoing', label: 'Ongoing Teams', icon: Activity, short: 'Teams' },
  { to: '/orders', label: 'All Orders', icon: Shirt, short: 'Orders' },
  { to: '/tasks', label: 'My Tasks', icon: ListTodo, short: 'Tasks' },
  { to: '/production', label: 'Production Board', icon: Archive, short: 'Board' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, short: 'Calendar' },
  { to: '/notes', label: 'Notes', icon: StickyNote, short: 'Notes' },
  { to: '/completed', label: 'Completed', icon: Archive, short: 'Done' },
  { to: '/settings', label: 'Settings', icon: Settings2, short: 'Settings' },
  { to: '/teams', label: 'All Teams & Photos', icon: Users, short: 'Register' },
]

export default function AppShell({ children, status }: { children: ReactNode; status: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const { orders, tasks, notes, settings, setTheme } = useShop()
  const location = useLocation()
  const searchResults = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return []
    return [
      ...orders.filter(item => !item.archivedAt && `${item.customerName} ${item.reference} ${item.notes} ${item.labels.join(' ')}`.toLowerCase().includes(term)).slice(0, 5).map(item => ({ label: item.customerName, sub: `Order · ${item.reference || 'No reference'}`, to: `/orders/${item.id}` })),
      ...tasks.filter(item => !item.archivedAt && `${item.title} ${item.description} ${item.labels.join(' ')} ${item.comments.join(' ')}`.toLowerCase().includes(term)).slice(0, 4).map(item => ({ label: item.title, sub: 'Task', to: '/tasks' })),
      ...notes.filter(item => `${item.title} ${item.content} ${item.labels.join(' ')}`.toLowerCase().includes(term)).slice(0, 3).map(item => ({ label: item.title || 'Untitled note', sub: 'Note', to: '/notes' })),
    ].slice(0, 8)
  }, [search, orders, tasks, notes])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); window.setTimeout(() => document.getElementById('global-search')?.focus(), 10) }
      if (event.key === 'Escape') { setSearchOpen(false); setQuickOpen(false); setMobileMenu(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const active = navItems.find(item => location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to)))
  return <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <Link className="brand-lockup" to="/" aria-label="Gee Graphics dashboard">
        <span className="brand-mark"><span>G</span><i /><span>G</span></span>
        {!collapsed && <span className="brand-word"><strong>GEE</strong><small>GRAPHICS</small></span>}
      </Link>
      <div className="workspace-switch"><span className="workspace-dot">G</span>{!collapsed && <><span><strong>{settings?.shopName || 'Gee Graphics'}</strong><small>Production workspace</small></span><ChevronRight size={15} /></>}</div>
      {!collapsed && <div className="nav-label">WORKSPACE</div>}
      <nav className="side-nav" aria-label="Main navigation">
        {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenu(false)} title={collapsed ? label : undefined}><Icon size={17} strokeWidth={1.9} /><span>{label}</span>{to === '/tasks' && tasks.filter(task => !task.archivedAt && task.status === 'open').length > 0 && <em>{tasks.filter(task => !task.archivedAt && task.status === 'open').length}</em>}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><span className="tip-bar" />{!collapsed && <span>Keep every handoff moving.</span>}</div>
        <button className="collapse-button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Collapse menu</span></>}</button>
      </div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19} /></button>
        <div className="breadcrumbs"><span>Gee Graphics</span><ChevronRight size={13} /><strong>{active?.label || 'Workspace'}</strong></div>
        <div className="topbar-actions">
          <div className={`global-search-wrap ${searchOpen ? 'search-open' : ''}`}>
            <Search size={16} />
            <input id="global-search" aria-label="Search everything" value={search} onFocus={() => setSearchOpen(true)} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { setSearch(''); setSearchOpen(false) } }} placeholder="Search orders, tasks, notes..." />
            <kbd><Command size={11} /> K</kbd>
            {searchOpen && search.trim() && <div className="search-results">{searchResults.length ? searchResults.map((result, index) => <Link key={`${result.to}-${result.label}-${index}`} to={result.to} onClick={() => { setSearch(''); setSearchOpen(false) }}><Search size={14} /><span><strong>{result.label}</strong><small>{result.sub}</small></span><ChevronRight size={14} /></Link>) : <div className="search-empty">No matches found</div>}</div>}
          </div>
          <button className="guide-button" aria-label="Open the GEE TASKS guide" title="How to use GEE TASKS" onClick={() => setGuideOpen(true)}><CircleHelp size={16} /><span>Guide</span></button>
          <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => void setTheme(settings?.theme === 'dark' ? 'light' : 'dark')}>{settings?.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="top-new-button" onClick={() => setQuickOpen(true)}><Plus size={16} /> <span>New</span></button>
        </div>
      </header>
      <div className="sync-row">{status}</div>
      <main className="page-content" onClick={() => searchOpen && !search.trim() ? setSearchOpen(false) : undefined}>{children}</main>
    </div>

    {mobileMenu && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.slice(0, 2).map(({ to, label, short, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} aria-label={label} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}><Icon size={19} /><span>{short}</span></NavLink>)}
      <button className="mobile-add" aria-label="Create new item" onClick={() => setQuickOpen(true)}><Plus size={23} /></button>
      {navItems.slice(2, 4).map(({ to, short, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}><Icon size={19} /><span>{short}</span></NavLink>)}
    </nav>
    <QuickCreateDialog open={quickOpen} onOpenChange={setQuickOpen} />
    <GettingStartedDialog open={guideOpen} onOpenChange={setGuideOpen} />
    <ConfirmDialogHost />
  </div>
}
