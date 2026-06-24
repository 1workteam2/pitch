interface StubTabProps {
  icon: string;
  label: string;
  persona: string;
  quote: string;
  color?: string;
}

export default function StubTab({ icon, label, persona, quote, color = 'text-primary' }: StubTabProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center max-w-lg mx-auto">
      <div className="text-4xl mb-4">{icon}</div>
      <h2 className={`text-xl font-bold mb-2 ${color}`}>{label}</h2>
      <p className="text-xs text-muted-foreground italic leading-relaxed mb-6">
        "{quote}"
        <br />
        <span className="not-italic font-semibold text-foreground/60 mt-1 block">— {persona}</span>
      </p>
      <div className="text-xs text-muted-foreground bg-secondary px-4 py-2 rounded-full">
        Coming soon · Building now
      </div>
    </div>
  );
}
