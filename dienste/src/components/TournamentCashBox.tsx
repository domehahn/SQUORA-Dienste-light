import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type {
  CashTransaction,
  CashTransactionCategory,
  CashTransactionKind,
  InventoryItem,
  TournamentCashBox as TournamentCashBoxData,
} from "../lib/types";
import { FloatingInput, FloatingSelect } from "./FloatingField";
import { CASH_CATEGORY_LABELS, eurosToCents, formatMoney } from "../lib/cash";

const EMPTY_TRANSACTION = {
  kind: "expense" as CashTransactionKind,
  category: "drinks" as CashTransactionCategory,
  description: "",
  amount: "",
  occurredOn: "",
  inventoryItemId: "",
  quantity: "",
};

export function TournamentCashBox({ tournamentId, eventDate }: { tournamentId: string; eventDate: string }) {
  const [cashBox, setCashBox] = useState<TournamentCashBoxData | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [openingBalance, setOpeningBalance] = useState("0,00");
  const [form, setForm] = useState({ ...EMPTY_TRANSACTION, occurredOn: eventDate });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [cash, items] = await Promise.all([
        api.get<TournamentCashBoxData>(`/api/tournaments/${tournamentId}/cash`),
        api.get<InventoryItem[]>("/api/inventory"),
      ]);
      setCashBox(cash);
      setInventoryItems(items);
      setOpeningBalance((cash.openingBalanceCents / 100).toFixed(2).replace(".", ","));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Kasse");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function saveOpeningBalance() {
    const openingBalanceCents = eurosToCents(openingBalance);
    if (openingBalanceCents === null) {
      setError("Bitte einen gültigen Anfangsbestand eingeben.");
      return;
    }
    setError(null);
    try {
      const data = await api.put<TournamentCashBoxData>(`/api/tournaments/${tournamentId}/cash/opening-balance`, {
        openingBalanceCents,
      });
      setCashBox(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern des Anfangsbestands");
    }
  }

  function resetTransactionForm() {
    setEditingId(null);
    setForm({ ...EMPTY_TRANSACTION, occurredOn: eventDate });
  }

  function startEdit(transaction: CashTransaction) {
    setEditingId(transaction.id);
    setForm({
      kind: transaction.kind,
      category: transaction.category,
      description: transaction.description,
      amount: (transaction.amountCents / 100).toFixed(2).replace(".", ","),
      occurredOn: transaction.occurredOn,
      inventoryItemId: transaction.inventoryItemId ?? "",
      quantity: transaction.quantity != null ? String(transaction.quantity) : "",
    });
  }

  async function saveTransaction(e: FormEvent) {
    e.preventDefault();
    const amountCents = eurosToCents(form.amount);
    if (amountCents === null || amountCents === 0) {
      setError("Der Buchungsbetrag muss größer als 0 sein.");
      return;
    }
    setError(null);
    const payload = {
      kind: form.kind,
      category: form.category,
      description: form.description,
      amountCents,
      occurredOn: form.occurredOn,
      inventoryItemId: form.inventoryItemId || null,
      quantity: form.inventoryItemId && form.quantity ? Number(form.quantity) : null,
    };
    try {
      if (editingId) await api.put(`/api/cash-transactions/${editingId}`, payload);
      else await api.post(`/api/tournaments/${tournamentId}/cash/transactions`, payload);
      resetTransactionForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern der Buchung");
    }
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Diese Buchung wirklich löschen?")) return;
    setError(null);
    try {
      await api.del(`/api/cash-transactions/${id}`);
      if (editingId === id) resetTransactionForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen der Buchung");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 print:hidden">
      <div className="mb-3">
        <h3 className="font-medium text-slate-900 dark:text-slate-100">Veranstaltungskasse</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Anfangsbestand, Verkaufseinnahmen und Einkäufe für dieses Heimspiel bzw. Heimturnier. Bei Verknüpfung
          mit einem Lagerartikel wird dessen Bestand automatisch angepasst: Ausgaben (Einkauf) erhöhen ihn,
          Einnahmen (Verkauf) verringern ihn.
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading && !cashBox ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Kasse wird geladen…</p>
      ) : cashBox ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/40">
              <div className="text-xs text-blue-700 dark:text-blue-300">Aktueller Kassenbestand</div>
              <div className="text-xl font-semibold text-blue-900 dark:text-blue-100">{formatMoney(cashBox.currentBalanceCents)}</div>
            </div>
            <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Einnahmen</div>
              <div className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">{formatMoney(cashBox.incomeCents)}</div>
            </div>
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/40">
              <div className="text-xs text-red-700 dark:text-red-300">Ausgaben</div>
              <div className="text-lg font-semibold text-red-900 dark:text-red-100">{formatMoney(cashBox.expenseCents)}</div>
            </div>
          </div>

          <div className="mb-5 flex max-w-sm items-end gap-2">
            <div className="flex-1">
              <FloatingInput
                label="Anfangsbestand in Euro"
                inputMode="decimal"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <button type="button" onClick={saveOpeningBalance} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Speichern
            </button>
          </div>

          <form onSubmit={saveTransaction} className="grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-5">
            <FloatingSelect
              label="Buchungsart"
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as CashTransactionKind;
                setForm((current) => ({ ...current, kind, category: kind === "income" ? "sales" : "drinks" }));
              }}
            >
              <option value="income">Einnahme</option>
              <option value="expense">Ausgabe</option>
            </FloatingSelect>
            <FloatingSelect label="Kategorie" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value as CashTransactionCategory }))}>
              {(Object.keys(CASH_CATEGORY_LABELS) as CashTransactionCategory[]).map((category) => (
                <option key={category} value={category}>{CASH_CATEGORY_LABELS[category]}</option>
              ))}
            </FloatingSelect>
            <FloatingInput label="Beschreibung" required value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
            <FloatingInput label="Betrag in Euro" required inputMode="decimal" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} />
            <FloatingInput label="Datum" type="date" required value={form.occurredOn} onChange={(e) => setForm((current) => ({ ...current, occurredOn: e.target.value }))} />
            <FloatingSelect
              label="Lagerartikel (optional)"
              value={form.inventoryItemId}
              onChange={(e) => setForm((current) => ({ ...current, inventoryItemId: e.target.value }))}
            >
              <option value="">– keiner –</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.unit ? ` (${item.unit})` : ""}
                </option>
              ))}
            </FloatingSelect>
            {form.inventoryItemId && (
              <FloatingInput
                label="Menge"
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))}
              />
            )}
            <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                {editingId ? "Änderung speichern" : "Buchung erfassen"}
              </button>
              {editingId && <button type="button" onClick={resetTransactionForm} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">Abbrechen</button>}
            </div>
          </form>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr><th className="py-2 pr-3 font-medium">Datum</th><th className="py-2 pr-3 font-medium">Buchung</th><th className="py-2 pr-3 font-medium">Kategorie</th><th className="py-2 pr-3 text-right font-medium">Betrag</th><th></th></tr>
              </thead>
              <tbody>
                {cashBox.transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{transaction.occurredOn.split("-").reverse().join(".")}</td>
                    <td className="py-2 pr-3 text-slate-800 dark:text-slate-100">
                      {transaction.description}
                      {transaction.inventoryItemName && transaction.quantity != null && (
                        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                          ({transaction.quantity}x {transaction.inventoryItemName})
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{CASH_CATEGORY_LABELS[transaction.category]}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${transaction.kind === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {transaction.kind === "income" ? "+" : "−"}{formatMoney(transaction.amountCents)}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(transaction)} className="mr-3 text-blue-700 hover:underline dark:text-blue-400">Bearbeiten</button>
                      <button type="button" onClick={() => deleteTransaction(transaction.id)} className="text-red-600 hover:underline dark:text-red-400">Löschen</button>
                    </td>
                  </tr>
                ))}
                {cashBox.transactions.length === 0 && <tr><td colSpan={5} className="py-5 text-center text-slate-400">Noch keine Einnahmen oder Ausgaben erfasst.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
