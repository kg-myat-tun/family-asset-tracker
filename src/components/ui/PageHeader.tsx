import Link from "next/link";

interface Props {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="btn-primary shrink-0">
          {action.label}
        </Link>
      )}
    </div>
  );
}
