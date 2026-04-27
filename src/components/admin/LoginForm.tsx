import Link from "next/link";
import { Lock, AlertCircle } from "lucide-react";

interface Props {
  error?: boolean;
  notConfigured?: boolean;
}

export default function LoginForm({ error, notConfigured }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="text-xs text-slate-500 hover:text-slate-700 mb-6 inline-block"
        >
          ← Back to fillbuddy.org
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Lock size={18} className="text-amber-600" />
            </div>
            <h1 className="font-heading text-lg font-extrabold text-slate-900 tracking-tight">
              Analytics
            </h1>
          </div>
          <p className="text-sm text-slate-500 mb-5">
            Internal dashboard. Enter the admin token to continue.
          </p>

          {notConfigured ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[13px] mb-4">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">ANALYTICS_ADMIN_TOKEN is not set.</p>
                <p className="text-amber-700 mt-1">
                  Set it via <code className="bg-amber-100 px-1 rounded">wrangler secret put</code>{" "}
                  in production, or in <code className="bg-amber-100 px-1 rounded">.env.local</code>{" "}
                  for local dev.
                </p>
              </div>
            </div>
          ) : null}

          <form action="/admin/analytics/login" method="POST" className="space-y-3">
            <input
              type="password"
              name="token"
              placeholder="Admin token"
              autoComplete="current-password"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-sm"
              disabled={notConfigured}
              required
            />
            {error && !notConfigured && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
                <AlertCircle size={15} />
                Invalid token. Try again.
              </div>
            )}
            <button
              type="submit"
              disabled={notConfigured}
              className="w-full bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
