import type { ReactNode } from "react";

import Link from "next/link";

type AppShellProps = {
  children: ReactNode;
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
};

export function AppShell({
  children,
  title,
  eyebrow,
  description,
  actions,
}: AppShellProps) {
  return (
    <div className="vn-screen">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="vn-chrome px-0">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="vn-brand">
              Afterimage
            </Link>
            <span className="hidden h-4 w-px bg-white/16 sm:block" />
            <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.22em] text-white/42 sm:block">
              {eyebrow}
            </span>
          </div>
          {actions ? (
            <div className="flex flex-wrap justify-end gap-2">{actions}</div>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col py-4 sm:py-6">
          <section className="mb-6 max-w-4xl sm:mb-8">
            <p className="vn-kicker">{eyebrow}</p>
            <h1 className="vn-heading mt-3">{title}</h1>
            <p className="vn-copy mt-4">{description}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
