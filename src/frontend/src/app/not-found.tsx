import Link from 'next/link';
import { Wrench, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-50">
      <header className="pt-safe">
        <div className="mx-auto flex h-14 max-w-md items-center px-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2.5" aria-label="BroCo Mod home">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-600 text-white shadow-md shadow-electric-600/30">
              <Wrench className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight text-navy-900 sm:text-lg">
              BroCo<span className="font-light text-electric-600"> Mod</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="pb-safe flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-semibold text-electric-600">Error 404</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">
            We couldn&apos;t find that page
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-navy-500">
            The link may be old or mistyped. Head back home, or sign in to see your bookings.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-electric-600 px-6 text-base font-semibold text-white shadow-sm shadow-electric-600/20 transition hover:bg-electric-700 sm:w-auto"
            >
              <ArrowLeft className="h-5 w-5" /> Back to home
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-surface-300 bg-white px-6 text-base font-semibold text-navy-800 transition hover:border-surface-400 hover:bg-surface-50 sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
