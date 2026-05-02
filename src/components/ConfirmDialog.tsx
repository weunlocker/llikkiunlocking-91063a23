import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmTone = "default" | "danger" | "success" | "info" | "warning";

export type ConfirmOptions = {
  title?: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

type Ctx = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ctx | null>(null);

const toneIcon: Record<ConfirmTone, ReactNode> = {
  default: <Info className="w-5 h-5 text-primary" />,
  danger: <XCircle className="w-5 h-5 text-destructive" />,
  success: <CheckCircle2 className="w-5 h-5 text-success" />,
  info: <Info className="w-5 h-5 text-primary" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning" />,
};

const toneBtn: Record<ConfirmTone, string> = {
  default: "",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  info: "",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
};

type State = ConfirmOptions & { open: boolean; resolve?: (v: boolean) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ open: false });

  const confirm = useCallback<Ctx>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, ...opts, resolve });
    });
  }, []);

  const handle = (value: boolean) => {
    state.resolve?.(value);
    setState((s) => ({ ...s, open: false }));
  };

  const tone = state.tone ?? "default";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(o) => !o && handle(false)}>
        <AlertDialogContent className="glass border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {toneIcon[tone]}
              {state.title ?? "Are you sure?"}
            </AlertDialogTitle>
            {state.description && (
              <AlertDialogDescription className="text-muted-foreground pt-1">
                {state.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handle(false)}>{state.cancelText ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction className={cn(toneBtn[tone])} onClick={() => handle(true)}>
              {state.confirmText ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
