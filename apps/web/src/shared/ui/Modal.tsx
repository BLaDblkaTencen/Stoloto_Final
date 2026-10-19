// Модальное окно на системном <dialog>: браузер сам держит фокус внутри, закрывает по Esc
// и возвращает фокус на кнопку, которая открыла окно.
//
//   <Modal open={open} onClose={() => setOpen(false)} title="Отклонить заявку"
//          actions={<><Button variant="secondary" onClick={…}>Отмена</Button><Button variant="danger">Отклонить</Button></>}>
//     <TextareaField label="Причина" … />
//   </Modal>
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Кнопки внизу окна: основное действие последним. */
  actions?: ReactNode;
};

export function Modal({ open, onClose, title, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // Нажатие на затемнённый фон (вне окна) закрывает окно.
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-lg border-2 border-ink bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/50"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-h3">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-m-2 inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-surface-muted"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <div>{children}</div>
        {actions && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
      </div>
    </dialog>
  );
}
