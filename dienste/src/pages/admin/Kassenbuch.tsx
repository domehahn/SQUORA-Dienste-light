import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/useAuth";
import { CASH_CATEGORY_LABELS, eurosToCents, formatMoney } from "../../lib/cash";
import type { CashTransaction, CashTransactionCategory, CashTransactionKind, ClubCashBook } from "../../lib/types";
import { FloatingInput, FloatingSelect } from "../../components/FloatingField";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

const EMPTY = {
  kind: "expense" as CashTransactionKind,
  category: "equipment" as CashTransactionCategory,
  description: "",
  amount: "",
  occurredOn: new Date().toISOString().slice(0, 10),
};

export default function Kassenbuch() {
  const { isAdmin } = useAuth();
  const [book, setBook] = useState<ClubCashBook | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setBook(await api.get<ClubCashBook>("/api/cash/book"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY, occurredOn: new Date().toISOString().slice(0, 10) });
  }

  function startEdit(t: CashTransaction) {
    setEditingId(t.id);
    setForm({
      kind: t.kind,
      category: t.category,
      description: t.description,
      amount: (t.amountCents / 100).toFixed(2).replace(".", ","),
      occurredOn: t.occurredOn,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountCents = eurosToCents(form.amount);
    if (amountCents === null || amountCents === 0) {
      setError("Der Buchungsbetrag muss größer als 0 sein.");
      return;
    }
    setError(null);
    const payload = { kind: form.kind, category: form.category, description: form.description, amountCents, occurredOn: form.occurredOn };
    try {
      if (editingId) await api.put(`/api/cash-transactions/${editingId}`, payload);
      else await api.post("/api/cash/general", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Diese Buchung wirklich löschen?")) return;
    setError(null);
    try {
      await api.del(`/api/cash-transactions/${id}`);
      if (editingId === id) resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Kassenbuch</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gesamtübersicht über alle Turnier-Kassen sowie allgemeine, nicht turniergebundene Buchungen (z.B.
          Anschaffung von Sportgeräten, Waffeleisen, Kaffeemaschine).
        </p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">Fehler: {error}</p>}
      {loading || !book ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Lädt…</p>
      ) : (
        <>
          <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-950/40">
            <div className="text-xs text-blue-700 dark:text-blue-300">Gesamtsaldo</div>
            <div className="text-2xl font-semibold text-blue-900 dark:text-blue-100">
              {formatMoney(book.totalBalanceCents)}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">Turnier-Kassen</h3>
            {book.tournamentBoxes.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">Noch keine Heimturniere angelegt.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-2 font-medium">Datum</th>
                      <th className="px-4 py-2 font-medium">Turnier</th>
                      <th className="px-4 py-2 font-medium">Jugend</th>
                      <th className="px-4 py-2 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.tournamentBoxes.map((b) => (
                      <tr key={b.tournamentId} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(b.eventDate)}</td>
                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                          <Link to={`/admin/kasse?turnier=${b.tournamentId}`} className="hover:underline">
                            {b.tournamentName}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{b.jugendName ?? "–"}</td>
                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">
                          {formatMoney(b.currentBalanceCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {isAdmin && (
            <div>
              <h3 className="mb-1 font-medium text-slate-900 dark:text-slate-100">Allgemeine Kasse</h3>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                Buchungen ohne Turnier-Bezug, z.B. Anschaffung von Sportgeräten, Waffeleisen oder Kaffeemaschine.
              </p>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
                  <div className="text-xs text-emerald-700 dark:text-emerald-300">Einnahmen</div>
                  <div className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    {formatMoney(book.generalIncomeCents)}
                  </div>
                </div>
                <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/40">
                  <div className="text-xs text-red-700 dark:text-red-300">Ausgaben</div>
                  <div className="text-lg font-semibold text-red-900 dark:text-red-100">
                    {formatMoney(book.generalExpenseCents)}
                  </div>
                </div>
                <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/40">
                  <div className="text-xs text-blue-700 dark:text-blue-300">Saldo</div>
                  <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {formatMoney(book.generalBalanceCents)}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5"
              >
                <FloatingSelect
                  label="Buchungsart"
                  value={form.kind}
                  onChange={(e) => {
                    const kind = e.target.value as CashTransactionKind;
                    setForm((f) => ({ ...f, kind, category: kind === "income" ? "sales" : "equipment" }));
                  }}
                >
                  <option value="income">Einnahme</option>
                  <option value="expense">Ausgabe</option>
                </FloatingSelect>
                <FloatingSelect
                  label="Kategorie"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CashTransactionCategory }))}
                >
                  {(Object.keys(CASH_CATEGORY_LABELS) as CashTransactionCategory[]).map((category) => (
                    <option key={category} value={category}>
                      {CASH_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </FloatingSelect>
                <FloatingInput
                  label="Beschreibung"
                  required
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <FloatingInput
                  label="Betrag in Euro"
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
                <FloatingInput
                  label="Datum"
                  type="date"
                  required
                  value={form.occurredOn}
                  onChange={(e) => setForm((f) => ({ ...f, occurredOn: e.target.value }))}
                />
                <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  >
                    {editingId ? "Änderung speichern" : "Buchung erfassen"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300"
                    >
                      Abbrechen
                    </button>
                  )}
                </div>
              </form>

              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-2 font-medium">Datum</th>
                      <th className="px-4 py-2 font-medium">Buchung</th>
                      <th className="px-4 py-2 font-medium">Kategorie</th>
                      <th className="px-4 py-2 text-right font-medium">Betrag</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.generalTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDate(t.occurredOn)}</td>
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{t.description}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{CASH_CATEGORY_LABELS[t.category]}</td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            t.kind === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {t.kind === "income" ? "+" : "−"}
                          {formatMoney(t.amountCents)}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button onClick={() => startEdit(t)} className="mr-3 text-blue-700 hover:underline dark:text-blue-400">
                            Bearbeiten
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:underline dark:text-red-400">
                            Löschen
                          </button>
                        </td>
                      </tr>
                    ))}
                    {book.generalTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                          Noch keine allgemeinen Buchungen erfasst.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
