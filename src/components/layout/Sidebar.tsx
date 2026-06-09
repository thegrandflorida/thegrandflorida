'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard, Map, Search, Heart, Bell,
  Mail, Settings, ShieldCheck, ChevronRight,
  Building2, LogOut,
} from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/map',       label: 'Map View',     icon: Map },
  { href: '/search',    label: 'Search',       icon: Search },
  { href: '/favorites', label: 'Favorites',    icon: Heart },
  { href: '/reports',   label: 'Reports',      icon: Mail },
  { href: '/settings',  label: 'Settings',     icon: Settings },
]

const COUNTY_SHORTCUTS = [
  { label: 'Broward',      county: 'Broward' },
  { label: 'Palm Beach',   county: 'Palm Beach' },
  { label: 'Martin',       county: 'Martin' },
  { label: 'St. Lucie',    county: 'St. Lucie' },
  { label: 'Indian River', county: 'Indian River' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-100 leading-tight">Florida Builder</p>
            <p className="text-[10px] text-teal-400 leading-tight">Deal Finder</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-teal-500/10 text-teal-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {/* County shortcuts */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Counties
          </p>
          {COUNTY_SHORTCUTS.map(({ label, county }) => (
            <Link
              key={county}
              href={`/search?counties=${encodeURIComponent(county)}`}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              {label}
              <ChevronRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-slate-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
