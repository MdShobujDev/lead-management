"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { matchAndEnrich } from "@/lib/api";
import { cn, downloadBlob, formatNumber } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  GitMerge,
  Loader2,
  Upload,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const BUILTIN_DB_FIELDS = ["email", "phone", "linkedin", "website"] as const;

export default function MatchingPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvMatchField, setCsvMatchField] = useState("");
  const [dbMatchField, setDbMatchField] = useState<string>("email");
  const [columnsToFill, setColumnsToFill] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    filledCells?: number;
  } | null>(null);

  const dbFieldOptions = BUILTIN_DB_FIELDS;

  const mutation = useMutation({
    mutationFn: () => {
      if (!file || !csvMatchField.trim())
        throw new Error("File and CSV field required");
      if (!dbMatchField.trim())
        throw new Error("Database match field required");
      const cols = columnsToFill
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return matchAndEnrich(
        file,
        csvMatchField.trim(),
        dbMatchField.trim(),
        cols.length ? cols : undefined,
      );
    },
    onSuccess: ({ blob, total, matched, unmatched, filledCells }) => {
      setResult({ total, matched, unmatched, filledCells });
      downloadBlob(blob, `matched-${Date.now()}.csv`);
      toast.success(
        `Matched ${formatNumber(matched)} of ${formatNumber(total)} rows`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
      setFile(f);
      setResult(null);
    } else {
      toast.error("Please drop a CSV file");
    }
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Match & Enrich
        </h1>
        <p className="mt-1 text-muted-foreground">
          Upload a CSV, match rows against your lead database, and download an
          enriched file
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitMerge className="h-5 w-5" />
              Matching setup
            </CardTitle>
            <CardDescription>
              Match a column from your CSV to a normalized identity field in the
              database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
              )}
            >
              <FileSpreadsheet className="mb-2 h-8 w-8 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium">Drop CSV here</p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse
                  </p>
                </>
              )}
              <label className="mt-3">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setResult(null);
                    }
                  }}
                />
                <Button variant="secondary" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4" />
                    {file ? "Change file" : "Choose file"}
                  </span>
                </Button>
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csvField">CSV match column name</Label>
              <Input
                id="csvField"
                placeholder="e.g. Email, email_address, Phone"
                value={csvMatchField}
                onChange={(e) => setCsvMatchField(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Exact header name from your CSV file
              </p>
            </div>

            <div className="space-y-2">
              <Label>Database match field</Label>
              <Select
                value={dbMatchField}
                onValueChange={(v) => setDbMatchField(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dbFieldOptions.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the normalized database field to match against
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="columnsToFill">Columns to fill (optional)</Label>
              <Input
                id="columnsToFill"
                placeholder="e.g. Company, Title, Phone"
                value={columnsToFill}
                onChange={(e) => setColumnsToFill(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated CSV columns to fill when empty. Leave blank to
                fill all empty cells from the matched lead.
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={
                !file ||
                !csvMatchField.trim() ||
                !dbMatchField.trim() ||
                mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Match & download enriched CSV
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal list-inside space-y-2">
              <li>Upload a CSV file that has at least one matchable column.</li>
              <li>
                Specify the exact CSV header name to match on (e.g.{" "}
                <code className="rounded bg-muted px-1">Email</code>).
              </li>
              <li>
                Choose the normalized database field to match against (email,
                phone, linkedin, or website).
              </li>
              <li>
                Optionally restrict which empty CSV columns are filled from the
                matched lead; otherwise all empty cells are enriched.
              </li>
              <li>
                Download an enriched CSV that preserves original column order,
                with match stats in response headers.
              </li>
            </ol>

            {result && (
              <div className="mt-6 rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="font-medium text-foreground">Last result</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(result.total)}
                    </p>
                    <p className="text-xs">Total rows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatNumber(result.matched)}
                    </p>
                    <p className="text-xs">Matched</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatNumber(result.unmatched)}
                    </p>
                    <p className="text-xs">Unmatched</p>
                  </div>
                </div>
                {result.filledCells != null && (
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    {formatNumber(result.filledCells)} cells filled
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
