export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold text-stone-900">{title}</h1>
        <p className="text-sm text-stone-600">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-6 text-sm text-stone-500">{message}</div>;
}

export function SectionGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">{children}</div>;
}
