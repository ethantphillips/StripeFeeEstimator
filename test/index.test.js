import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateStripeFee,
  grossFromNet,
  parsePercent,
  calculateFee
} from "../src/index.js";

function nearlyEqual(actual, expected, epsilon = 0.0000001) {
  assert.ok(Math.abs(actual - expected) < epsilon, `Expected ${actual} to be close to ${expected}`);
}

test("estimates default online fee", () => {
  const result = estimateStripeFee(100);
  assert.equal(result.gross, 100);
  assert.equal(result.fee, 3.2);
  assert.equal(result.net, 96.8);
});

test("supports in-person profile", () => {
  const result = estimateStripeFee(100, { preset: "inPerson" });
  assert.equal(result.fee, 2.75);
  assert.equal(result.net, 97.25);
});

test("supports add-ons", () => {
  const result = estimateStripeFee(100, {
    addons: ["international", "currencyConversion"]
  });
  assert.equal(result.fee, 5.7);
  assert.equal(result.net, 94.3);
});

test("supports one-time custom fixed fee", () => {
  const result = estimateStripeFee(100, {
    oneTimeFixed: 2
  });
  assert.equal(result.fee, 5.2);
});

test("supports reverse calculation", () => {
  const result = grossFromNet(100);
  assert.equal(result.gross, 103.3);
  assert.equal(result.net, 100);
});

test("parses percent values", () => {
  nearlyEqual(parsePercent("2.9%"), 0.029);
  nearlyEqual(parsePercent("2.9"), 0.029);
  nearlyEqual(parsePercent("0.029"), 0.029);
});

test("supports capped fee profile", () => {
  const fee = calculateFee(1000, {
    percent: 0.008,
    fixed: 0,
    cap: 5
  });
  assert.equal(fee, 5);
});
