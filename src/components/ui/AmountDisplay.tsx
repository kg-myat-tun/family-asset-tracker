import { convertAmount, formatCurrency } from "@/lib/currency.server";

interface Props {
  amount: number;
  currency: string;
  baseCurrency: string;
  rates: Record<string, number>;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl font-bold",
} as const;

export function AmountDisplay({ amount, currency, baseCurrency, rates, size = "md" }: Props) {
  const isBase = currency === baseCurrency;
  const converted = isBase ? null : convertAmount(amount, currency, baseCurrency, rates);

  return (
    <div>
      <p className={`font-semibold text-gray-900 ${SIZE_CLASS[size]}`}>
        {formatCurrency(amount, currency)}
      </p>
      {converted !== null && (
        <p className="text-xs text-gray-400">≈ {formatCurrency(converted, baseCurrency)}</p>
      )}
    </div>
  );
}
