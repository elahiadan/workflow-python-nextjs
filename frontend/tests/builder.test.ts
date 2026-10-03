import assert from "node:assert/strict"

import {
  applyStepPatch,
  emptyDraft,
  newStep,
  toPayload,
  validateDraft,
  type Draft,
} from "../src/lib/builder/draft.ts"

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`  ok  ${name}`)
}

function draftWith(step = newStep("action")): Draft {
  return { ...emptyDraft(), name: "Test", steps: [step] }
}

test("a new action step is valid out of the box", () => {
  assert.deepEqual(validateDraft(draftWith()), [])
})

test("config edits must not clear the action (regression)", () => {
  const step = newStep("action")
  // This is the exact patch the action editor used to emit: `action` present
  // but undefined, because it only intended to update the config.
  const before = step.action
  const after = applyStepPatch(step, {
    action: undefined as unknown as string,
    config: { ...step.config, url: "https://example.com" },
  })
  assert.equal(after.action, before, "action must survive a config edit")
  assert.equal(after.config.url, "https://example.com")
  assert.deepEqual(validateDraft(draftWith(after)), [])
})

test("repeated config edits never drift into an invalid draft", () => {
  let step = newStep("action")
  for (const url of ["https://a.test", "https://b.test", "https://c.test"]) {
    step = applyStepPatch(step, {
      action: undefined as unknown as string,
      config: { ...step.config, url },
    })
  }
  assert.equal(step.action, "http_request")
  assert.equal(step.config.url, "https://c.test")
  assert.deepEqual(validateDraft(draftWith(step)), [])
})

test("a real action change is still applied", () => {
  const step = applyStepPatch(newStep("action"), {
    action: "send_slack_message",
    config: { text: "hi" },
    name: "",
  })
  assert.equal(step.action, "send_slack_message")
  assert.equal(toPayload(draftWith(step)).steps[0].action, "send_slack_message")
})

test("an action step with no action is still rejected", () => {
  const step = { ...newStep("action"), action: null }
  assert.deepEqual(validateDraft(draftWith(step)), ["Step 1: choose an action."])
})

test("condition steps require a field", () => {
  const step = newStep("condition")
  assert.deepEqual(validateDraft(draftWith(step)), ["Step 1: condition needs a field."])
  const filled = applyStepPatch(step, { config: { ...step.config, field: "order.total" } })
  assert.deepEqual(validateDraft(draftWith(filled)), [])
})

test("reliability bounds are enforced", () => {
  const step = applyStepPatch(newStep("action"), { max_attempts: 99 })
  assert.deepEqual(validateDraft(draftWith(step)), [
    "Step 1: max attempts must be between 1 and 10.",
  ])
})

test("conditions serialise with a null action", () => {
  const step = applyStepPatch(newStep("condition"), {
    config: { ...newStep("condition").config, field: "a.b" },
  })
  assert.equal(toPayload(draftWith(step)).steps[0].action, null)
})

console.log(`\n${passed} passed`)
