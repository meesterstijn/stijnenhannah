import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Occupies the topbar's right-hand slot without covering the back button. */
export function GnV2HomeLink() {
  const { isOwner } = useAuth();
  return isOwner ? (
    <Link
      to="/"
      className="gnv2-nav-btn"
      aria-label="Ons Huisje"
      title="Ons Huisje"
    >
      <Home className="h-[18px] w-[18px]" />
    </Link>
  ) : (
    <div className="gnv2-topbar-spacer" aria-hidden />
  );
}
