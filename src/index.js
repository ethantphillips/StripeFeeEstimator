/**
 * stripe-fee-estimator
 * Estimate Stripe-style processing fees.
 *
 * Important: These are estimates. Actual Stripe fees can vary by country,
 * payment method, custom pricing, disputes, taxes, Connect, payouts, and other products.
 */

export const DEFAULT_CURRENCY = "USD";

export const DEFAULT_PRESETS = Object.freeze({
  online: Object.freeze({
    name: "online",
    label: "Online domestic card",
    percent: 0.029,
    fixed: 0.30,
    currency: "USD",
    description: "Default U.S. online card estimate: 2.9% + $0.30."
  }),
  inPerson: Object.freeze({
    name: "inPerson",
    aliases: ["in-person", "terminal", "card-present"],
    label: "In-person domestic card",
    percent: 0.027,
    fixed: 0.05,
    currency: "USD",
    description: "Default U.S. in-person card estimate: 2.7% + $0.05."
  }),
  ach: Object.freeze({
    name: "ach",
    label: "ACH direct debit",
    percent: 0.008,
    fixed: 0,
    cap: 5.00,
    currency: "USD",
    description: "Common U.S. ACH estimate: 0.8%, capped at $5.00."
  }),
  instantPayout: Object.freeze({
    name: "instantPayout",
    aliases: ["instant-payout", "instant"],
    label: "Instant payout add-on",
    percent: 0.015,
    fixed: 0,
    currency: "USD",
    description: "Optional add-on estimate for Instant Payouts."
  })
});

export const DEFAULT_ADDONS = Object.freeze({
  manual: Object.freeze({
    name: "manual",
    label: "Manually entered card add-on",
    percent: 0.005,
    fixed: 0,
    description: "Adds 0.5%."
  }),
  international: Object.freeze({
    name: "international",
    label: "International card add-on",
    percent: 0.015,
    fixed: 0,
    description: "Adds 1.5%."
  }),
  currencyConversion: Object.freeze({
    name: "currencyConversion",
    aliases: ["currency-conversion", "conversion"],
    label: "Currency conversion add-on",
    percent: 0.01,
    fixed: 0,
    description: "Adds 1%."
  }),
  disputeProtection: Object.freeze({
    name: "disputeProtection",
    aliases: ["dispute-protection"],
    label: "Dispute protection add-on",
    percent: 0.004,
    fixed: 0,
    description: "Adds 0.4% when enabled."
  })
});

export function toCents(amount) {
  assertFiniteNumber(amount, "amount");
  return Math.round((Number(amount) + Number.EPSILON) * 100);
}

export function fromCents(cents) {
  assertFiniteNumber(cents, "cents");
  return Math.round(Number(cents)) / 100;
}

