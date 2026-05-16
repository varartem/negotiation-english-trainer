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
  isSavingDraft?: boolean;
  onStartCreate?: () => void;
  onDraftChange?: (draft: VocabularyDraft) => void;
  onSaveDraft?: () => void;
  onCancelDraft?: () => void;
}

export default function VocabularyTable({
  items,
  onDelete,
  draft,
  isSavingDraft = false,
  onStartCreate,
  onDraftChange,
  onSaveDraft,
  onCancelDraft,
}: VocabularyTableProps) {
  const canSaveDraft = Boolean(draft?.phrase.trim()) && !isSavingDraft;

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
            disabled={Boolean(draft)}
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
                  <td>
                    <AutoResizeTextarea
                      className="table-textarea"
                      value={draft.phrase}
                      onChange={(event) => onDraftChange({ ...draft, phrase: event.target.value })}
                      placeholder="Could you clarify the budget constraints?"
                      rows={1}
                    />
                  </td>
                  <td>
                    <AutoResizeTextarea
                      className="table-textarea"
                      value={draft.translation}
                      onChange={(event) => onDraftChange({ ...draft, translation: event.target.value })}
                      placeholder="Могли бы вы уточнить бюджетные ограничения?"
                      rows={1}
                    />
                  </td>
                  <td>
                    <AutoResizeTextarea
                      className="table-textarea"
                      value={draft.context}
                      onChange={(event) => onDraftChange({ ...draft, context: event.target.value })}
                      placeholder="Например: работа с возражением по бюджету"
                      rows={1}
                    />
                  </td>
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
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.phrase}</strong>
                  </td>
                  <td>{item.translation || <span className="muted-text">перевод не добавлен</span>}</td>
                  <td>{item.context || <span className="muted-text">-</span>}</td>
                  <td className="table-actions">
                    <button
                      className="icon-button danger"
                      type="button"
                      title="Удалить фразу"
                      onClick={() => onDelete(item.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">Сохранённые фразы появятся здесь.</p>
      )}
    </section>
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
