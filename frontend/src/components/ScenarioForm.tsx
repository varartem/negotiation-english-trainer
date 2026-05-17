import type { ScenarioPayload } from "../api/client";
import type { CounterpartyStance } from "../types";
import AutoResizeTextarea from "./AutoResizeTextarea";

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
        <span>Настрой собеседника</span>
        <select
          value={value.counterparty_stance}
          onChange={(event) => setField("counterparty_stance", event.target.value as CounterpartyStance)}
        >
          <option value="open">Открыт к переговорам</option>
          <option value="neutral">Нейтральный</option>
          <option value="resistant">Не настроен на диалог</option>
        </select>
      </label>

      <div className="form-grid">
        {textFields.map((field) => (
          <label className={field.multiline ? "field field-wide" : "field"} key={field.key}>
            <span>{field.label}</span>
            {field.multiline ? (
              <AutoResizeTextarea
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
