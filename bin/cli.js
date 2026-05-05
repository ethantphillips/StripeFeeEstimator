#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  DEFAULT_PRESETS,
  estimateStripeFee,
  grossFromNet,
  formatMoney,
  listBuiltInPresets,
  listBuiltInAddons,
  parseMoney,
  parsePercent
} from "../src/index.js";

const CONFIG_DIR = path.join(os.homedir(), ".stripe-fee-estimator");
const CONFIG_FILE = path.join(CONFIG_DIR, "presets.json");

main();

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (args.help || (args._.length === 0 && !args.net && !args.listPresets && !args.listAddons && !args.savePreset && !args.version)) {
      printHelp();
      return;
    }

    if (args.version) {
      printVersion();
      return;
    }

    if (args.listPresets) {
      printPresets();
      return;
    }

    if (args.listAddons) {
      printAddons();
      return;
    }

    if (args.savePreset) {
      savePreset(args);
      return;
    }

    const customPresets = readCustomPresets();
    const options = buildOptions(args, customPresets);

    const result = args.net
      ? grossFromNet(parseMoney(args.net), options)
      : estimateStripeFee(parseMoney(args._[0]), options);

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printResult(result, args);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error("Run `stripe-fee-estimator --help` for usage.");
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = { _: [], addons: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith("-")) {
      args._.push(arg);
      continue;
    }

    switch (arg) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-v":
      case "--version":
        args.version = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--quiet":
        args.quiet = true;
        break;
      case "--online":
        args.preset = "online";
        break;
      case "--in-person":
      case "--terminal":
        args.preset = "inPerson";
        break;
      case "--ach":
        args.preset = "ach";
        break;
      case "--instant-payout":
        args.addons.push("instantPayout");
        break;
      case "--manual":
        args.addons.push("manual");
        break;
      case "--international":
        args.addons.push("international");
        break;
      case "--currency-conversion":
      case "--conversion":
        args.addons.push("currencyConversion");
        break;
      case "--dispute-protection":
        args.addons.push("disputeProtection");
        break;
      case "--list-presets":
        args.listPresets = true;
        break;
      case "--list-addons":
        args.listAddons = true;
        break;
      case "--preset":
      case "-p":
        args.preset = requireValue(argv, ++i, arg);
        break;
      case "--net":
        args.net = requireValue(argv, ++i, arg);
        break;
      case "--percent":
        args.overridePercent = requireValue(argv, ++i, arg);
        break;
      case "--fixed":
        args.overrideFixed = requireValue(argv, ++i, arg);
        break;
      case "--add-percent":
        args.customPercent = requireValue(argv, ++i, arg);
        break;
      case "--add-fixed":
        args.customFixed = requireValue(argv, ++i, arg);
        break;
      case "--one-time-percent":
        args.oneTimePercent = requireValue(argv, ++i, arg);
        break;
      case "--one-time-fixed":
        args.oneTimeFixed = requireValue(argv, ++i, arg);
        break;
      case "--currency":
        args.currency = requireValue(argv, ++i, arg).toUpperCase();
        break;
      case "--save-preset":
        args.savePreset = requireValue(argv, ++i, arg);
        break;
      case "--label":
        args.label = requireValue(argv, ++i, arg);
        break;
      case "--description":
        args.description = requireValue(argv, ++i, arg);
        break;
      default:
        handleEqualsArg(args, arg);
    }
  }

  return args;
}

function handleEqualsArg(args, arg) {
  const [flag, ...rest] = arg.split("=");
  const value = rest.join("=");

  if (!value) throw new Error(`Unknown option: ${arg}`);

  const map = {
    "--preset": "preset",
    "--net": "net",
    "--percent": "overridePercent",
    "--fixed": "overrideFixed",
    "--add-percent": "customPercent",
    "--add-fixed": "customFixed",
    "--one-time-percent": "oneTimePercent",
    "--one-time-fixed": "oneTimeFixed",
    "--currency": "currency"
  };

  if (!map[flag]) throw new Error(`Unknown option: ${arg}`);
  args[map[flag]] = flag === "--currency" ? value.toUpperCase() : value;
}

function buildOptions(args, customPresets) {
  return {
    preset: args.preset || "online",
    customPresets,
    addons: args.addons || [],
    overridePercent: args.overridePercent === undefined ? undefined : parsePercent(args.overridePercent),
    overrideFixed: args.overrideFixed === undefined ? undefined : parseMoney(args.overrideFixed),
    customPercent: parsePercent(args.customPercent),
    customFixed: parseMoney(args.customFixed),
    oneTimePercent: parsePercent(args.oneTimePercent),
    oneTimeFixed: parseMoney(args.oneTimeFixed),
    currency: args.currency
  };
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith("-")) throw new Error(`${flag} requires a value.`);
  return value;
}

function readCustomPresets() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    throw new Error(`Could not read preset file at ${CONFIG_FILE}`);
  }
}

function writeCustomPresets(presets) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(presets, null, 2) + "\n");
}

function savePreset(args) {
  if (args.overridePercent === undefined && args.overrideFixed === undefined) {
    throw new Error("Saving a preset requires --percent and/or --fixed.");
  }

  const presets = readCustomPresets();
  const name = args.savePreset;

  presets[name] = {
    name,
    label: args.label || name,
    percent: args.overridePercent === undefined ? 0 : parsePercent(args.overridePercent),
    fixed: args.overrideFixed === undefined ? 0 : parseMoney(args.overrideFixed),
    currency: args.currency || "USD",
    description: args.description || "Custom saved preset."
  };

  writeCustomPresets(presets);
  console.log(`Saved preset "${name}" to ${CONFIG_FILE}`);
}

