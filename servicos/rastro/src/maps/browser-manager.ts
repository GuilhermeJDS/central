import path from "node:path";
import fs from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright";

class BrowserManager {
  private context?: Promise<BrowserContext>;
  private active = 0;
  private waiters: Array<() => void> = [];
  private sessions = new Map<string, Page>();
  readonly profileDir = path.resolve(process.cwd(), ".local", "rastro-profile");

  private async getContext() {
    return this.context ||= (async () => {
      await fs.mkdir(this.profileDir, { recursive: true });
      const context = await chromium.launchPersistentContext(this.profileDir, { headless: process.env.GOOGLE_MAPS_HEADLESS === "1", locale: "pt-BR", viewport: { width: 1440, height: 900 }, args: ["--lang=pt-BR"] });
      // Janela fechada (à mão ou por queda do Chromium): esquece o contexto para a próxima busca abrir outro,
      // em vez de responder erro_interno para sempre.
      context.on("close", () => { this.context = undefined; this.sessions.clear(); this.active = 0; this.waiters.splice(0).forEach(w => w()); });
      return context;
    })().catch(error => { this.context = undefined; throw error; });
  }
  async page(sessionId: string): Promise<Page> {
    const retained = this.sessions.get(sessionId); if (retained && !retained.isClosed()) { await retained.bringToFront(); return retained; }
    if (this.active >= 2) await new Promise<void>(resolve => this.waiters.push(resolve));
    this.active++;
    const context = await this.getContext();
    const existing = context.pages().find(p => p.url() === "about:blank");
    const page = existing || await context.newPage(); this.sessions.set(sessionId, page); return page;
  }
  async release(sessionId: string, page: Page, retain = false) { if (retain) { await page.bringToFront().catch(() => undefined); return; } this.sessions.delete(sessionId); await page.close().catch(() => undefined); this.active--; this.waiters.shift()?.(); }
  async focus(sessionId: string) { const page = this.sessions.get(sessionId); if (page && !page.isClosed()) { await page.bringToFront(); return true; } return false; }
  async close() { if (this.context) await (await this.context).close().catch(() => undefined); this.context = undefined; }
  async executablePath() { return chromium.executablePath(); }
}

const globalState = globalThis as unknown as { rastroMapsBrowser?: BrowserManager };
export const mapsBrowser = globalState.rastroMapsBrowser ||= new BrowserManager();
