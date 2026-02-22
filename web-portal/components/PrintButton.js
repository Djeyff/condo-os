'use client';

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-secondary text-sm print:hidden">
      🖨️ Print / PDF
    </button>
  );
}
