type Props = {
  sql: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ sql, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Write Operation</h3>
        <p className="text-sm text-gray-500 mb-3">You are about to execute a write operation:</p>
        <pre className="bg-gray-50 rounded p-3 text-xs font-mono text-gray-800 overflow-auto max-h-40 mb-4">{sql}</pre>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">Execute</button>
        </div>
      </div>
    </div>
  );
}
