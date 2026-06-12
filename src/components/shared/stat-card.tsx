import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; label: string };
  icon: LucideIcon;
  iconClassName?: string;
  description?: string;
}

export function StatCard({ title, value, change, icon: Icon, iconClassName, description }: StatCardProps) {
  const isPositive = change && change.value >= 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {change && (
              <p className={cn("text-xs font-medium", isPositive ? "text-green-600" : "text-red-600")}>
                {isPositive ? "+" : ""}{change.value.toFixed(1)}% {change.label}
              </p>
            )}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10", iconClassName)}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
