import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "secondary" | "accent" | "success";
  amharic?: boolean;
}

const tones = {
  primary: "bg-primary-gradient text-primary-foreground",
  secondary: "bg-electric-gradient text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success text-success-foreground",
};

export const StatCard = ({ icon: Icon, label, value, hint, tone = "primary", amharic }: Props) => (
  <div className="rounded-2xl border border-border bg-card-gradient p-6 shadow-card hover:shadow-elegant transition-smooth">
    <div className="flex items-start justify-between">
      <div className={cn("text-sm font-medium text-muted-foreground", amharic && "font-ethiopic")}>{label}</div>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shadow-elegant", tones[tone])}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    {hint && <div className={cn("mt-1 text-xs text-muted-foreground", amharic && "font-ethiopic")}>{hint}</div>}
  </div>
);