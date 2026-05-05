# stripe-fee-estimator

Estimate Stripe-style processing fees from the command line or from JavaScript.

This package supports normal gross-to-net estimates, reverse calculations for target net payouts, built-in fee variations, custom one-time fees, and saved custom presets.

> Disclaimer: This tool provides estimates only. Actual Stripe pricing can vary by country, payment method, custom pricing, taxes, disputes, Connect, payout method, and other Stripe products. Always verify against your Stripe Dashboard and Stripe's official pricing page.

## Install

```bash
npm install -g stripe-fee-estimator
```

Or run without installing:

```bash
npx stripe-fee-estimator 100
```

## CLI usage

```bash
stripe-fee-estimator 100
```

Example output:

```txt
Gross:      $100.00
Fee:        $3.20
You get:    $96.80

Profile:    Online domestic card
Rate:       2.9% + $0.30
```

Reverse-calculate the amount to charge:

```bash
stripe-fee-estimator --net 100
```

```txt
Target net: $100.00
Charge:     $103.30
Fee:        $3.30
You get:    $100.00
```

## Built-in fee profiles

```bash
stripe-fee-estimator 100 --online
stripe-fee-estimator 100 --in-person
stripe-fee-estimator 100 --ach
```

## Built-in variations

```bash
stripe-fee-estimator 100 --manual
stripe-fee-estimator 100 --international
stripe-fee-estimator 100 --currency-conversion
stripe-fee-estimator 100 --dispute-protection
stripe-fee-estimator 100 --instant-payout
```

You can combine them:

```bash
stripe-fee-estimator 100 --online --international --currency-conversion
```

## Custom one-time fees

Add a one-time fixed amount:

```bash
stripe-fee-estimator 100 --one-time-fixed 2.00
```

Add a one-time percentage:

```bash
stripe-fee-estimator 100 --one-time-percent 1.5%
```

Add custom recurring-style fee components:

```bash
stripe-fee-estimator 100 --add-percent 1.5% --add-fixed 0.10
```

Override the base fee entirely:

```bash
stripe-fee-estimator 100 --percent 2.9% --fixed 0.30
```

## Saved custom presets

Save a preset:

```bash
stripe-fee-estimator --save-preset schoolclub --percent 2.5% --fixed 0.25 --label "School club processor"
```

Use it later:

```bash
stripe-fee-estimator 100 --preset schoolclub
```

List presets:

```bash
stripe-fee-estimator --list-presets
```

Saved presets are stored locally at:

```txt
~/.stripe-fee-estimator/presets.json
```

## JSON output

```bash
stripe-fee-estimator 100 --json
```

## JavaScript usage

```js
import { estimateStripeFee, grossFromNet } from "stripe-fee-estimator";

const estimate = estimateStripeFee(100, {
  preset: "online",
  addons: ["international", "currencyConversion"]
});

console.log(estimate.net);

const charge = grossFromNet(100, {
  preset: "online"
});

console.log(charge.gross);
```

## API

### `estimateStripeFee(amount, options)`

Calculates fee and net amount from a gross charge.

### `grossFromNet(targetNet, options)`

Calculates the approximate gross charge needed to receive a target net amount.

### Options

```js
{
  preset: "online",
  addons: ["international"],
  customPercent: 0.015,
  customFixed: 0.10,
  oneTimePercent: 0.01,
  oneTimeFixed: 2.00,
  overridePercent: 0.029,
  overrideFixed: 0.30,
  currency: "USD"
}
```

## Publish checklist

Before publishing:

```bash
npm test
npm pack --dry-run
npm login
npm publish --access public
```

For updates:

```bash
npm version patch
npm publish
```

## Repository

GitHub repository:

```txt
https://github.com/ethantphillips/stripefeeestimator
```

## License

MIT
