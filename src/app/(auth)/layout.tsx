export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
