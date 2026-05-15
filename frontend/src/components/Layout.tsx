import type { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Тренажёр переговорного английского</div>
          <h1>Тренируйте деловые переговоры с мгновенной обратной связью</h1>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
