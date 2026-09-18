import { Locator, launch } from 'puppeteer'
import * as utils from '../utils.js'

export async function newItems({ address, email, items, password, type, variables }) {
  const browser = await launch({
    // headless: false,
    args: [
      `--host-resolver-rules=MAP sauce-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN} ${address}`
    ]
  })
  const targetPage = await browser.newPage()

  const timeout = 20000
  targetPage.setDefaultTimeout(timeout)

  // Email, account name page
  {
    await targetPage.setViewport({
      width: 1280,
      height: 1200
    })
  }
  {
    await targetPage.goto(`https://sauce-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/#/signup`)
  }
  {
    await Locator.race([
      targetPage.locator('#register-start_form_input_email')
    ]).setTimeout(timeout)
      .fill(email)
  }
  {
    await Locator.race([
      targetPage.locator('#register-start_form_input_name')
    ]).setTimeout(timeout)
      .fill(email)
  }
  {
    await Locator.race([
      targetPage.locator('button')
    ]).setTimeout(timeout)
      .click()
  }
  // Password page
  {
    await Locator.race([
      targetPage.locator('#input-password-form_new-password')
    ]).setTimeout(timeout)
      .fill(password)
  }
  {
    await Locator.race([
      targetPage.locator('#input-password-form_new-password-confirm')
    ]).setTimeout(timeout)
      .fill(password)
  }
  {
    await Locator.race([
      targetPage.locator('#input-password-form_check-for-breaches')
    ]).setTimeout(timeout)
      .click()
  }
  {
    await Locator.race([
      targetPage.locator('button[type="submit"]')
    ]).setTimeout(timeout)
      .click()
  }
  // Skip onboarding items "Add it later""
  {
    await Locator.race([
      targetPage.locator('::-p-aria(Add it later)')
    ]).setTimeout(timeout)
      .click()
  }
  {
    await Locator.race([
      targetPage.locator('a[buttontype="secondary"]')
    ]).setTimeout(timeout)
      .click()
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(Skip)')
    ]).setTimeout(timeout)
      .click()
      .catch(() => {})
  }
  // Get API key
  {
    await targetPage.goto(`https://sauce-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/#/settings/security/security-keys`)
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(View API key)')
    ]).setTimeout(timeout)
      .click()
  }
  {
    await Locator.race([
      targetPage.locator('#masterPassword')
    ]).setTimeout(timeout)
      .fill(password)
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(API Key[role="dialog"]) ::-p-aria(View API key)')
    ]).setTimeout(timeout)
      .click()
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(OAuth 2.0 Client Credentials)')
    ]).setTimeout(timeout).wait()
    const elements = await targetPage.$$('code')

    variables.unshift([
      await elements[0].evaluate(element => element.innerText),
      await elements[1].evaluate(element => element.innerText),
      password,
    ])
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(API Key[role="dialog"]) ::-p-aria(Close)')
    ]).setTimeout(timeout)
      .click()
  }
  // Import items
  {
    await targetPage.goto(`https://sauce-production.${process.env.ALIAJS_DEFAULT_TOP_LEVEL_DOMAIN}/#/tools/import`)
  }
  {
    await targetPage.waitForSelector('#bit-form-field-10-search', { visible: true, timeout })
    await targetPage.evaluate(() => {
      const element = document.getElementById('bit-form-field-10-search')
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
    })
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(Bitwarden (json))')
    ]).setTimeout(timeout)
      .click()
  }
  {
    if (type === 'operations') {
      items.push({ name: 'variables', notes: JSON.stringify(variables) })
    }
    const JSONitems = utils.importItems({ items })
    await Locator.race([
      targetPage.locator('#import_textarea_fileContents')
    ]).setTimeout(timeout)
      .fill(JSONitems)
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(Import[role="button"])')
    ]).setTimeout(timeout)
      .click()
  }
  {
    await Locator.race([
      targetPage.locator('::-p-aria(Ok[role="button"])')
    ]).setTimeout(timeout)
      .click()
  }
  await browser.close()
}
