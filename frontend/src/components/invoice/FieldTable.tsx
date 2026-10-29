import type { FieldEvidence, InvoiceDetail } from "../../api/types";
import { Icon } from "../Icons";
import { Confidence } from "../UI";
import { date, money, titleize } from "../../utils/format";

const LABELS: Record<string, string> = {
  vendor_name: "Vendor name", vendor_tax_id: "Vendor tax ID", invoice_number: "Invoice number",
  invoice_date: "Invoice date", due_date: "Due date", po_number: "PO number", currency: "Currency",
  payment_terms: "Payment terms", subtotal: "Subtotal", tax_amount: "Tax", discount_amount: "Discount",
  shipping_amount: "Shipping", total_amount: "Total",
};

function display(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const stringValue = String(value);
  if (stringValue.startsWith("{") && stringValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(stringValue.replaceAll("'", '"'));
      if (parsed?.value !== undefined) return display(field, parsed.value);
    } catch {
      /* keep raw string */
    }
  }
  if (field.endsWith("_date")) return date(stringValue);
  if (["subtotal", "tax_amount", "discount_amount", "shipping_amount", "total_amount"].includes(field)) return money(stringValue, "INR");
  return stringValue;
}

export function FieldTable({ invoice }: { invoice: InvoiceDetail }) {
  const evidence = invoice.extraction.field_evidence || {};
  const confidence = invoice.extraction.field_confidence || {};
  const fields = Object.keys(evidence).length ? Object.keys(evidence) : Object.keys(confidence);
  return (
    <div className="table-wrap">
      <table className="data compact">
        <thead>
          <tr><th>Field</th><th>Extracted value</th><th>Confidence</th><th>Source</th></tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const item: FieldEvidence | undefined = evidence[field];
            const value = item?.normalized ?? item?.value ?? (invoice as unknown as Record<string, unknown>)[field];
            return (
              <tr key={field}>
                <td className="muted">{LABELS[field] || titleize(field)}</td>
                <td className="strong" style={{ maxWidth: 280 }}>{display(field, value)}</td>
                <td><Confidence value={item?.confidence ?? confidence[field] ?? 0} /></td>
                <td className="tiny muted">
                  <div className="row" style={{ gap: 4 }}>
                    <Icon name="scan" size={11} />
                    {item ? `${item.method}${item.page ? ` · p${item.page}` : ""}` : "—"}
                  </div>
                  {Array.isArray(item?.bbox) && <div className="mono" style={{ fontSize: 10 }}>bbox [{item.bbox.map((n) => Math.round(Number(n))).join(", ")}]</div>}
                  {item?.source_text && <div className="truncate" style={{ maxWidth: 220 }} title={item.source_text}>“{item.source_text}”</div>}
                </td>
              </tr>
            );
          })}
          {fields.length === 0 && <tr><td colSpan={4}><div className="table-empty">No field evidence recorded.</div></td></tr>}
        </tbody>
      </table>
    </div>
  );
}
