/**
 * Drives the real builder UI in headless Chrome. Reproduces the reported bug:
 * type into the action editor, then save, and assert the workflow is created
 * rather than the form reporting "Step 1: choose an action".
 */
import puppeteer from "puppeteer-core"

const BASE = "http://localhost:3000"
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

let failures = 0
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures += 1
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})

const page = await browser.newPage()
const consoleErrors = []
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text())
})
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`))

try {
  // ---- sign in -------------------------------------------------------------
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" })
  await page.type('input[name="email"], input[type="email"]', EMAIL)
  await page.type('input[name="password"], input[type="password"]', PASSWORD)
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
    page.click('button[type="submit"]'),
  ])
  check("signed in", !page.url().includes("/login"), page.url())

  // ---- open the builder ----------------------------------------------------
  await page.goto(`${BASE}/workflows/new`, { waitUntil: "networkidle0" })
  await page.waitForSelector("form", { timeout: 15000 })
  check("builder rendered", true)

  await page.type("#wf-name", "UI regression check")

  // Type into the action editor — this is what used to wipe the action.
  const urlInput = await page.$('input[placeholder*="example.com"]')
  check("found the action URL field", Boolean(urlInput))
  await urlInput.type("mock://ok")

  // Expand the step card body so the action fields are definitely present.
  const expanded = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label")]
    const l = labels.find((x) => x.textContent?.trim() === "Action type")
    if (!l) return "no-action-type-label"
    const trigger = document.getElementById(l.getAttribute("for") || "")
    return trigger ? "has-select" : "label-without-control"
  })
  check("action type control exists", expanded === "has-select", expanded)

  // The selected action must still be intact after typing.
  const actionText = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label")]
    const l = labels.find((x) => x.textContent?.trim() === "Action type")
    const trigger = l && document.getElementById(l.getAttribute("for") || "")
    return trigger?.textContent?.trim() ?? null
  })
  check("action still selected after typing", Boolean(actionText), String(actionText))

  // ---- save ---------------------------------------------------------------
  await page.click('button[type="submit"]')
  await new Promise((r) => setTimeout(r, 2500))

  const toast = await page.evaluate(() => document.body.innerText)
  const validationError = /choose an action|Fix \d+ problem/i.test(toast)
  check("no validation error on save", !validationError)

  const onDetail = /\/workflows\/[0-9a-f-]{36}/.test(page.url())
  check("navigated to the created workflow", onDetail, page.url())

  const nameShown = /UI regression check/.test(toast)
  check("created workflow name is shown", nameShown)

  if (consoleErrors.length) {
    console.log("\n  console errors:")
    for (const e of [...new Set(consoleErrors)].slice(0, 8)) console.log(`    - ${e}`)
  }
  check("no uncaught console errors", consoleErrors.length === 0)
} finally {
  await browser.close()
}

console.log(failures === 0 ? "\nUI regression suite passed" : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
