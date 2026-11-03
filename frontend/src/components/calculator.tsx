"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, Check, CheckCircle2, CircleUserRound,
  ClipboardList, Coins, LogOut, Minus, Plus, ReceiptText, Trash2, Utensils,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { completeBillSession, saveBillDraft } from "@/actions/bill-session";
import { calculateBill, type MenuItem, type Participant } from "@/lib/calculations/bill";
import { formatRupiah, MAX_PAYMENT_AMOUNT, parseRupiahInput } from "@/lib/currency";
import { menuFormSchema } from "@/lib/validations/bill";

type Draft = {
  id: string;
  status: "draft" | "completed";
  participants: Participant[];
  menus: MenuItem[];
  payments: Record<string, number>;
};

const steps = ["Peserta", "Pesanan", "Ringkasan & Pembayaran"];
function parsePaymentInput(value: string): number | null {
  const amount = parseRupiahInput(value);
  if (amount !== null) return amount;

  // A newly typed digit can land after a thousands separator in an already-formatted field.
  const appendedDigit = /^(\d{1,3}(?:\.\d{3})+)(\d)$/.exec(value);
  if (!appendedDigit) return null;
  return parseRupiahInput(`${appendedDigit[1].replace(/\./g, "")}${appendedDigit[2]}`);
}

