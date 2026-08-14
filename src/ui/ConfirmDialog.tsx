import type { ReactNode } from "react";
import Button from "./Button";
import Modal from "./Modal";

export default function ConfirmDialog({
  title,
  message,
  confirmText = "确认",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** 确认文案;传 ReactNode 时可在批量确认中高亮数量等关键信息 */
  message: ReactNode;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel} width={420}>
      <p className="mb-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">{message}</p>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>取消</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
