import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/app/theme";
import { App } from "@/app/App";
import { DialogsProvider } from "@/app/dialogs";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <DialogsProvider>
      <TooltipProvider delayDuration={300}>
        <App />
      </TooltipProvider>
      <Toaster position="top-center" />
    </DialogsProvider>
  </ThemeProvider>,
);