function printPresets() {
  const custom = readCustomPresets();

  console.log("Built-in presets:");
  for (const preset of listBuiltInPresets()) {
    console.log(`  ${preset.name.padEnd(14)} ${asPct(preset.percent)} + ${moneyRaw(preset.fixed, preset.currency)}${preset.cap ? `, capped at ${moneyRaw(preset.cap, preset.currency)}` : ""} — ${preset.label}`);
  }

  const customEntries = Object.values(custom);
  if (customEntries.length) {
    console.log("\nCustom presets:");
    for (const preset of customEntries) {
      console.log(`  ${preset.name.padEnd(14)} ${asPct(preset.percent)} + ${moneyRaw(preset.fixed, preset.currency || "USD")} — ${preset.label || preset.name}`);
    }
  }
}

function printAddons() {
  console.log("Built-in add-ons:");
  for (const addon of listBuiltInAddons()) {
    console.log(`  ${addon.name.padEnd(20)} ${asPct(addon.percent)} + ${moneyRaw(addon.fixed || 0, "USD")} — ${addon.label}`);
  }
}

function printResult(result, args) {
  const currency = result.currency;

  if (result.mode === "net-to-gross") {
    console.log(`Target net: ${formatMoney(result.targetNet, currency)}`);
    console.log(`Charge:     ${formatMoney(result.gross, currency)}`);
    console.log(`Fee:        ${formatMoney(result.fee, currency)}`);
    console.log(`You get:    ${formatMoney(result.net, currency)}`);
  } else {
    console.log(`Gross:      ${formatMoney(result.gross, currency)}`);
    console.log(`Fee:        ${formatMoney(result.fee, currency)}`);
    console.log(`You get:    ${formatMoney(result.net, currency)}`);
  }

  if (!args.quiet) {
    console.log("");
    console.log(`Profile:    ${result.profile.label}`);
    console.log(`Rate:       ${asPct(result.profile.percent)} + ${moneyRaw(result.profile.fixed, currency)}${result.profile.cap ? `, capped at ${moneyRaw(result.profile.cap, currency)}` : ""}`);

    const extras = result.profile.applied.slice(1);
    if (extras.length) {
      console.log("Add-ons:");
      for (const extra of extras) {
        console.log(`  - ${extra.label}: ${asPct(extra.percent || 0)} + ${moneyRaw(extra.fixed || 0, currency)}`);
      }
    }
  }
}

function moneyRaw(value, currency = "USD") {
  return formatMoney(Number(value || 0), currency);
}

function asPct(value) {
  return `${(Number(value || 0) * 100).toFixed(3).replace(/\.?0+$/, "")}%`;
}

function printVersion() {
  const pkgUrl = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(pkgUrl, "utf8"));
  console.log(pkg.version);
}

function printHelp() {
  console.log(`stripe-fee-estimator

Estimate Stripe-style processing fees and reverse-calculate charges.

Usage:
  stripe-fee-estimator <amount> [options]
  stripe-fee-estimator --net <targetNet> [options]
  stripe-fee-estimator --save-preset <name> --percent <rate> --fixed <amount>

Examples:
  stripe-fee-estimator 100
  stripe-fee-estimator 100 --in-person
  stripe-fee-estimator 100 --online --international --currency-conversion
  stripe-fee-estimator --net 100
  stripe-fee-estimator 100 --percent 2.9% --fixed 0.30
  stripe-fee-estimator 100 --add-percent 1.5% --add-fixed 0.10
  stripe-fee-estimator 100 --one-time-fixed 2.00
  stripe-fee-estimator --save-preset schoolclub --percent 2.5% --fixed 0.25
  stripe-fee-estimator 100 --preset schoolclub

Built-in base presets:
  --online                Online card estimate, default
  --in-person             In-person / Terminal estimate
  --ach                   ACH estimate

Built-in add-ons:
  --manual                Add manually entered card fee
  --international         Add international card fee
  --currency-conversion   Add currency conversion fee
  --dispute-protection    Add dispute protection fee
  --instant-payout        Add instant payout fee estimate

Custom fee controls:
  --preset, -p <name>          Use a built-in or saved preset
  --percent <rate>             Override base percent, e.g. 2.9% or 0.029
  --fixed <amount>             Override base fixed fee
  --add-percent <rate>         Add a custom percent fee
  --add-fixed <amount>         Add a custom fixed fee
  --one-time-percent <rate>    Add a one-time percent fee
  --one-time-fixed <amount>    Add a one-time fixed fee
  --currency <code>            Display currency, default USD

Preset management:
  --save-preset <name>    Save a custom preset to your home folder
  --label <text>          Label for saved preset
  --description <text>    Description for saved preset
  --list-presets          Show built-in and saved presets
  --list-addons           Show built-in add-ons

Output:
  --json                  Print JSON
  --quiet                 Hide profile details
  --version, -v           Show version
  --help, -h              Show help

Disclaimer:
  This tool provides estimates only. Actual Stripe pricing can vary by country,
  payment method, custom contract, taxes, disputes, Connect, payout type, and other products.
`);
}
