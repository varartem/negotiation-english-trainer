interface WelcomePageProps {
  onLogin?: () => void;
  onRegister?: () => void;
  onStart?: () => void;
}

export default function WelcomePage({ onLogin, onRegister, onStart }: WelcomePageProps) {
  return (
    <section className="welcome-page">
      <div className="welcome-content">
        <h1 className="welcome-title" aria-label="Практикуй переговорный английский эффективно">
          <span className="welcome-word">Практикуй</span>
          <span className="welcome-word welcome-word-accent">переговорный</span>
          <span className="welcome-word">английский</span>
          <span className="welcome-word">эффективно</span>
        </h1>
        {onStart ? (
          <button className="start-primary" type="button" onClick={onStart}>
            Начать тренировку
          </button>
        ) : (
          <div className="welcome-actions">
            <button className="start-primary" type="button" onClick={onLogin}>
              Войти
            </button>
            <button className="start-secondary" type="button" onClick={onRegister}>
              Зарегистрироваться
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
