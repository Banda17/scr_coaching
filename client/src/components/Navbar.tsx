import { Link, useLocation } from "wouter";
import { Home, Calendar, BarChart, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useUser();
  const { toast } = useToast();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/trains", label: "Trains", icon: Calendar },
    { href: "/schedules", label: "Schedules", icon: Calendar },
    { href: "/routes", label: "Routes", icon: Calendar },
    { href: "/statistics", label: "Statistics", icon: BarChart },
    { href: "/analytics", label: "Analytics", icon: BarChart },
    { href: "/register-user", label: "Register User", icon: User, adminOnly: true },
    { href: "/locations", label: "Locations", icon: User, adminOnly: true },
  ];

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-6 md:gap-10">
            {navItems
              .filter(item => !item.adminOnly || user?.role === 'admin')
              .map(({ href, label, icon: Icon }) => (
              <Link 
                key={href} 
                href={href}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                  location === href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                role="link"
                aria-current={location === href ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline-block">{label}</span>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.username}</span>
              <span className="px-2 py-1 text-xs rounded-full bg-primary/10">
                {user?.role}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                toast({
                  title: "Logged out",
                  description: "Successfully logged out"
                });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
