"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Eye,
  Pencil,
  MoreHorizontal,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  listLeads,
  getLeadFieldMeta,
  deleteLead,
  bulkDeleteLeads,
  createExport,
  countLeads,
} from "@/lib/api";
import type { AdvancedFilter, FilterOperator, LeadResponse } from "@/types/api";
import { FILTER_OPERATORS } from "@/types/api";
import { formatDate, formatNumber, downloadBlob, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import { LeadEditDialog } from "@/components/leads/lead-edit-dialog";

const PAGE_SIZE = 50;

export default function LeadsPage() {
  const queryClient = useQueryClient();

  // Filters state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasEmail, setHasEmail] = useState<boolean | undefined>();
  const [hasPhone, setHasPhone] = useState<boolean | undefined>();
  const [hasLinkedIn, setHasLinkedIn] = useState<boolean | undefined>();
  const [filters, setFilters] = useState<AdvancedFilter[]>([]);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState<string | undefined>();
  const [useCursor, setUseCursor] = useState(false);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<LeadResponse | null>(null);
  const [editLead, setEditLead] = useState<LeadResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // New filter form
  const [newFilterField, setNewFilterField] = useState("");
  const [newFilterOp, setNewFilterOp] = useState<FilterOperator>("contains");
  const [newFilterValue, setNewFilterValue] = useState("");

  // Debounce search
  const debounceSearch = useCallback((value: string) => {
    setSearch(value);
    const t = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
      setCursor(undefined);
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const listParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      filters: filters.length ? JSON.stringify(filters) : undefined,
      hasEmail,
      hasPhone,
      hasLinkedIn,
      sortBy: sortBy || undefined,
      sortOrder,
      limit: PAGE_SIZE,
      ...(useCursor
        ? { cursor, includeTotal: true }
        : { page }),
    }),
    [
      debouncedSearch,
      filters,
      hasEmail,
      hasPhone,
      hasLinkedIn,
      sortBy,
      sortOrder,
      page,
      cursor,
      useCursor,
    ],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["leads", listParams],
    queryFn: () => listLeads(listParams),
  });

  const { data: fieldMeta } = useQuery({
    queryKey: ["lead-field-meta"],
    queryFn: getLeadFieldMeta,
  });

  const fieldNames = useMemo(
    () => fieldMeta?.map((f) => f.name) ?? [],
    [fieldMeta],
  );

  // Derive dynamic columns from first page of data
  const columns = useMemo(() => {
    if (!data?.data?.length) return ["email", "phone", "company", "name"];
    const keys = new Set<string>();
    data.data.slice(0, 20).forEach((lead) => {
      Object.keys(lead.data || {}).forEach((k) => keys.add(k));
    });
    // Prefer common identity fields first
    const preferred = [
      "email",
      "Email",
      "phone",
      "Phone",
      "name",
      "Name",
      "company",
      "Company",
      "linkedin",
      "LinkedIn",
      "website",
      "Website",
    ];
    const ordered = preferred.filter((p) => keys.has(p));
    keys.forEach((k) => {
      if (!ordered.includes(k)) ordered.push(k);
    });
    return ordered.slice(0, 8);
  }, [data]);

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      toast.success("Lead deleted");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteLeads,
    onSuccess: (res) => {
      toast.success(`Deleted ${res.deleted} leads`);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      createExport({
        search: debouncedSearch || undefined,
        filters: filters.length ? filters : undefined,
        hasEmail,
        hasPhone,
        hasLinkedIn,
        sortBy,
        sortOrder,
        limit: 100000,
        columns: columns.length ? columns : undefined,
      }),
    onSuccess: ({ blob, rowCount }) => {
      downloadBlob(blob, `leads-export-${Date.now()}.csv`);
      toast.success(`Exported ${formatNumber(rowCount)} rows`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFilter = () => {
    if (!newFilterField) return;
    const needsValue = !["isNull", "isNotNull"].includes(newFilterOp);
    if (needsValue && !newFilterValue.trim()) return;
    setFilters((prev) => [
      ...prev,
      {
        field: newFilterField,
        op: newFilterOp,
        value: needsValue
          ? newFilterOp === "in" || newFilterOp === "notIn"
            ? newFilterValue.split(",").map((s) => s.trim())
            : newFilterValue
          : undefined,
      },
    ]);
    setNewFilterField("");
    setNewFilterValue("");
    setPage(1);
    setCursor(undefined);
  };

  const removeFilter = (idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
    setPage(1);
    setCursor(undefined);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.data) return;
    if (selectedIds.size === data.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.data.map((l) => l.id)));
    }
  };

  const total = data?.total;
  const hasNext = data?.hasNextPage ?? false;
  const totalPages = data?.totalPages ?? (total ? Math.ceil(total / PAGE_SIZE) : undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Leads
          </h1>
          <p className="mt-1 text-muted-foreground">
            {total != null
              ? `${formatNumber(total)} leads`
              : "Browse and filter your lead database"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Search & quick filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search across all fields..."
                className="pl-9"
                value={search}
                onChange={(e) => debounceSearch(e.target.value)}
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              Advanced filters
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filters.length}
                </Badge>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hasEmail === true}
                onCheckedChange={(c) => {
                  setHasEmail(c === true ? true : undefined);
                  setPage(1);
                }}
              />
              Has email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hasPhone === true}
                onCheckedChange={(c) => {
                  setHasPhone(c === true ? true : undefined);
                  setPage(1);
                }}
              />
              Has phone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hasLinkedIn === true}
                onCheckedChange={(c) => {
                  setHasLinkedIn(c === true ? true : undefined);
                  setPage(1);
                }}
              />
              Has LinkedIn
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Sort</Label>
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  setSortBy(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created</SelectItem>
                  <SelectItem value="updatedAt">Updated</SelectItem>
                  {fieldNames.slice(0, 12).map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sortOrder}
                onValueChange={(v: "asc" | "desc") => setSortOrder(v)}
              >
                <SelectTrigger className="h-8 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Field</Label>
                  <Select
                    value={newFilterField}
                    onValueChange={setNewFilterField}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldNames.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                      {fieldNames.length === 0 &&
                        columns.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40 space-y-1">
                  <Label className="text-xs">Operator</Label>
                  <Select
                    value={newFilterOp}
                    onValueChange={(v) => setNewFilterOp(v as FilterOperator)}
                  >
                    <SelectTrigger>
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
                </div>
                {!["isNull", "isNotNull"].includes(newFilterOp) && (
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">
                      Value
                      {["in", "notIn"].includes(newFilterOp) &&
                        " (comma-separated)"}
                    </Label>
                    <Input
                      value={newFilterValue}
                      onChange={(e) => setNewFilterValue(e.target.value)}
                      placeholder="Value..."
                    />
                  </div>
                )}
                <Button onClick={addFilter} size="sm" className="shrink-0">
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {filters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filters.map((f, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 pr-1 font-normal"
                    >
                      <span className="font-medium">{f.field}</span>
                      <span className="text-muted-foreground">{f.op}</span>
                      {f.value != null && (
                        <span>
                          {Array.isArray(f.value)
                            ? f.value.join(", ")
                            : String(f.value)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFilter(i)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      setFilters([]);
                      setPage(1);
                    }}
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      data?.data?.length
                        ? selectedIds.size === data.data.length
                        : false
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="min-w-[120px]">
                    {col}
                  </TableHead>
                ))}
                <TableHead className="min-w-[140px]">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns.length + 3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && data?.data?.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + 3}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No leads found. Try adjusting filters or import a CSV.
                  </TableCell>
                </TableRow>
              )}
              {data?.data?.map((lead) => (
                <TableRow
                  key={lead.id}
                  data-state={selectedIds.has(lead.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      className="max-w-[200px] truncate"
                      title={String(lead.data?.[col] ?? "")}
                    >
                      {lead.data?.[col] ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailLead(lead)}>
                          <Eye className="h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditLead(lead)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(lead.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {data?.data
              ? `Showing ${data.data.length} leads`
              : "—"}
            {total != null && ` of ${formatNumber(total)}`}
          </p>
          <div className="flex items-center gap-2">
            {!useCursor && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-sm tabular-nums">
                  Page {page}
                  {totalPages != null && ` / ${totalPages}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !hasNext &&
                    (totalPages != null ? page >= totalPages : !data?.data?.length)
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {useCursor && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!cursor || isFetching}
                  onClick={() => setCursor(undefined)}
                >
                  First page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext || isFetching}
                  onClick={() => setCursor(data?.nextCursor ?? undefined)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      <LeadDetailDialog
        lead={detailLead}
        open={!!detailLead}
        onOpenChange={(o) => !o && setDetailLead(null)}
        onEdit={() => {
          setEditLead(detailLead);
          setDetailLead(null);
        }}
      />
      <LeadEditDialog
        lead={editLead}
        open={!!editLead}
        onOpenChange={(o) => !o && setEditLead(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          setEditLead(null);
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The lead will be permanently
              removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} leads?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Selected leads will be permanently deleted. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                // Bulk delete by filter isn't ideal for ID list;
                // delete one-by-one for selected, or use current filters
                // For selected IDs we loop
                Promise.all(
                  Array.from(selectedIds).map((id) => deleteLead(id)),
                ).then(() => {
                  toast.success(`Deleted ${selectedIds.size} leads`);
                  queryClient.invalidateQueries({ queryKey: ["leads"] });
                  queryClient.invalidateQueries({
                    queryKey: ["dashboard-stats"],
                  });
                  setSelectedIds(new Set());
                  setBulkDeleteOpen(false);
                });
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