export function formatMoney(amount, currency = DEFAULT_CURRENCY, locale = "en-US") {
  assertFiniteNumber(amount, "amount");
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function normalizePresetName(name) {
  if (!name) return "online";
  const raw = String(name).trim();
  const lowered = raw.toLowerCase();

  for (const [key, preset] of Object.entries(DEFAULT_PRESETS)) {
    const names = [key, preset.name, preset.label, ...(preset.aliases || [])].map((value) => String(value).toLowerCase());
    if (names.includes(lowered)) return key;
  }

  return raw;
}

export function resolvePreset(preset = "online", customPresets = {}) {
  if (typeof preset === "object" && preset !== null) {
    return normalizeFeeProfile(preset, "custom");
  }

  const normalized = normalizePresetName(preset);

  if (customPresets && customPresets[normalized]) {
    return normalizeFeeProfile(customPresets[normalized], normalized);
  }

  if (DEFAULT_PRESETS[normalized]) {
    return { ...DEFAULT_PRESETS[normalized] };
  }

  throw new Error(`Unknown preset: ${preset}`);
}

export function normalizeFeeProfile(profile, fallbackName = "custom") {
  if (!profile || typeof profile !== "object") {
    throw new Error("Fee profile must be an object.");
  }

  const percent = Number(profile.percent ?? 0);
  const fixed = Number(profile.fixed ?? 0);

  assertNonNegativeNumber(percent, "profile.percent");
  assertNonNegativeNumber(fixed, "profile.fixed");

  const normalized = {
    name: profile.name || fallbackName,
    label: profile.label || profile.name || fallbackName,
    percent,
    fixed,
    currency: profile.currency || DEFAULT_CURRENCY
  };

  if (profile.cap !== undefined && profile.cap !== null) {
    assertNonNegativeNumber(Number(profile.cap), "profile.cap");
    normalized.cap = Number(profile.cap);
  }

  if (profile.description) normalized.description = profile.description;

  return normalized;
}

export function combineFeeProfile({
  preset = "online",
  customPresets = {},
  addons = [],
  customPercent = 0,
  customFixed = 0,
  oneTimePercent = 0,
  oneTimeFixed = 0,
  overridePercent,
  overrideFixed,
  currency
} = {}) {
  const base = resolvePreset(preset, customPresets);

  let percent = overridePercent !== undefined ? Number(overridePercent) : base.percent;
  let fixed = overrideFixed !== undefined ? Number(overrideFixed) : base.fixed;
  const cap = base.cap;
  const applied = [{ name: base.name, label: base.label, percent: base.percent, fixed: base.fixed, cap: base.cap }];

  assertNonNegativeNumber(percent, "percent");
  assertNonNegativeNumber(fixed, "fixed");

  for (const addon of addons || []) {
    const resolved = resolveAddon(addon);
    percent += resolved.percent || 0;
    fixed += resolved.fixed || 0;
    applied.push(resolved);
  }

  if (customPercent) {
    assertNonNegativeNumber(customPercent, "customPercent");
    percent += Number(customPercent);
    applied.push({ name: "customPercent", label: "Custom percent add-on", percent: Number(customPercent), fixed: 0 });
  }

  if (customFixed) {
    assertNonNegativeNumber(customFixed, "customFixed");
    fixed += Number(customFixed);
    applied.push({ name: "customFixed", label: "Custom fixed add-on", percent: 0, fixed: Number(customFixed) });
  }

  if (oneTimePercent) {
    assertNonNegativeNumber(oneTimePercent, "oneTimePercent");
    percent += Number(oneTimePercent);
    applied.push({ name: "oneTimePercent", label: "One-time percent fee", percent: Number(oneTimePercent), fixed: 0 });
  }

  if (oneTimeFixed) {
    assertNonNegativeNumber(oneTimeFixed, "oneTimeFixed");
    fixed += Number(oneTimeFixed);
    applied.push({ name: "oneTimeFixed", label: "One-time fixed fee", percent: 0, fixed: Number(oneTimeFixed) });
  }

  return {
    name: base.name,
    label: base.label,
    percent,
    fixed,
    cap,
    currency: currency || base.currency || DEFAULT_CURRENCY,
    applied
  };
}

export function resolveAddon(addon) {
  if (typeof addon === "object" && addon !== null) {
    return normalizeFeeProfile(addon, addon.name || "customAddon");
  }

  const raw = String(addon).trim();
  const lowered = raw.toLowerCase();

  if (DEFAULT_PRESETS.instantPayout.aliases.includes(lowered) || lowered === "instantpayout") {
    return { ...DEFAULT_PRESETS.instantPayout };
  }

  for (const [key, profile] of Object.entries(DEFAULT_ADDONS)) {
    const names = [key, profile.name, profile.label, ...(profile.aliases || [])].map((value) => String(value).toLowerCase());
    if (names.includes(lowered)) return { ...profile };
  }

  throw new Error(`Unknown add-on: ${addon}`);
}

export function calculateFee(amount, feeProfile) {
  assertNonNegativeNumber(amount, "amount");
  const profile = normalizeFeeProfile(feeProfile, "calculated");

  let fee = Number(amount) * profile.percent + profile.fixed;
  if (profile.cap !== undefined) {
    fee = Math.min(fee, profile.cap);
  }

  return fromCents(toCents(fee));
}

export function estimateStripeFee(amount, options = {}) {
  assertNonNegativeNumber(amount, "amount");

  const profile = combineFeeProfile(options);
  const fee = calculateFee(Number(amount), profile);
  const net = fromCents(toCents(amount) - toCents(fee));

  return {
    mode: "gross-to-net",
    gross: fromCents(toCents(amount)),
    fee,
    net,
    currency: profile.currency,
    profile
  };
}

export function estimateNet(amount, options = {}) {
  return estimateStripeFee(amount, options);
}

export function grossFromNet(targetNet, options = {}) {
  assertNonNegativeNumber(targetNet, "targetNet");

  const profile = combineFeeProfile(options);

  if (profile.cap !== undefined) {
    const uncappedGross = (Number(targetNet) + profile.fixed) / (1 - profile.percent);
    const uncappedFee = uncappedGross * profile.percent + profile.fixed;

    if (uncappedFee <= profile.cap) {
      return finishGrossFromNet(uncappedGross, Number(targetNet), profile);
    }

    const cappedGross = Number(targetNet) + profile.cap;
    return finishGrossFromNet(cappedGross, Number(targetNet), profile);
  }

  if (profile.percent >= 1) {
    throw new Error("Percent fee must be below 100% for reverse calculations.");
  }

  const gross = (Number(targetNet) + profile.fixed) / (1 - profile.percent);
  return finishGrossFromNet(gross, Number(targetNet), profile);
}

export function estimateGrossForTargetNet(targetNet, options = {}) {
  return grossFromNet(targetNet, options);
}

function finishGrossFromNet(gross, targetNet, profile) {
  const roundedGross = fromCents(Math.ceil(toCents(gross)));
  const fee = calculateFee(roundedGross, profile);
  const net = fromCents(toCents(roundedGross) - toCents(fee));

  return {
    mode: "net-to-gross",
    targetNet: fromCents(toCents(targetNet)),
    gross: roundedGross,
    fee,
    net,
    currency: profile.currency,
    profile
  };
}

export function parsePercent(value) {
  if (value === undefined || value === null || value === "") return 0;
  const text = String(value).trim();

  if (text.endsWith("%")) {
    const num = Number(text.slice(0, -1));
    if (!Number.isFinite(num)) throw new Error(`Invalid percent: ${value}`);
    return num / 100;
  }

  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error(`Invalid percent: ${value}`);
  return number > 1 ? number / 100 : number;
}

export function parseMoney(value) {
  if (value === undefined || value === null || value === "") return 0;
  const cleaned = String(value).replace(/[$,_\s]/g, "");
  const number = Number(cleaned);
  if (!Number.isFinite(number)) throw new Error(`Invalid amount: ${value}`);
  return number;
}

export function assertFiniteNumber(value, name) {
  if (!Number.isFinite(Number(value))) {
    throw new Error(`${name} must be a finite number.`);
  }
}

export function assertNonNegativeNumber(value, name) {
  assertFiniteNumber(value, name);
  if (Number(value) < 0) {
    throw new Error(`${name} must be non-negative.`);
  }
}

export function listBuiltInPresets() {
  return Object.values(DEFAULT_PRESETS).map((preset) => ({ ...preset }));
}

export function listBuiltInAddons() {
  return [
    ...Object.values(DEFAULT_ADDONS).map((addon) => ({ ...addon })),
    { ...DEFAULT_PRESETS.instantPayout }
  ];
}
