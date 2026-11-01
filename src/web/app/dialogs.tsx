import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AskOpts = {
  title: string;
  label: string;
  initial?: string;
  confirmText?: string;
  /** Accept an empty value (submits ""). */
  allowEmpty?: boolean;
  /** Return an error message to block submit, or null when valid. */
  validate?: (value: string) => string | null;
};
type ConfirmOpts = {
  title: string;
  description?: string;
  confirmText?: string;
  destructive?: boolean;
};

type Dialogs = {
  ask: (o: AskOpts) => Promise<string | null>;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
};
const Ctx = createContext<Dialogs | null>(null);

export const useDialogs = () => {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDialogs outside DialogsProvider");
  return d;
};

/** Promise-based replacements for window.prompt / window.confirm. */
export function DialogsProvider({ children }: { children: ReactNode }) {
  const [askState, setAsk] = useState<{ o: AskOpts; value: string; error: string } | null>(null);
  const [confirmState, setConfirm] = useState<ConfirmOpts | null>(null);
  const askDone = useRef<(v: string | null) => void>(() => {});
  const confirmDone = useRef<(v: boolean) => void>(() => {});

  const ask = useCallback(
    (o: AskOpts) =>
      new Promise<string | null>((resolve) => {
        askDone.current = resolve;
        setAsk({ o, value: o.initial ?? "", error: "" });
      }),
    [],
  );
  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        confirmDone.current = resolve;
        setConfirm(o);
      }),
    [],
  );
  const api = useMemo(() => ({ ask, confirm }), [ask, confirm]);

  const closeAsk = (v: string | null) => {
    askDone.current(v);
    setAsk(null);
  };
  const closeConfirm = (v: boolean) => {
    confirmDone.current(v);
    setConfirm(null);
  };

  const submit = () => {
    if (!askState) return;
    const value = askState.value.trim();
    const error = !value ? (askState.o.allowEmpty ? "" : "Wajib diisi") : (askState.o.validate?.(value) ?? "");
    if (error) return setAsk({ ...askState, error });
    closeAsk(value);
  };

  return (
    <Ctx.Provider value={api}>
      {children}

      <Dialog open={!!askState} onOpenChange={(open) => !open && closeAsk(null)}>
        <DialogContent className="sm:max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>{askState?.o.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="ask-input">{askState?.o.label}</Label>
              <Input
                id="ask-input"
                autoFocus
                value={askState?.value ?? ""}
                aria-invalid={!!askState?.error}
                onChange={(e) => askState && setAsk({ ...askState, value: e.target.value, error: "" })}
              />
              {askState?.error && <p className="text-destructive text-xs">{askState.error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closeAsk(null)}>
                Batal
              </Button>
              <Button type="submit">{askState?.o.confirmText ?? "OK"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmState} onOpenChange={(open) => !open && closeConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            {confirmState?.description && <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={cn(confirmState?.destructive && buttonVariants({ variant: "destructive" }))}
              onClick={() => closeConfirm(true)}
            >
              {confirmState?.confirmText ?? "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export const validateProjectId = (v: string) =>
  ID.test(v) ? null : "Hanya huruf, angka, - dan _ (maks 64, mulai dengan huruf/angka)";
