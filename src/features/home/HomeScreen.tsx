"use client";

import Link from "next/link";

import type { ProviderRuntimeStatus } from "@/features/run/providers/providerRuntimeConfig";

type MenuEntry = {
  href: string;
  label: string;
  sub: string;
};

const menu: MenuEntry[] = [
  { href: "/new-game", label: "New Game", sub: "Choose a play mode" },
  { href: "/load", label: "Load Game", sub: "Continue a checkpoint" },
  { href: "/custom-code", label: "Custom Code", sub: "PLAY FROM OTHER'S STORY" },
  { href: "/settings", label: "Settings", sub: "" },
];

export function HomeScreen({
  providerStatus: _providerStatus,
}: {
  providerStatus: ProviderRuntimeStatus;
}) {
  void _providerStatus;

  return (
    <main className="vn-title-screen">
      <div className="vn-title-orb" aria-hidden="true" />
      <div className="vn-title-inner">
        <div className="vn-title-body vn-fade-in">
          <div>
            <p className="vn-title-sub">A New Kind of Visual Novel</p>
            <h1 className="vn-title-word mt-3">Afterimage</h1>
          </div>

          <nav className="vn-title-menu" aria-label="Title menu">
            {menu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="vn-title-menu-item"
              >
                <span className="vn-title-menu-copy">
                  <span className="vn-title-menu-label">{item.label}</span>
                  {item.sub ? (
                    <span className="vn-title-menu-sub">{item.sub}</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
