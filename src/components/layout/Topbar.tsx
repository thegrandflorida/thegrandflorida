'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Bell, User, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useAlerts } from '@/hooks/useAlerts'

export function Topbar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const { unreadCount } = useAlerts()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?search=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <header className="h-14 shrink-0 flex items-center gap-4 px-6 border-b border-slate-800 bg-slate-900">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-lg">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by address, parcel ID, owner name…"
          icon={<Search className="w-3.5 h-3.5" />}
          className="h-8 text-xs"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        {/* Alerts bell */}
        <Link
          href="/settings"
          className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-500 ring-2 ring-slate-900" />
          )}
        </Link>

        {/* Profile */}
        <Link
          href="/settings"
          className="flex items-center gap-2 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
          <ChevronDown className="w-3 h-3" />
        </Link>
      </div>
    </header>
  )
}
