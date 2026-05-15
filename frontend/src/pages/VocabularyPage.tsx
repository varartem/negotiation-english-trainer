import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import VocabularyTable from "../components/VocabularyTable";
import type { VocabularyItem } from "../types";

const emptyForm = {
  phrase: "",
  translation: "",
  context: "",
};

export default function VocabularyPage() {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVocabulary();
  }, []);

  async function loadVocabulary() {
    setError(null);
    try {
      setItems(await api.listVocabulary());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось загрузить словарь");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.phrase.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const created = await api.createVocabulary({
        phrase: form.phrase.trim(),
        translation: form.translation.trim(),
        context: form.context.trim(),
      });
      setItems((currentItems) => [created, ...currentItems]);
      setForm(emptyForm);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить фразу");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(itemId: number) {
    await api.deleteVocabulary(itemId);
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  }

  return (
    <section className="dictionary-page">
      <form className="panel dictionary-form" onSubmit={handleSubmit}>
        <div className="section-heading">
          <h2>Добавить фразу</h2>
          <p>Сохраняйте полезные обороты для переговоров вместе с русским переводом.</p>
        </div>

        <div className="dictionary-form-grid">
          <label className="field">
            <span>Английская фраза</span>
            <input
              value={form.phrase}
              onChange={(event) => setForm({ ...form, phrase: event.target.value })}
              placeholder="Could you clarify the budget constraints?"
            />
          </label>
          <label className="field">
            <span>Русский перевод</span>
            <input
              value={form.translation}
              onChange={(event) => setForm({ ...form, translation: event.target.value })}
              placeholder="Могли бы вы уточнить бюджетные ограничения?"
            />
          </label>
          <label className="field field-wide">
            <span>Контекст</span>
            <textarea
              value={form.context}
              onChange={(event) => setForm({ ...form, context: event.target.value })}
              rows={3}
              placeholder="Например: работа с возражением по бюджету"
            />
          </label>
        </div>

        <button className="primary-button" type="submit" disabled={isLoading || !form.phrase.trim()}>
          Добавить в словарь
        </button>
        {error ? <p className="error-box">{error}</p> : null}
      </form>

      <VocabularyTable items={items} onDelete={handleDelete} />
    </section>
  );
}
