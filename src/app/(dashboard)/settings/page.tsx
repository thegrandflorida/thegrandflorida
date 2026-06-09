'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { User } from '@/types/database'

const COUNTY_OPTIONS = ['Broward', 'Palm Beach', 'Martin', 'St. Lucie', 'Indian River']

type Tab = 'profile' | 'notifications' | 'scoring'

async function fetchProfile(): Promise<User> {
  const res = await fetch('/api/auth/profile')
  if (!res.ok) throw new Error('Failed to fetch profile')
  const json = await res.json()
  return json.data
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(false)
  const [preferredCounties, setPreferredCounties] = useState<string[]>([])

  useState(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setPhone(profile.phone ?? '')
      setCompany(profile.company ?? '')
      setEmailDigestEnabled(profile.notification_preferences?.email ?? false)
    }
  })

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const body =
        activeTab === 'profile'
          ? { full_name: fullName, phone, company }
          : { notification_preferences: { email: emailDigestEnabled }, preferred_counties: preferredCounties }

      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'scoring', label: 'Scoring' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account preferences.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-700/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-teal-400 border-teal-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {activeTab === 'profile' && (
          <>
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
            <Input
              label="Email"
              value={profile?.email ?? ''}
              readOnly
              disabled
              hint="Email cannot be changed."
            />
            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
            />
            <Input
              label="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={isLoading}
            />
          </>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Daily email digest</p>
                <p className="text-xs text-slate-400 mt-0.5">Receive a daily summary of top opportunities.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailDigestEnabled}
                onClick={() => setEmailDigestEnabled(!emailDigestEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  emailDigestEnabled ? 'bg-teal-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    emailDigestEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>

            <div>
              <p className="text-sm font-medium text-slate-200 mb-2">Preferred counties</p>
              <div className="space-y-2">
                {COUNTY_OPTIONS.map((county) => (
                  <label key={county} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferredCounties.includes(county)}
                      onChange={(e) => {
                        setPreferredCounties(
                          e.target.checked
                            ? [...preferredCounties, county]
                            : preferredCounties.filter((c) => c !== county)
                        )
                      }}
                      className="rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500/30"
                    />
                    <span className="text-sm text-slate-300">{county}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scoring' && (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">Scoring configuration coming soon.</p>
          </div>
        )}

        {activeTab !== 'scoring' && (
          <div className="flex items-center gap-3 pt-2">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save changes
            </Button>
            {saved && <span className="text-sm text-teal-400">Saved.</span>}
          </div>
        )}
      </div>
    </div>
  )
}
