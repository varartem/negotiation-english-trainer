import { FormEvent, useState } from "react";
import { api } from "../api/client";
import type { AccountUser } from "../types";

interface AuthPageProps {
  mode: "login" | "register";
  onHome: () => void;
  onModeChange: (mode: "login" | "register") => void;
  onAuthenticated: (user: AccountUser) => void;
}

export default function AuthPage({ mode, onHome, onModeChange, onAuthenticated }: AuthPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const user = isRegister
        ? await api.register({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await api.login({
            email: email.trim(),
            password,
          });
      onAuthenticated(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <button className="auth-home-link" type="button" onClick={onHome}>
        <span className="sidebar-mark">N</span>
        <span>Negotiation English</span>
      </button>

      <section className="auth-panel" aria-label={isRegister ? "Регистрация" : "Авторизация"}>
        <div className="section-heading">
          <h1>{isRegister ? "Регистрация" : "Вход"}</h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <>
              <label className="field">
                <span>Имя</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span>Почта</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
            </>
          ) : (
            <label className="field">
              <span>Почта</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
          )}

          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>

          {error ? <p className="error-box">{error}</p> : null}

          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Сохраняю..." : isRegister ? "Создать аккаунт" : "Войти"}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() => onModeChange(isRegister ? "login" : "register")}
        >
          {isRegister ? "Уже есть аккаунт" : "Создать аккаунт"}
        </button>
      </section>
    </main>
  );
}
