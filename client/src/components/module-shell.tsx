export function ModuleShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--color-primary)" }}>{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ComingSoonList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="rounded-3xl p-4 surface-soft">
          <span className="text-sm">{item}</span>
        </div>
      ))}
    </div>
  );
}
