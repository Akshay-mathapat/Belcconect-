export const AvatarCircle = ({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) => {
  const s = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm";
  return (
    <div className={`${s} rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
};
