import { coverGradient } from "@/lib/utils/colorHash";

export function BookCover({ novelId, title, className }: { novelId: string; title: string; className?: string }) {
  const [from, to] = coverGradient(novelId);
  return (
    <div
      className={`flex items-center justify-center rounded-md text-center text-xs font-semibold text-white/90 shadow-sm ${className ?? ""}`}
      style={{ background: `linear-gradient(155deg, ${from}, ${to})`, aspectRatio: "3 / 4.2" }}
    >
      <span className="line-clamp-4 px-2">{title}</span>
    </div>
  );
}
