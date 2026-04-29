"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FINANCE_INTEREST_RATE } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type RepaymentFrequency = "monthly" | "weekly";

function sanitizeCurrencyInput(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function sanitizeIntegerInput(value: string) {
  const numeric = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function calculateRepayment(
  principal: number,
  annualRate: number,
  termYears: number,
  frequency: RepaymentFrequency
) {
  if (principal <= 0 || termYears <= 0) return 0;

  const paymentsPerYear = frequency === "weekly" ? 52 : 12;
  const paymentCount = termYears * paymentsPerYear;
  const periodicRate = annualRate / 100 / paymentsPerYear;

  if (periodicRate <= 0) {
    return principal / paymentCount;
  }

  return (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -paymentCount));
}

export function FinanceCalculator({ defaultVehiclePrice }: { defaultVehiclePrice: number }) {
  const [vehiclePrice, setVehiclePrice] = useState(defaultVehiclePrice);
  const [deposit, setDeposit] = useState(0);
  const [balloon, setBalloon] = useState(0);
  const [interestRate, setInterestRate] = useState(DEFAULT_FINANCE_INTEREST_RATE);
  const [loanTermYears, setLoanTermYears] = useState(5);
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>("weekly");

  useEffect(() => {
    setVehiclePrice(defaultVehiclePrice);
  }, [defaultVehiclePrice]);

  const financedAmount = useMemo(() => {
    return Math.max(vehiclePrice - deposit - balloon, 0);
  }, [balloon, deposit, vehiclePrice]);

  const estimatedRepayment = useMemo(() => {
    return calculateRepayment(financedAmount, interestRate, loanTermYears, repaymentFrequency);
  }, [financedAmount, interestRate, loanTermYears, repaymentFrequency]);

  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.25em] text-bronze">Finance Calculator</p>
      <h2 className="mt-2 text-2xl font-semibold text-ink">Indicative repayments</h2>
      <p className="mt-3 text-sm leading-6 text-ink/65">
        Adjust the inputs below to estimate repayments for this vehicle based on the listed price.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Vehicle price</span>
          <input
            inputMode="decimal"
            value={vehiclePrice || ""}
            onChange={(event) => setVehiclePrice(sanitizeCurrencyInput(event.target.value))}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Deposit</span>
            <input
              inputMode="decimal"
              value={deposit || ""}
              onChange={(event) => setDeposit(sanitizeCurrencyInput(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Balloon</span>
            <input
              inputMode="decimal"
              value={balloon || ""}
              onChange={(event) => setBalloon(sanitizeCurrencyInput(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Interest rate</span>
            <div className="relative mt-2">
              <input
                inputMode="decimal"
                value={interestRate || ""}
                onChange={(event) => setInterestRate(sanitizeCurrencyInput(event.target.value))}
                className="w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 pr-10 text-sm text-ink outline-none transition focus:border-bronze"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink/45">%</span>
            </div>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Loan term</span>
            <select
              value={loanTermYears}
              onChange={(event) => setLoanTermYears(sanitizeIntegerInput(event.target.value) || 5)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
            >
              {[3, 4, 5, 6, 7].map((term) => (
                <option key={term} value={term}>
                  {term} years
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.18em] text-ink/45">Repayment frequency</span>
          <select
            value={repaymentFrequency}
            onChange={(event) => setRepaymentFrequency(event.target.value as RepaymentFrequency)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </div>

      <div className="mt-6 rounded-[22px] bg-shell px-4 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Estimated repayment</p>
        <p className="mt-2 text-3xl font-semibold text-ink">
          {formatCurrency(Math.max(estimatedRepayment, 0))} {repaymentFrequency === "weekly" ? "per week" : "per month"}
        </p>
        <p className="mt-2 text-sm text-ink/65">
          Based on a financed amount of{" "}
          <span className="font-medium text-ink">{formatCurrency(financedAmount)}</span>
          {balloon > 0 ? (
            <>
              {" "}plus a final balloon of <span className="font-medium text-ink">{formatCurrency(balloon)}</span>.
            </>
          ) : (
            "."
          )}
        </p>
      </div>

      <p className="mt-4 text-xs leading-5 text-ink/55">
        Indicative estimate only. Final rate and repayment depend on lender approval, credit profile, loan term and
        vehicle details.
      </p>

      <p className="mt-4 text-right text-xs text-ink/45">
        Powered by{" "}
        <Link
          href="https://www.kaizenfinance.com.au/"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink transition hover:text-bronze"
        >
          Kaizen Finance
        </Link>
      </p>
    </div>
  );
}
