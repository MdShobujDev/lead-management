"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LeadResponse } from "@/types/api";
import { updateLead } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  lead: LeadResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function LeadEditDialog({ lead, open, onOpenChange, onSaved }: Props) {
  const { register, handleSubmit, reset } = useForm<Record<string, string>>();

  useEffect(() => {
    if (lead) {
      const defaults: Record<string, string> = {};
      Object.entries(lead.data || {}).forEach(([k, v]) => {
        defaults[k] = v ?? "";
      });
      reset(defaults);
    }
  }, [lead, reset]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, string>) => {
      if (!lead) throw new Error("No lead");
      // Convert empty strings to null for cleanliness
      const cleaned: Record<string, string | null> = {};
      Object.entries(data).forEach(([k, v]) => {
        cleaned[k] = v.trim() === "" ? null : v;
      });
      return updateLead(lead.id, cleaned);
    },
    onSuccess: () => {
      toast.success("Lead updated");
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!lead) return null;

  const fields = Object.keys(lead.data || {}).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>
            Update field values. Empty fields will be cleared.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="flex flex-col flex-1 min-h-0"
        >
          <ScrollArea className="flex-1 -mx-6 px-6 max-h-[55vh]">
            <div className="space-y-4 py-1">
              {fields.map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`edit-${field}`}>{field}</Label>
                  <Input
                    id={`edit-${field}`}
                    {...register(field)}
                    placeholder={field}
                  />
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No editable fields on this lead.
                </p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
