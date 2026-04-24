"use client";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Patvirtinti",
  cancelLabel = "Atsaukti",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/55 px-[16px] py-[20px]">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-[20px] py-[16px]">
          <h2 className="ui-font text-[24px] font-semibold text-slate-900">
            {title}
          </h2>
        </div>

        <div className="px-[20px] py-[20px]">
          <p className="ui-font text-[15px] leading-[24px] text-slate-600">
            {message}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-[10px] border-t border-slate-200 px-[20px] py-[16px] sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] border border-slate-200 bg-white px-[16px] text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="ui-font inline-flex h-[46px] items-center justify-center rounded-[16px] bg-red-600 px-[16px] text-[14px] font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {loading ? "Vykdoma..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
