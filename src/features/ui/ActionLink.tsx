import Link from "next/link";

type ActionLinkProps = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

export function ActionLink({
  href,
  label,
  tone = "secondary",
}: ActionLinkProps) {
  const className =
    tone === "primary"
      ? "vn-button vn-button-primary"
      : "vn-button";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
