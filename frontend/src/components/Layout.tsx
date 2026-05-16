import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">AI</span>
          <div>
            <h1>Negotiation English</h1>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
