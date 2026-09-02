"use client";

import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  listImports,
  previewImport,
  createImport,
  getImport,
} from "@/lib/api";
import type {
  PreviewImportResponse,
  ImportResponse,
} from "@/types/api";
import { formatDate, formatNumber, getStatusColor, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function ImportsPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewImportResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"idle" | "preview" | "importing">("idle");
  const [dragOver, setDragOver] = useState(false);

  const { data: imports, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["imports"],
    queryFn: listImports,
    refetchInterval: (query) => {
      const list = query.state.data;
      if (
        list?.some(
          (i) => i.status === "PENDING" || i.status === "PROCESSING",
        )
      ) {
        return 3000;
      }
      return false;
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewImport,
    onSuccess: (data) => {
      setPreview(data);
      // Auto-map common headers
      const auto: Record<string, string> = {};
      const identity = ["email", "phone", "linkedin", "website"];
      data.headers.forEach((h) => {
        const lower = h.toLowerCase().replace(/[\s_-]/g, "");
        if (lower.includes("email") || lower === "mail") auto[h] = "email";
        else if (lower.includes("phone") || lower.includes("mobile") || lower.includes("tel"))
          auto[h] = "phone";
        else if (lower.includes("linkedin") || lower.includes("liurl"))
          auto[h] = "linkedin";
        else if (lower.includes("website") || lower.includes("url") || lower.includes("domain"))
          auto[h] = "website";
      });
      setMapping(auto);
      setStep("preview");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("No file");
      if (!Object.keys(mapping).length) {
        throw new Error(
          "Select at least one CSV field to normalize (email, phone, linkedin, or website).",
        );
      }
      // Backend derives duplicate strategy from mapped identity fields.
      return createImport(file, mapping);
    },
    onSuccess: (res) => {
      toast.success(res.message || "Import started");
      setStep("idle");
      setFile(null);
      setPreview(null);
      setMapping({});
      queryClient.invalidateQueries({ queryKey: ["imports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
        setFile(f);
        previewMutation.mutate(f);
      } else {
        toast.error("Please drop a CSV file");
      }
    },
    [previewMutation],
  );

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      previewMutation.mutate(f);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case "FAILED":
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "PROCESSING":
        return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Imports
          </h1>
          <p className="mt-1 text-muted-foreground">
            Upload CSV files and map columns to identity fields
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload CSV</CardTitle>
          <CardDescription>
            Any CSV shape is supported. Map headers to email, phone, LinkedIn,
            or website for deduplication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
            )}
          >
            <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">
              Drag & drop a CSV file here
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              or click to browse
            </p>
            <label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={onFileSelect}
              />
              <Button variant="secondary" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4" />
                  Choose file
                </span>
              </Button>
            </label>
            {previewMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview & mapping dialog */}
      <Dialog
        open={step === "preview" && !!preview}
        onOpenChange={(o) => {
          if (!o) {
            setStep("idle");
            setPreview(null);
            setFile(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview import</DialogTitle>
            <DialogDescription>
              {file?.name} · ~{formatNumber(preview?.estimatedRows ?? 0)} rows ·{" "}
              {preview?.headers.length} columns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Duplicate detection</Label>
              <p className="text-sm text-muted-foreground">
                Deduplication uses the identity fields you map below (email,
                phone, LinkedIn, website). Rows that match an existing lead on
                any mapped identity are skipped as duplicates.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Column mapping (identity fields)</Label>
              <div className="rounded-lg border divide-y">
                {preview?.headers.map((header) => (
                  <div
                    key={header}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center"
                  >
                    <span className="text-sm font-medium sm:w-1/3 truncate">
                      {header}
                    </span>
                    <Select
                      value={mapping[header] || "_none"}
                      onValueChange={(v) =>
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === "_none") delete next[header];
                          else next[header] = v;
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="sm:w-48">
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Not mapped</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {preview?.sampleRows && preview.sampleRows.length > 0 && (
              <div className="space-y-2">
                <Label>Sample rows</Label>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.headers.slice(0, 6).map((h) => (
                          <TableHead key={h} className="text-xs">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sampleRows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {preview.headers.slice(0, 6).map((h) => (
                            <TableCell
                              key={h}
                              className="max-w-[140px] truncate text-xs"
                            >
                              {String(row[h] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStep("idle");
                setPreview(null);
                setFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={
                importMutation.isPending || Object.keys(mapping).length === 0
              }
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                "Start import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Import history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Inserted</TableHead>
                  <TableHead className="text-right">Duplicates</TableHead>
                  <TableHead className="text-right">Invalid</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!isLoading && (!imports || imports.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No imports yet. Upload a CSV to get started.
                    </TableCell>
                  </TableRow>
                )}
                {imports?.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {imp.originalFilename}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(imp.status)}
                        <Badge
                          className={cn(
                            "font-normal",
                            getStatusColor(imp.status),
                          )}
                          variant="outline"
                        >
                          {imp.status}
                        </Badge>
                      </div>
                      {(imp.status === "PROCESSING" ||
                        imp.status === "PENDING") &&
                        imp.totalRows > 0 && (
                          <div className="mt-1.5 w-32">
                            <ProgressBar
                              value={
                                (imp.processedRows / imp.totalRows) * 100
                              }
                            />
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {imp.processedRows}/{imp.totalRows}
                            </p>
                          </div>
                        )}
                      {imp.errorMessage && (
                        <p className="mt-1 text-xs text-destructive max-w-[200px] truncate">
                          {imp.errorMessage}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(imp.totalRows)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatNumber(imp.insertedRows)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
                      {formatNumber(imp.duplicateRows)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(imp.invalidRows)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(imp.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
