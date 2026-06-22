export function formatAUD(n) {
  const num = Number(n) || 0;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(num);
}

export function statusLabel(s) {
  return (
    {
      new_estimate: "New Estimate",
      contacted: "Contacted",
      documents_received: "Documents Received",
      submitted_to_ato: "Submitted to ATO",
      refund_paid: "Refund Paid",
    }[s] || s
  );
}

export const STATUS_PIPELINE = [
  "new_estimate",
  "contacted",
  "documents_received",
  "submitted_to_ato",
  "refund_paid",
];

export function statusBadgeClass(s) {
  return (
    {
      new_estimate: "bg-[#FEE7E0] text-[#9B3A26] border-[#F3C8BB]",
      contacted: "bg-[#E7EEF4] text-[#0B2B40] border-[#C9D6E1]",
      documents_received: "bg-[#FFF4DC] text-[#7A5A12] border-[#F1E2B6]",
      submitted_to_ato: "bg-[#E6EFD8] text-[#3B5A1C] border-[#CDDBB0]",
      refund_paid: "bg-[#D6EFD8] text-[#1E5128] border-[#A7D9AE]",
    }[s] || "bg-gray-100 text-gray-800 border-gray-200"
  );
}
