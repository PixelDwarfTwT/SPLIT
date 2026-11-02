const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Nominal harus berupa bilangan Rupiah bulat nonnegatif.");
  }
  return rupiahFormatter.format(amount).replace(/\u00a0/g, "");
}

export function parseRupiahInput(value: string): number | null {
  const input = value.replace(/^\s*Rp\s?/i, "").trim();
  if (!input || input.startsWith("-") || input.includes(",")) return null;
  if (!/^\d+$/.test(input) && !/^\d{1,3}(?:\.\d{3})+$/.test(input)) return null;
  const digits = input.replace(/\./g, "");
  const amount = Number(digits);
  return Number.isSafeInteger(amount) ? amount : null;
}
