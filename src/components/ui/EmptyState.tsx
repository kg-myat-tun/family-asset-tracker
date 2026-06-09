import Link from "next/link";

interface Props {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-dashed border-line">
      <p className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-soft text-4xl mb-4">
        {icon}
      </p>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted mb-6 max-w-xs">{description}</p>
      {action && (
        <Link href={action.href} className="btn-primary">
          {action.label}
        </Link>
      )}
    </div>
  );
}
