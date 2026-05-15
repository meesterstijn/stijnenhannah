import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, ShoppingBasket, BookHeart, NotebookPen, ListTodo } from "lucide-react";

const nav = [
  { to: "/boodschappen", label: "Boodschappen", icon: ShoppingBasket },
  { to: "/recepten", label: "Recepten", icon: BookHeart },
  { to: "/notities", label: "Notities", icon: NotebookPen },
  { to: "/todo", label: "To-do", icon: ListTodo },
] as const;

export function SiteLayout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 backdrop-blur-sm bg-background/70 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <Home className="h-5 w-5" />
            <span className="font-serif text-xl font-semibold tracking-tight">Ons Huisje</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <Outlet />
      </main>

    </div>
  );
}
