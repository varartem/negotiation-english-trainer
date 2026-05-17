import AutoResizeTextarea from "./AutoResizeTextarea";
import type { VocabularyItem } from "../types";

export interface VocabularyDraft {
  phrase: string;
  translation: string;
  context: string;
}

interface VocabularyTableProps {
  items: VocabularyItem[];
  onDelete: (itemId: number) => void;
  draft?: VocabularyDraft | null;
  editingItemId?: number | null;
  editDraft?: VocabularyDraft | null;
  isSavingDraft?: boolean;
  savingItemId?: number | null;
  onStartCreate?: () => void;
  onDraftChange?: (draft: VocabularyDraft) => void;
  onSaveDraft?: () => void;
  onCancelDraft?: () => void;
  onStartEdit?: (item: VocabularyItem) => void;
  onEditDraftChange?: (draft: VocabularyDraft) => void;
  onSaveEdit?: (itemId: number) => void;
  onCancelEdit?: () => void;
}

export default function VocabularyTable({
  items,
  onDelete,
  draft,
  editingItemId = null,
  editDraft,
  isSavingDraft = false,
  savingItemId = null,
  onStartCreate,
  onDraftChange,
  onSaveDraft,
  onCancelDraft,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
}: VocabularyTableProps) {
  const isEditing = editingItemId !== null;
  const isSavingEdit = savingItemId !== null;
  const canSaveDraft = Boolean(draft?.phrase.trim()) && !isSavingDraft && !isSavingEdit;
  const canStartCreate = !draft && !isEditing && !isSavingDraft && !isSavingEdit;

  return (
    <section className="panel vocabulary-panel">
      <div className="panel-header">
        <h2>Словарь</h2>
        {onStartCreate ? (
          <button
            className="icon-button"
            type="button"
            title="Добавить фразу"
            onClick={onStartCreate}
            disabled={!canStartCreate}
          >
            <PlusIcon />
          </button>
        ) : null}
      </div>
      {items.length || draft ? (
        <div className="vocabulary-table-wrap">
          <table className="vocabulary-table">
            <thead>
              <tr>
                <th>Английская фраза</th>
                <th>Русский перевод</th>
                <th>Контекст</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {draft && onDraftChange ? (
                <tr className="vocabulary-draft-row">
                  <EditableCells
                    value={draft}
                    onChange={onDraftChange}
                    translationPlaceholder="Оставьте пустым для автоперевода"
                  />
                  <td className="table-actions">
                    <div className="table-action-group">
                      <button
                        className="icon-button"
                        type="button"
                        title="Сохранить фразу"
                        onClick={onSaveDraft}
                        disabled={!canSaveDraft}
                      >
                        <CheckIcon />
                      </button>
                      <button className="icon-button danger" type="button" title="Отменить" onClick={onCancelDraft}>
                        <XIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {items.map((item) => {
                const isCurrentItemEditing = editingItemId === item.id && editDraft && onEditDraftChange;
                if (isCurrentItemEditing) {
                  const canSaveEdit = Boolean(editDraft.phrase.trim()) && savingItemId === null;
                  return (
                    <tr className="vocabulary-draft-row" key={item.id}>
                      <EditableCells
                        value={editDraft}
                        onChange={onEditDraftChange}
                        phrasePlaceholder="English phrase"
                        translationPlaceholder="Русский перевод"
                        contextPlaceholder="Контекст"
                      />
                      <td className="table-actions">
                        <div className="table-action-group">
                          <button
                            className="icon-button"
                            type="button"
                            title="Сохранить изменения"
                            onClick={() => onSaveEdit?.(item.id)}
                            disabled={!canSaveEdit}
                          >
                            <CheckIcon />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            title="Отменить редактирование"
                            onClick={onCancelEdit}
                            disabled={savingItemId === item.id}
                          >
                            <XIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const controlsDisabled = Boolean(draft) || isEditing || isSavingDraft || isSavingEdit;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.phrase}</strong>
                    </td>
                    <td>{item.translation || <span className="muted-text">перевод не добавлен</span>}</td>
                    <td>{item.context || <span className="muted-text">-</span>}</td>
                    <td className="table-actions">
                      <div className="table-action-group">
                        {onStartEdit ? (
                          <button
                            className="icon-button"
                            type="button"
                            title="Редактировать фразу"
                            onClick={() => onStartEdit(item)}
                            disabled={controlsDisabled}
                          >
                            <PencilIcon />
                          </button>
                        ) : null}
                        <button
                          className="icon-button danger"
                          type="button"
                          title="Удалить фразу"
                          onClick={() => onDelete(item.id)}
                          disabled={controlsDisabled}
                        >
                          <XIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">Сохранённые фразы появятся здесь.</p>
      )}
    </section>
  );
}

interface EditableCellsProps {
  value: VocabularyDraft;
  onChange: (draft: VocabularyDraft) => void;
  phrasePlaceholder?: string;
  translationPlaceholder?: string;
  contextPlaceholder?: string;
}

function EditableCells({
  value,
  onChange,
  phrasePlaceholder = "Could you clarify the budget constraints?",
  translationPlaceholder = "Могли бы вы уточнить бюджетные ограничения?",
  contextPlaceholder = "Например: работа с возражением по бюджету",
}: EditableCellsProps) {
  return (
    <>
      <td>
        <AutoResizeTextarea
          className="table-textarea"
          value={value.phrase}
          onChange={(event) => onChange({ ...value, phrase: event.target.value })}
          placeholder={phrasePlaceholder}
          rows={1}
        />
      </td>
      <td>
        <AutoResizeTextarea
          className="table-textarea"
          value={value.translation}
          onChange={(event) => onChange({ ...value, translation: event.target.value })}
          placeholder={translationPlaceholder}
          rows={1}
        />
      </td>
      <td>
        <AutoResizeTextarea
          className="table-textarea"
          value={value.context}
          onChange={(event) => onChange({ ...value, context: event.target.value })}
          placeholder={contextPlaceholder}
          rows={1}
        />
      </td>
    </>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
