import { AppShell } from "./AppShell";
import { ActionLink } from "./ActionLink";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <AppShell
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={<ActionLink href="/" label="Back Home" />}
    >
      <section className="vn-plate mt-auto rounded-[2rem] p-6 sm:p-8">
        <p className="vn-kicker text-[var(--accent-soft)]">Placeholder only</p>
        <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
          Shell is ready, logic is deferred.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-7 text-white/70">
          This entry point keeps the VN navigation frame available while its
          owning feature stays out of Stage A2.
        </p>
      </section>
    </AppShell>
  );
}
