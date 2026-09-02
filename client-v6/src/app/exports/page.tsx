"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createExport, getLeadFieldMeta } from "@/lib/api";
import type { AdvancedFilter, FilterOperator } from "@/types/api";
import { FILTER_OPERATORS } from "@/types/api";
import { downloadBlob, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

export default function ExportsPage() {
  const [search, setSearch] = useState("");
  const [hasEmail, setHasEmail] = useState<boolean | undefined>();
  const [hasPhone, setHasPhone] = useState<boolean | undefined>();
  const [hasLinkedIn, setHasLinkedIn] = useState<boolean | undefined>();
  const [filters, setFilters] = useState<AdvancedFilter[]>([]);
  const [limit, setLimit] = useState(10000);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const [newField, setNewField] = useState("");
  const [newOp, setNewOp] = useState<FilterOperator>("contains");
  const [newValue, setNewValue] = useState("");

  const { data: fieldMeta } = useQuery({
    queryKey: ["lead-field-meta"],
    queryFn: getLeadFieldMeta,
  });

  const fieldNames = fieldMeta?.map((f) => f.name) ?? [];

  const exportMutation = useMutation({
    mutationFn: () =>
      createExport({
        search: search || undefined,
        filters: filters.length ? filters : undefined,
        hasEmail,
        hasPhone,
        hasLinkedIn,
        limit,
        columns: selectedColumns.length ? selectedColumns : undefined,
        sortBy,
        sortOrder,
      }),
    onSuccess: ({ blob, rowCount }) => {
      downloadBlob(blob, `leads-export-${Date.now()}.csv`);
      toast.success(`Exported ${formatNumber(rowCount)} rows`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFilter = () => {
    if (!newField) return;
    const needsValue = !["isNull", "isNotNull"].includes(newOp);
    if (needsValue && !newValue.trim()) return;
    setFilters((prev) => [
      ...prev,
      {
        field: newField,
        op: newOp,
        value: needsValue
          ? newOp === "in" || newOp === "notIn"
            ? newValue.split(",").map((s) => s.trim())
            : newValue
          : undefined,
      },
    ]);
    setNewField("");
    setNewValue("");
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Export
        </h1>
        <p className="mt-1 text-muted-foreground">
          Download filtered leads as CSV. Max 100,000 rows per export.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>
                Narrow down which leads to include in the export
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search all fields..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={hasEmail === true}
                    onCheckedChange={(c) =>
                      setHasEmail(c === true ? true : undefined)
                    }
                  />
                  Has email
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={hasPhone === true}
                    onCheckedChange={(c) =>
                      setHasPhone(c === true ? true : undefined)
                    }
                  />
                  Has phone
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={hasLinkedIn === true}
                    onCheckedChange={(c) =>
                      setHasLinkedIn(c === true ? true : undefined)
                    }
                  />
                  Has LinkedIn
                </label>
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-sm">Advanced filters</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Select value={newField} onValueChange={setNewField}>
                    <SelectTrigger className="sm:flex-1">
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldNames.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newOp}
                    onValueChange={(v) => setNewOp(v as FilterOperator)}
                  >
                    <SelectTrigger className="sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!["isNull", "isNotNull"].includes(newOp) && (
                    <Input
                      className="sm:flex-1"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Value"
                    />
                  )}
                  <Button size="sm" onClick={addFilter}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {filters.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {filters.map((f, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="gap-1 pr-1 font-normal"
                      >
                        {f.field} {f.op}{" "}
                        {f.value != null
                          ? Array.isArray(f.value)
                            ? f.value.join(",")
                            : String(f.value)
                          : ""}
                        <button
                          type="button"
                          onClick={() =>
                            setFilters((prev) =>
                              prev.filter((_, idx) => idx !== i),
                            )
                          }
                          className="ml-1 rounded-full p-0.5 hover:bg-muted"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Columns & sort</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Columns to include{" "}
                  <span className="text-muted-foreground font-normal">
                    (empty = all)
                  </span>
                </Label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-lg border p-3">
                  {fieldNames.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Load leads first to see available columns
                    </p>
                  )}
                  {fieldNames.map((f) => (
                    <label
                      key={f}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <Checkbox
                        checked={selectedColumns.includes(f)}
                        onCheckedChange={() => toggleColumn(f)}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <Label>Sort by</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt">Created</SelectItem>
                      <SelectItem value="updatedAt">Updated</SelectItem>
                      {fieldNames.slice(0, 10).map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Order</Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(v: "asc" | "desc") => setSortOrder(v)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Desc</SelectItem>
                      <SelectItem value="asc">Asc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Row limit</Label>
                  <Select
                    value={String(limit)}
                    onValueChange={(v) => setLimit(Number(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1,000</SelectItem>
                      <SelectItem value="5000">5,000</SelectItem>
                      <SelectItem value="10000">10,000</SelectItem>
                      <SelectItem value="50000">50,000</SelectItem>
                      <SelectItem value="100000">100,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-lg">Ready to export</CardTitle>
              <CardDescription>
                Downloads a CSV file with your current filter settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  Search: {search || "—"}
                </li>
                <li>Filters: {filters.length}</li>
                <li>
                  Columns:{" "}
                  {selectedColumns.length
                    ? selectedColumns.length
                    : "all"}
                </li>
                <li>Limit: {formatNumber(limit)}</li>
              </ul>
              <Button
                className="w-full"
                size="lg"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download CSV
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
