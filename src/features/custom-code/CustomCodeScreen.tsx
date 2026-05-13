"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/stores/app-store";

export function CustomCodeScreen() {
  const router = useRouter();
  const persistence = useAppStore((state) => state.persistence);
  const importCustomCodePackage = useAppStore(
    (state) => state.importCustomCodePackage,
  );

  const [importText, setImportText] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function handleImportPackage() {
    setIsBusy(true);
    const imported = await importCustomCodePackage(importText);
    setIsBusy(false);

    if (imported) {
      router.push("/run");
    }
  }

  return (
    <main className="vn-page">
      <div className="vn-page-inner vn-fade-in">
        <div className="flex justify-end">
          <Link href="/" className="vn-btn">
            Back Home
          </Link>
        </div>

        <section className="panel rounded-[24px] p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                Import
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                Continue from code
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
                Get a code from Load Game with Export Code, then paste it here.
                Long codes may include local image data.
              </p>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Paste AIVN-PKG-v1 package here"
              className="min-h-56 w-full rounded-[18px] border border-white/10 bg-black/22 px-4 py-3 font-mono text-xs leading-5 text-white outline-none placeholder:text-white/30 focus:border-[rgba(217,181,109,0.45)]"
            />
            <div>
              <button
                type="button"
                disabled={isBusy || importText.trim().length === 0}
                onClick={() => {
                  void handleImportPackage();
                }}
                className="vn-btn vn-btn-primary"
              >
                {isBusy ? "Importing" : "Import and play"}
              </button>
            </div>
          </div>
        </section>

        {persistence.lastError ? (
          <p className="text-sm text-[var(--accent)]">{persistence.lastError}</p>
        ) : null}
      </div>
    </main>
  );
}
