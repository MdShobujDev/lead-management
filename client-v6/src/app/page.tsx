"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Upload,
  CheckCircle2,
  Loader2,
  XCircle,
  Database,
} from "lucide-react";
import { getDashboardStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your leads and import activity
        </p>
      </div>

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load stats: {(error as Error).message}. Make sure the
              API is running at{" "}
              <code className="rounded bg-muted px-1">
                {process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}
              </code>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={data?.leads.total}
          icon={Users}
          loading={isLoading}
          href="/leads"
        />
        <StatCard
          title="Total Imports"
          value={data?.imports.total}
          icon={Upload}
          loading={isLoading}
          href="/imports"
        />
        <StatCard
          title="Completed"
          value={data?.imports.completed}
          icon={CheckCircle2}
          loading={isLoading}
          href="/imports"
          accent="success"
        />
        <StatCard
          title="Processing / Failed"
          value={
            data
              ? (data.imports.processing || 0) + (data.imports.failed || 0)
              : undefined
          }
          icon={data?.imports.failed ? XCircle : Loader2}
          loading={isLoading}
          href="/imports"
          accent={data?.imports.failed ? "destructive" : "warning"}
          subtitle={
            data
              ? `${data.imports.processing} processing · ${data.imports.failed} failed`
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Quick actions
            </CardTitle>
            <CardDescription>
              Common workflows to manage your lead database
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/imports">Import CSV</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/leads">Browse leads</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/exports">Export leads</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/matching">Match & enrich</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API status</CardTitle>
            <CardDescription>
              Backend connection and feature readiness
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API URL</span>
              <code className="rounded bg-muted px-2 py-0.5 text-xs">
                {process.env.NEXT_PUBLIC_API_URL ||
                  "http://localhost:4000/api"}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stats endpoint</span>
              {isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : isError ? (
                <span className="text-destructive">Offline</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Online
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  href,
  accent,
  subtitle,
}: {
  title: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  href?: string;
  accent?: "success" | "warning" | "destructive";
  subtitle?: string;
}) {
  const content = (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-4 w-4",
            accent === "success" && "text-emerald-600",
            accent === "warning" && "text-amber-600",
            accent === "destructive" && "text-destructive",
            !accent && "text-muted-foreground",
          )}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">
            {formatNumber(value)}
          </div>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
