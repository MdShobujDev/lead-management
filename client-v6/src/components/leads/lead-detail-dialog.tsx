"use client";

import type { LeadResponse } from "@/types/api";
import { formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Props {
  lead: LeadResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  onEdit,
}: Props) {
  if (!lead) return null;

  const entries = Object.entries(lead.data || {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lead details</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6 max-h-[60vh]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">ID</p>
                <p className="font-mono text-xs break-all">{lead.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p>{formatDate(lead.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Updated</p>
                <p>{formatDate(lead.updatedAt)}</p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              {lead.emailNormalized && (
                <Badge variant="secondary">Email ✓</Badge>
              )}
              {lead.phoneNormalized && (
                <Badge variant="secondary">Phone ✓</Badge>
              )}
              {lead.linkedinNormalized && (
                <Badge variant="secondary">LinkedIn ✓</Badge>
              )}
              {lead.websiteNormalized && (
                <Badge variant="secondary">Website ✓</Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Data fields</p>
              <div className="rounded-lg border divide-y">
                {entries.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    No data fields
                  </p>
                )}
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-4"
                  >
                    <span className="text-xs font-medium text-muted-foreground sm:w-1/3 shrink-0">
                      {key}
                    </span>
                    <span className="text-sm break-all">
                      {value ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
