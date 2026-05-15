import type { VocabularyItem } from "../types";

interface VocabularyTableProps {
  items: VocabularyItem[];
  onDelete: (itemId: number) => void;
}

export default function VocabularyTable({ items, onDelete }: VocabularyTableProps) {
  return (
    <section className="panel vocabulary-panel">
      <div className="panel-header">
        <h2>Словарь</h2>
      </div>
      {items.length ? (
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
