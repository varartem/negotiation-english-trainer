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
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<VocabularyDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
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

  function handleStartEdit(item: VocabularyItem) {
    setDraft(null);
    setError(null);
    setEditingItemId(item.id);
    setEditDraft({
      phrase: item.phrase,
      translation: item.translation,
      context: item.context,
    });
  }

  async function handleSaveEdit(itemId: number) {
    if (!editDraft?.phrase.trim()) {
      return;
    }

    setSavingItemId(itemId);
    setError(null);
    try {
      const updated = await api.updateVocabulary(itemId, {
        phrase: editDraft.phrase.trim(),
        translation: editDraft.translation.trim(),
        context: editDraft.context.trim(),
      });
      setItems((currentItems) => currentItems.map((item) => (item.id === itemId ? updated : item)));
      setEditingItemId(null);
      setEditDraft(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить фразу");
    } finally {
      setSavingItemId(null);
    }
  }

  function handleCancelEdit() {
    setEditingItemId(null);
    setEditDraft(null);
  }

  async function handleDelete(itemId: number) {
    setError(null);
    try {
      await api.deleteVocabulary(itemId);
      setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить фразу");
    }
  }

  return (
    <section className="dictionary-page">
      <div className="dictionary-content">
        <VocabularyTable
          items={items}
          onDelete={handleDelete}
          draft={draft}
          editingItemId={editingItemId}
          editDraft={editDraft}
          isSavingDraft={isLoading}
          savingItemId={savingItemId}
          onStartCreate={() => setDraft(emptyForm)}
          onDraftChange={setDraft}
          onSaveDraft={handleSaveDraft}
          onCancelDraft={() => setDraft(null)}
          onStartEdit={handleStartEdit}
          onEditDraftChange={setEditDraft}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />
        {error ? <p className="error-box">{error}</p> : null}
      </div>
    </section>
  );
}
