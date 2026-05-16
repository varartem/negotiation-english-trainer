import { useEffect, useState } from "react";
import { api } from "../api/client";
import VocabularyTable from "../components/VocabularyTable";
import type { VocabularyDraft } from "../components/VocabularyTable";
import type { VocabularyItem } from "../types";

const emptyForm = {
  phrase: "",
  translation: "",
  context: "",
};

export default function VocabularyPage() {
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [draft, setDraft] = useState<VocabularyDraft | null>(null);
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

  async function handleSaveDraft() {
    if (!draft?.phrase.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const created = await api.createVocabulary({
        phrase: draft.phrase.trim(),
        translation: draft.translation.trim(),
        context: draft.context.trim(),
      });
      setItems((currentItems) => [created, ...currentItems]);
      setDraft(null);
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
      <div className="dictionary-content">
        <VocabularyTable
          items={items}
          onDelete={handleDelete}
          draft={draft}
          isSavingDraft={isLoading}
          onStartCreate={() => setDraft(emptyForm)}
          onDraftChange={setDraft}
          onSaveDraft={handleSaveDraft}
          onCancelDraft={() => setDraft(null)}
        />
        {error ? <p className="error-box">{error}</p> : null}
      </div>
    </section>
  );
}
