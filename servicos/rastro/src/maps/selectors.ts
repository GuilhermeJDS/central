import type { Page, Locator } from "playwright";

export async function findResultsFeed(page: Page): Promise<Locator | null> {
  const semantic = page.getByRole("feed");
  if (await semantic.count()) return semantic.first();
  const labelled = page.locator('[role="feed"][aria-label], div[aria-label*="Resultados" i], div[aria-label*="Results" i]');
  return await labelled.count() ? labelled.first() : null;
}

export async function waitForResultsFeed(page: Page, timeout = 30000): Promise<Locator | null> {
 const deadline = Date.now() + timeout;
 while (Date.now() < deadline) { const feed = await findResultsFeed(page); if (feed && await feed.isVisible().catch(() => false)) return feed; if (await getResultCards(page).count()) return findResultsFeed(page); await page.waitForTimeout(500); }
 return null;
}

export function getResultCards(page: Page, feed?: Locator | null) {
  return (feed || page).locator('a[href*="/maps/place/"]');
}

export async function acceptNormalConsent(page: Page) {
  for (const name of [/Aceitar tudo/i, /Accept all/i, /Concordo/i]) {
    const button = page.getByRole("button", { name });
    if (await button.count()) { await button.first().click().catch(() => undefined); break; }
  }
}

export async function actionRequiredReason(page: Page): Promise<string | null> {
  const text = (await page.locator("body").innerText({ timeout: 5000 }).catch(() => "")).slice(0, 20000);
  if (/unusual traffic|tráfego incomum|captcha|recaptcha|verify you are human|confirme que você não é um robô|challenge/i.test(text)) return "O Google Maps solicitou verificação humana.";
  if (/sign in to continue|faça login para continuar/i.test(text)) return "O Google Maps solicitou login ou confirmação manual.";
  return null;
}
