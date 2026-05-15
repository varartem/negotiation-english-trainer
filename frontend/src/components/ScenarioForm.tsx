import type { ScenarioPayload } from "../api/client";
import type { Difficulty } from "../types";

interface ScenarioFormProps {
  value: ScenarioPayload;
  onChange: (value: ScenarioPayload) => void;
  onSubmit: () => void;
  disabled: boolean;
}

const textFields: Array<{ key: keyof ScenarioPayload; label: string; multiline?: boolean }> = [
  { key: "company_name", label: "Компания" },
  { key: "company_description", label: "Описание компании", multiline: true },
  { key: "product_name", label: "Продукт" },
  { key: "product_description", label: "Описание продукта", multiline: true },
  { key: "user_role", label: "Ваша роль" },
  { key: "counterparty_role", label: "Роль собеседника" },
  { key: "counterparty_description", label: "Описание собеседника", multiline: true },
  { key: "negotiation_goal", label: "Цель переговоров", multiline: true },
  { key: "extra_context", label: "Дополнительный контекст", multiline: true },
];

export default function ScenarioForm({ value, onChange, onSubmit, disabled }: ScenarioFormProps) {
  function setField(key: keyof ScenarioPayload, fieldValue: string) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <form
      className="scenario-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="section-heading">
        <h2>Создайте сценарий</h2>
        <p>Опишите сделку, которую хотите отработать.</p>
      </div>

      <label className="field">
        <span>Сложность</span>
        <select value={value.difficulty} onChange={(event) => setField("difficulty", event.target.value as Difficulty)}>
          <option value="easy">Легко</option>
          <option value="medium">Средне</option>
          <option value="hard">Сложно</option>
        </select>
      </label>

      <div className="form-grid">
        {textFields.map((field) => (
          <label className={field.multiline ? "field field-wide" : "field"} key={field.key}>
            <span>{field.label}</span>
            {field.multiline ? (
              <textarea
                value={String(value[field.key])}
                onChange={(event) => setField(field.key, event.target.value)}
                rows={3}
              />
            ) : (
              <input value={String(value[field.key])} onChange={(event) => setField(field.key, event.target.value)} />
            )}
          </label>
        ))}
      </div>

      <button className="primary-button" type="submit" disabled={disabled}>
        Начать тренировку
      </button>
    </form>
  );
}
