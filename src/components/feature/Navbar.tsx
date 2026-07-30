import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

interface NavbarProps {
  onToggleTheme?: () => void;
  theme?: "light" | "dark";
}

export default function Navbar({ onToggleTheme, theme = "light" }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "API Docs", href: "/docs" },
    { label: "Contact", href: "#contact" },
  ];

  const isHome = location.pathname === "/";
  const overHero = isHome && !isScrolled;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background-50/95 backdrop-blur-md border-b border-background-200/70 shadow-sm"
          : overHero
            ? "bg-transparent"
            : "bg-background-50/95 backdrop-blur-md border-b border-background-200/70 shadow-sm"
      }`}
    >
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-background-50 font-heading font-bold text-sm md:text-base">
                Ob
              </span>
            </div>
            <span
              className={`font-heading font-bold text-lg md:text-xl transition-colors duration-300 ${
                overHero ? "text-background-50" : "text-foreground-900"
              }`}
            >
              ObPay
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              isHome && link.href.startsWith("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  className={`text-sm font-medium transition-colors whitespace-nowrap ${
                    overHero
                      ? "text-background-50/80 hover:text-background-50"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-sm font-medium transition-colors whitespace-nowrap ${
                    overHero
                      ? "text-background-50/80 hover:text-background-50"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                overHero
                  ? "text-background-50/80 hover:text-background-50 hover:bg-background-50/10"
                  : "text-foreground-600 hover:text-foreground-900 hover:bg-background-200/70"
              }`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <i className="ri-sun-line text-lg" />
              ) : (
                <i className="ri-moon-line text-lg" />
              )}
            </button>

            <Link
              to="/login"
              className={`text-sm font-medium transition-colors whitespace-nowrap px-3 py-2 ${
                overHero
                  ? "text-background-50/90 hover:text-background-50"
                  : "text-foreground-700 hover:text-foreground-900"
              }`}
            >
              Log In
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium bg-primary-500 text-background-50 hover:bg-primary-600 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden w-9 h-9 flex items-center justify-center cursor-pointer ${
              overHero ? "text-background-50" : "text-foreground-700"
            }`}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <i className="ri-close-line text-xl" />
            ) : (
              <i className="ri-menu-line text-xl" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background-50/98 backdrop-blur-md border-b border-background-200/70">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) =>
              isHome && link.href.startsWith("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="block py-2.5 text-sm font-medium text-foreground-700 hover:text-foreground-900"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="block py-2.5 text-sm font-medium text-foreground-700 hover:text-foreground-900"
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="pt-3 border-t border-background-200/70 flex flex-col gap-2">
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-2 py-2.5 text-sm font-medium text-foreground-700 cursor-pointer"
              >
                {theme === "dark" ? (
                  <>
                    <i className="ri-sun-line" /> Light Mode
                  </>
                ) : (
                  <>
                    <i className="ri-moon-line" /> Dark Mode
                  </>
                )}
              </button>
              <Link
                to="/login"
                className="block py-2.5 text-sm font-medium text-foreground-700"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="block w-full text-center text-sm font-medium bg-primary-500 text-background-50 py-2.5 rounded-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}