export function Calculator({ initialDraft }: { initialDraft: Draft }) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const menuForm = useForm<{ name: string; unitPrice: string }>({
    resolver: zodResolver(menuFormSchema),
    defaultValues: { name: "", unitPrice: "" },
    mode: "onChange",
  });
  const menuName = useWatch({ control: menuForm.control, name: "name" }) ?? "";
  const priceInput = useWatch({ control: menuForm.control, name: "unitPrice" }) ?? "";
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentInput, setPaymentInput] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();
  const [completing, startCompleting] = useTransition();
  const [completed, setCompleted] = useState(initialDraft.status === "completed");
  const nameRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  const summary = useMemo(
    () => calculateBill(draft.participants, draft.menus, draft.payments),
    [draft.participants, draft.menus, draft.payments],
  );
  const canContinue = step === 0 ? draft.participants.length > 0 : summary.menuCount > 0;

  useEffect(() => {
    if (firstRender.current || completed) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      startSaving(async () => {
        const result = await saveBillDraft(draft);
        if (!result.ok) setError(result.error ?? "Perubahan belum tersimpan.");
        else setError("");
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, completed]);

  function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return setError("Masukkan nama peserta.");
    if (draft.participants.some((person) => person.name.trim().toLocaleLowerCase("id-ID") === cleanName.toLocaleLowerCase("id-ID"))) {
      return setError("Nama peserta sudah ada. Tambahkan pembeda agar tidak tertukar.");
    }
    if (draft.participants.length >= 20) return setError("Maksimal 20 peserta.");
    setDraft((current) => ({ ...current, participants: [...current.participants, { id: crypto.randomUUID(), name: cleanName }] }));
    setName("");
    setError("");
    setNotice(`${cleanName} ditambahkan.`);
    nameRef.current?.focus();
  }

  function removeParticipant(participantId: string) {
    const person = draft.participants.find(({ id }) => id === participantId);
    setDraft((current) => ({
      ...current,
      participants: current.participants.filter(({ id }) => id !== participantId),
      menus: current.menus.map((menu) => ({
        ...menu,
        orders: menu.orders.filter((order) => order.participantId !== participantId),
      })).filter((menu) => menu.orders.length > 0),
      payments: Object.fromEntries(Object.entries(current.payments).filter(([id]) => id !== participantId)),
    }));
    setNotice(`${person?.name ?? "Peserta"} dihapus.`);
  }

  function toggleParticipant(participantId: string) {
    setSelected((current) => {
      const next = { ...current };
      if (participantId in next) delete next[participantId];
      else next[participantId] = 1;
      return next;
    });
  }

  function beginEdit(menu: MenuItem) {
    setEditingMenu(menu.id);
    menuForm.setValue("name", menu.name);
    menuForm.setValue("unitPrice", String(menu.unitPrice));
    setSelected(Object.fromEntries(menu.orders.map((order) => [order.participantId, order.quantity])));
  }

  function clearMenuForm() {
    setEditingMenu(null);
    menuForm.reset({ name: "", unitPrice: "" });
    setSelected({});
  }

  function saveMenu(values: { name: string; unitPrice: string }) {
    const cleanName = values.name.trim();
    const unitPrice = parseRupiahInput(values.unitPrice);
    const orders = Object.entries(selected).map(([participantId, quantity]) => ({ participantId, quantity }));
    if (!cleanName) return setError("Masukkan nama menu.");
    if (!unitPrice || unitPrice <= 0) return setError("Harga satuan harus berupa Rupiah bulat positif.");
    if (!orders.length) return setError("Pilih minimal satu pemesan.");
    if (orders.some(({ quantity }) => !Number.isSafeInteger(quantity) || quantity <= 0)) return setError("Jumlah porsi harus bilangan bulat positif.");
    const newMenu = { id: editingMenu ?? crypto.randomUUID(), name: cleanName, unitPrice, orders };
    setDraft((current) => ({
      ...current,
      menus: editingMenu
        ? current.menus.map((menu) => menu.id === editingMenu ? newMenu : menu)
        : [...current.menus, newMenu],
    }));
    setError("");
    setNotice(editingMenu ? "Pesanan diperbarui." : "Pesanan ditambahkan.");
    clearMenuForm();
  }

  function removeMenu(menuId: string) {
    const menu = draft.menus.find(({ id }) => id === menuId);
    if (!window.confirm(`Hapus pesanan ${menu?.name ?? "ini"}?`)) return;
    setDraft((current) => ({ ...current, menus: current.menus.filter(({ id }) => id !== menuId) }));
    setNotice("Pesanan dihapus.");
  }

  function updatePayment(participantId: string, value: string) {
    const amount = value === "" ? 0 : parsePaymentInput(value);
    if (amount === null || amount > MAX_PAYMENT_AMOUNT) return;
    setPaymentInput(value === "" ? "" : String(amount));
    setDraft((current) => ({ ...current, payments: { ...current.payments, [participantId]: amount } }));
  }

  function beginPaymentEdit(participantId: string) {
    const amount = draft.payments[participantId] ?? 0;
    setEditingPaymentId(participantId);
    setPaymentInput(amount > 0 ? String(amount) : "");
  }

  function navigate(nextStep: number) {
    setError("");
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finishCalculation() {
    if (!window.confirm("Selesaikan perhitungan ini? Hasil yang sudah selesai tidak dapat diubah.")) return;
    startCompleting(async () => {
      const saved = await saveBillDraft(draft);
      if (!saved.ok) return setError(saved.error ?? "Perubahan belum tersimpan.");
      const result = await completeBillSession(draft.id);
      if (!result.ok) return setError(result.error ?? "Perhitungan tidak dapat diselesaikan.");
      setCompleted(true);
      setNotice("Perhitungan tersimpan.");
    });
  }

  if (completed) {
    return <main className="app-shell">
      <Header saving={false} onSignOut={() => void signOut()} />
      <section className="complete-panel">
        <div className="complete-icon"><CheckCircle2 size={30} /></div>
        <p className="eyebrow">Perhitungan selesai</p>
        <h1>Semua sudah tercatat.</h1>
        <p>Ringkasan tagihan dan pembayaran tersimpan untuk perhitungan ini.</p>
        <div className="completed-total"><span>Total tagihan</span><strong>{formatRupiah(summary.groupTotal)}</strong></div>
        <SummaryPeople summary={summary} />
        <div className="payment-totals completed-totals"><div><span>Total dibayarkan</span><strong>{formatRupiah(summary.totalPaid)}</strong></div><div><span>Total kembalian</span><strong className="positive-text">{formatRupiah(summary.totalChange)}</strong></div><div><span>Total kurang bayar</span><strong className="warning-text">{formatRupiah(summary.totalShortfall)}</strong></div></div>
        <button className="button button-primary" type="button" onClick={() => router.refresh()}><Plus size={18} /> Perhitungan baru</button>
      </section>
    </main>;
  }

  return (
    <main className="app-shell">
      <Header saving={saving} onSignOut={() => void signOut()} />
      <section className="page-intro">
        <div><p className="eyebrow">Kalkulator Patungan</p><h1>Hitung bareng, lebih jelas.</h1></div>
        <p>Catat pesanan sesuai porsi masing-masing, lalu lihat tagihan dan kembalian dengan rapi.</p>
      </section>
      <nav className="stepper" aria-label="Langkah perhitungan">
        {steps.map((label, index) => {
          const accessible = index <= step || (index === 1 && draft.participants.length > 0) || (index === 2 && summary.menuCount > 0);
          return <button key={label} type="button" onClick={() => accessible && navigate(index)} disabled={!accessible} aria-current={step === index ? "step" : undefined} className={`step-item ${step === index ? "active" : ""} ${step > index ? "done" : ""}`}>
            <span className="step-number">{step > index ? <Check size={15} /> : index + 1}</span>
            <span>{label}</span>
          </button>;
        })}
      </nav>

      <div className="work-layout">
        <section className="work-main">
          {step === 0 && <section className="panel">
            <div className="section-heading"><span className="icon-tile"><CircleUserRound size={20} /></span><div><h2>Mulai dari peserta</h2><p>Tambahkan teman yang ikut patungan.</p></div></div>
            <div className="count-row"><span>Siapa saja yang ikut?</span><strong>{draft.participants.length} / 20 orang</strong></div>
            <form className="add-person-form" onSubmit={addParticipant}>
              <div className="form-control grow"><label className="field-label" htmlFor="person-name">Nama</label><input ref={nameRef} id="person-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Masukkan nama" maxLength={80} disabled={draft.participants.length >= 20} /></div>
              <button className="button button-primary add-person-button" type="submit" disabled={draft.participants.length >= 20 || !name.trim()}><Plus size={18} /> Tambah</button>
            </form>
            <p className="field-hint">Nama dipakai untuk membagi pesanan dan kembalian.</p>
            {draft.participants.length === 20 && <p className="inline-alert">Maksimal 20 peserta. Semua tempat sudah terisi.</p>}
            {draft.participants.length > 0 ? <div className="participant-grid">{draft.participants.map((person) => <span className="participant-chip" key={person.id}>{person.name}<button type="button" aria-label={`Hapus ${person.name}`} onClick={() => removeParticipant(person.id)}><Trash2 size={14} /></button></span>)}</div> : <div className="empty-state"><CircleUserRound size={24} /><span>Nama peserta akan muncul di sini.</span></div>}
            <div className="tip-box"><span className="tip-mark">i</span><p>Bagi sesuai pesanan masing-masing. Tagihan dihitung dari menu dan jumlah porsi, bukan rata-rata.</p></div>
          </section>}

          {step === 1 && <>
            <section className="panel">
              <div className="section-heading"><span className="icon-tile"><Utensils size={20} /></span><div><h2>{editingMenu ? "Ubah pesanan" : "Catat menu sekali"}</h2><p>Centang pemesan, lalu isi jumlah porsinya.</p></div></div>
              <form className="menu-form" onSubmit={menuForm.handleSubmit(saveMenu)}>
                <div className="form-row">
                  <div className="form-control"><label className="field-label" htmlFor="menu-name">Nama menu</label><input id="menu-name" {...menuForm.register("name")} placeholder="Contoh: Nasi goreng" maxLength={120} />{menuForm.formState.errors.name && <small className="form-error">{menuForm.formState.errors.name.message}</small>}</div>
                  <div className="form-control price-control"><label className="field-label" htmlFor="menu-price">Harga satuan</label><div className="money-input"><span>Rp</span><input id="menu-price" inputMode="numeric" {...menuForm.register("unitPrice")} placeholder="0" /></div>{menuForm.formState.errors.unitPrice && <small className="form-error">{menuForm.formState.errors.unitPrice.message}</small>}</div>
                </div>
                <div className="selector-head"><div><h3>Pilih pemesan</h3><p>Setiap peserta yang dipilih dimulai dari 1 porsi.</p></div><span>{Object.keys(selected).length} dipilih</span></div>
                {draft.participants.length ? <div className="order-select-list">{draft.participants.map((person) => <div className={`order-select-row ${person.id in selected ? "selected" : ""}`} key={person.id}>
                  <label className="person-check"><input type="checkbox" checked={person.id in selected} onChange={() => toggleParticipant(person.id)} /><span className="custom-check"><Check size={14} /></span>{person.name}</label>
                  {person.id in selected && <div className="quantity-control"><button type="button" aria-label={`Kurangi porsi ${person.name}`} onClick={() => setSelected((current) => ({ ...current, [person.id]: Math.max(1, current[person.id] - 1) }))}><Minus size={14} /></button><input aria-label={`Jumlah porsi ${person.name}`} inputMode="numeric" value={selected[person.id]} onChange={(event) => setSelected((current) => ({ ...current, [person.id]: Number(event.target.value.replace(/[^\d]/g, "")) }))} /><span>porsi</span><button type="button" aria-label={`Tambah porsi ${person.name}`} onClick={() => setSelected((current) => ({ ...current, [person.id]: current[person.id] + 1 }))}><Plus size={14} /></button></div>}
                </div>)}</div> : <div className="inline-alert">Tambahkan peserta terlebih dahulu.</div>}
                <div className="subtotal-strip"><div><span>Subtotal menu</span><small>{Object.values(selected).reduce((sum, quantity) => sum + quantity, 0)} porsi</small></div><strong>{formatRupiah((parseRupiahInput(priceInput) ?? 0) * Object.values(selected).reduce((sum, quantity) => sum + quantity, 0))}</strong></div>
                <div className="form-actions"><button className="button button-primary" type="submit" disabled={!menuName.trim() || !parseRupiahInput(priceInput) || !Object.keys(selected).length}><Plus size={18} /> {editingMenu ? "Simpan perubahan" : "Tambah pesanan"}</button>{editingMenu && <button className="button button-secondary" type="button" onClick={clearMenuForm}>Batal</button>}</div>
              </form>
            </section>
            <section className="panel menu-list-panel"><div className="list-heading"><div><h2>Menu tercatat</h2><p>Atur kembali pesanan jika ada yang berubah.</p></div><span className="soft-badge">{summary.menuCount} menu</span></div>
              {summary.menus.length ? <div className="menu-list">{summary.menus.map((menu) => <article className="menu-row" key={menu.id}><div className="menu-mark"><Utensils size={18} /></div><div className="menu-details"><div className="menu-title-line"><h3>{menu.name}</h3><strong>{formatRupiah(menu.subtotal)}</strong></div><p>{formatRupiah(menu.unitPrice)} × {menu.totalQuantity} porsi</p><div className="order-people">{menu.orders.map((order) => <span key={order.participantId}>{draft.participants.find(({ id }) => id === order.participantId)?.name} <b>× {order.quantity}</b></span>)}</div></div><div className="row-actions"><button type="button" aria-label={`Ubah ${menu.name}`} onClick={() => beginEdit(menu)}>Ubah</button><button type="button" aria-label={`Hapus ${menu.name}`} onClick={() => removeMenu(menu.id)}><Trash2 size={16} /></button></div></article>)}</div> : <div className="empty-state"><Utensils size={24} /><span>Belum ada menu yang dicatat.</span></div>}
            </section>
          </>}

          {step === 2 && <>
            <section className="panel summary-hero"><div><p className="eyebrow">Total tagihan</p><h2>{formatRupiah(summary.groupTotal)}</h2><p>{summary.menuCount} menu <i /> {summary.totalPortions} porsi <i /> {summary.peopleWithOrders} orang</p></div><div className="receipt-stamp"><ReceiptText size={27} /></div></section>
            <section className="panel"><div className="list-heading"><div><h2>Pembayaran per orang</h2><p>Setiap pembayaran dihitung untuk tagihan orang itu sendiri.</p></div><Coins size={21} className="heading-icon" /></div>
              {summary.participants.filter(({ bill }) => bill > 0).map((person) => <article className="payment-card" key={person.id}><div className="payment-title"><div><h3>{person.name}</h3><span>Tagihan {formatRupiah(person.bill)}</span></div><label className="payment-field"><span className="field-label">Uang dibayar</span><span className="payment-input"><span>Rp</span><input aria-label={`Uang dibayar ${person.name}`} inputMode="numeric" maxLength={8} value={editingPaymentId === person.id ? paymentInput : draft.payments[person.id] ? new Intl.NumberFormat("id-ID").format(draft.payments[person.id]) : ""} onFocus={() => beginPaymentEdit(person.id)} onChange={(event) => updatePayment(person.id, event.target.value)} onBlur={() => setEditingPaymentId((current) => current === person.id ? null : current)} placeholder="0" /></span></label></div>
                <div className={`payment-result ${person.change ? "success" : person.shortfall ? "warning" : "even"}`}>{person.change > 0 ? <><ArrowDownLeft size={17} /><span>Kembalian {person.name}</span><strong>{formatRupiah(person.change)}</strong></> : person.shortfall > 0 ? <><Coins size={17} /><span>Kurang bayar {person.name}</span><strong>{formatRupiah(person.shortfall)}</strong></> : <><CheckCircle2 size={17} /><span>Pembayaran pas</span><strong>{formatRupiah(0)}</strong></>}</div>
                <details className="bill-details"><summary>Rincian tagihan {person.name}<span>{formatRupiah(person.bill)}</span></summary><div>{person.items.map((item) => <p key={item.menuId}><span>{item.menuName} × {item.quantity}</span><strong>{formatRupiah(item.amount)}</strong></p>)}</div></details>
              </article>)}
              <div className="payment-totals"><div><span>Total dibayarkan</span><strong>{formatRupiah(summary.totalPaid)}</strong></div><div><span>Total kembalian</span><strong className="positive-text">{formatRupiah(summary.totalChange)}</strong></div><div><span>Total kurang bayar</span><strong className="warning-text">{formatRupiah(summary.totalShortfall)}</strong></div></div>
              <p className="reconcile-note"><CheckCircle2 size={17} /> Total tagihan cocok dengan seluruh subtotal menu.</p>
            </section>
          </>}

          {error && <p className="form-error global-error" role="alert">{error}</p>}
          <p className="visually-hidden" aria-live="polite">{notice}</p>
          <div className="navigation-row">{step > 0 ? <button className="button button-secondary" type="button" onClick={() => navigate(step - 1)}><ArrowLeft size={17} /> Kembali</button> : <span />}{step < 2 ? <button className="button button-primary" type="button" onClick={() => navigate(step + 1)} disabled={!canContinue}>Lanjutkan <ArrowRight size={17} /></button> : <button className="button button-primary" type="button" onClick={finishCalculation} disabled={completing || saving}>{completing ? "Menyimpan…" : "Selesai menghitung"}<CheckCircle2 size={17} /></button>}</div>
        </section>

        <aside className="side-summary panel"><div className="list-heading"><div><p className="eyebrow">Ringkasan</p><h2>Perhitunganmu</h2></div><ClipboardList size={20} className="heading-icon" /></div><div className="side-stat"><span>Peserta</span><strong>{draft.participants.length}<small> orang</small></strong></div><div className="side-stat"><span>Menu tercatat</span><strong>{summary.menuCount}<small> menu</small></strong></div><div className="side-stat"><span>Total porsi</span><strong>{summary.totalPortions}<small> porsi</small></strong></div><div className="side-total"><span>Total pesanan</span><strong>{formatRupiah(summary.groupTotal)}</strong></div><div className="mini-reconcile"><CheckCircle2 size={17} /><span>Setiap orang membayar sesuai pesanannya.</span></div></aside>
      </div>
      {notice && <div className="toast-note" role="status">{notice}</div>}
      {saving && <span className="save-indicator">Menyimpan perubahan…</span>}
    </main>
  );
}

export function CalculatorSession({ initialDraft }: { initialDraft: Draft }) {
  return <Calculator key={initialDraft.id} initialDraft={initialDraft} />;
}

function Header({ saving, onSignOut }: { saving: boolean; onSignOut: () => void }) {
  return <header className="site-header"><Link className="brand-lockup" href="/" aria-label="Patungan, halaman utama"><span className="brand-symbol"><span /><span /><span /></span><span className="brand-name">patungan<small>Lebih jelas. Lebih adil.</small></span></Link><div className="header-actions"><span className="connection-label"><span /> {saving ? "Menyimpan" : "Tersimpan"}</span><button className="signout-button" type="button" onClick={onSignOut} aria-label="Keluar"><LogOut size={18} /><span>Keluar</span></button></div></header>;
}

function SummaryPeople({ summary }: { summary: ReturnType<typeof calculateBill> }) {
  return <div className="summary-people">{summary.participants.filter(({ bill }) => bill > 0).map((person) => <div key={person.id}><span>{person.name}</span><strong>{formatRupiah(person.bill)}</strong><small>{person.change > 0 ? `Kembalian ${formatRupiah(person.change)}` : person.shortfall > 0 ? `Kurang bayar ${formatRupiah(person.shortfall)}` : "Pas"}</small></div>)}</div>;
}
