import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import Navbar from "./components/Navbar";
import "./index.css";
import { Loader2 } from "lucide-react";
import { useUser } from "./hooks/use-user";
import AuthPage from "./pages/AuthPage";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "./pages/Dashboard";
import Schedules from "./pages/Schedules";
import Analytics from "./pages/Analytics";
import ScheduleStatsPage from "./pages/ScheduleStatsPage";
import TrainsPage from "./pages/TrainsPage";
import TrainRoutesPage from "./pages/TrainRoutesPage";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }
  
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/trains" component={TrainsPage} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/routes" component={TrainRoutesPage} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/statistics" component={ScheduleStatsPage} />
        <Route>404 Page Not Found</Route>
      </Switch>
    </Layout>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
