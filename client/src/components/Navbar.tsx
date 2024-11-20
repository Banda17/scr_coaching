import { Link, useLocation } from "wouter";
import { Home, Calendar, BarChart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home },
    { href: "/schedules", label: "Schedules", icon: Calendar },
    { href: "/analytics", label: "Analytics", icon: BarChart },
  ];

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="flex flex-1 items-center justify-between">
          <div className="flex items-center gap-6 md:gap-10">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                    location === href
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline-block">{label}</span>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
