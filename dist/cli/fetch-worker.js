import { n as getFetchWorkerPidPath, r as getFetchWorkerSocketPath, t as ensureFetchWorkerDir } from "./worker-protocol-CwUGmQX9.js";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { connect, createServer } from "node:net";
import { createInterface } from "node:readline";
import { chromium } from "playwright-core";
// src/core/web/fetchers/local/browser-executable.ts
function chromePaths(platform, env) {
	switch (platform) {
		case "darwin": return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
		case "win32": return [
			env.LOCALAPPDATA,
			env.PROGRAMFILES,
			env["PROGRAMFILES(X86)"]
		].flatMap((root) => root ? [path.win32.join(root, "Google", "Chrome", "Application", "chrome.exe")] : []);
		default: return ["/opt/google/chrome/chrome"];
	}
}
function onPath(names, env) {
	const dirs = (env.PATH ?? "").split(path.delimiter).filter((dir) => dir.length > 0);
	return names.flatMap((name) => dirs.map((dir) => path.join(dir, name)));
}
function resolveBrowserExecutable(configured, playwrightChromium, platform, env, exists) {
	if (configured) return {
		path: configured,
		needsInstall: false
	};
	const found = [...chromePaths(platform, env), ...onPath(["chromium", "chromium-browser"], env)].filter((candidate) => exists(candidate)).at(0);
	if (found) return {
		path: found,
		needsInstall: false
	};
	return {
		path: playwrightChromium,
		needsInstall: !exists(playwrightChromium)
	};
}
// src/core/web/fetchers/local/browser-session.ts
var BrowserSession = class {
	options;
	contextPromise = null;
	interactiveContext = null;
	interactiveOpen = false;
	availableSlots;
	slotWaiters = [];
	escalation = null;
	activeHeadlessFetches = 0;
	drainWaiters = [];
	headlessUserAgent = {
		probed: false,
		userAgent: void 0
	};
	constructor(options) {
		this.options = options;
		this.availableSlots = options.maxConcurrentPages;
	}
	get isInteractiveOpen() {
		return this.interactiveOpen;
	}
	async fetch(operation) {
		try {
			return await this.headlessFetch(operation);
		} catch (error) {
			if (operation.shouldEscalate(error)) return this.escalatedFetch(operation);
			throw error;
		}
	}
	async openInteractive() {
		if (this.interactiveOpen) throw new Error("interactive browser is already open");
		const headless = this.contextPromise ? await this.contextPromise.catch(() => null) : null;
		this.contextPromise = null;
		await headless?.close().catch(() => {});
		this.setInteractiveOpen(true);
		try {
			const context = await this.options.launcher.launch(false);
			this.interactiveContext = context;
			context.on("close", () => {
				if (this.interactiveContext !== context) return;
				this.interactiveContext = null;
				this.setInteractiveOpen(false);
			});
		} catch (error) {
			this.setInteractiveOpen(false);
			throw this.options.interactiveLaunchError(error);
		}
	}
	async close() {
		const headless = this.contextPromise ? await this.contextPromise.catch(() => null) : null;
		this.contextPromise = null;
		await headless?.close().catch(() => {});
		const interactive = this.interactiveContext;
		await interactive?.close().catch(() => {});
		if (this.interactiveContext === interactive) {
			this.interactiveContext = null;
			if (this.interactiveOpen) this.setInteractiveOpen(false);
		}
	}
	async headlessFetch(operation) {
		while (this.escalation) await this.escalation;
		this.activeHeadlessFetches += 1;
		try {
			this.assertNotInteractive();
			const context = await this.getContext();
			return await this.withPageSlot(async () => {
				operation.onStarted();
				return operation.headless(context);
			});
		} finally {
			this.activeHeadlessFetches -= 1;
			if (this.activeHeadlessFetches === 0) for (const wake of this.drainWaiters.splice(0)) wake();
		}
	}
	async escalatedFetch(operation) {
		while (this.escalation) {
			await this.escalation;
			try {
				return await this.headlessFetch({
					...operation,
					onStarted: () => {}
				});
			} catch (error) {
				if (!operation.shouldEscalate(error)) throw error;
			}
		}
		let release;
		this.escalation = new Promise((resolve) => {
			release = resolve;
		});
		try {
			while (this.activeHeadlessFetches > 0) await new Promise((resolve) => this.drainWaiters.push(resolve));
			this.assertNotInteractive();
			const headless = this.contextPromise ? await this.contextPromise.catch(() => null) : null;
			this.contextPromise = null;
			await headless?.close().catch(() => {});
			let headed;
			try {
				headed = await this.options.launcher.launch(false);
			} catch (error) {
				throw this.options.headedLaunchError(error);
			}
			try {
				return await operation.headed(headed);
			} finally {
				await headed.close().catch(() => {});
			}
		} finally {
			this.escalation = null;
			release();
		}
	}
	async getContext() {
		this.contextPromise ??= this.launchContext();
		try {
			return await this.contextPromise;
		} catch (error) {
			this.contextPromise = null;
			throw error;
		}
	}
	async launchContext() {
		try {
			const context = await this.launchHeadlessWithNormalUserAgent();
			context.on("close", () => {
				this.contextPromise = null;
			});
			return context;
		} catch (error) {
			throw this.options.headlessLaunchError(error);
		}
	}
	async launchHeadlessWithNormalUserAgent() {
		if (this.headlessUserAgent.probed) return this.options.launcher.launch(true, this.headlessUserAgent.userAgent);
		const probe = await this.options.launcher.launch(true);
		const userAgent = await this.options.launcher.probeUserAgent(probe);
		if (userAgent === null) return probe;
		if (!userAgent.includes("HeadlessChrome")) {
			this.headlessUserAgent = {
				probed: true,
				userAgent: void 0
			};
			return probe;
		}
		await probe.close().catch(() => {});
		this.headlessUserAgent = {
			probed: true,
			userAgent: userAgent.replace("HeadlessChrome", "Chrome")
		};
		return this.options.launcher.launch(true, this.headlessUserAgent.userAgent);
	}
	async withPageSlot(work) {
		if (this.availableSlots > 0) this.availableSlots -= 1;
		else await new Promise((resolve) => this.slotWaiters.push(resolve));
		try {
			return await work();
		} finally {
			const next = this.slotWaiters.shift();
			if (next) next();
			else this.availableSlots += 1;
		}
	}
	assertNotInteractive() {
		if (this.interactiveOpen) throw new Error(this.options.interactiveConflictMessage);
	}
	setInteractiveOpen(open) {
		this.interactiveOpen = open;
		this.options.onInteractiveStateChange?.(open);
	}
};
// src/core/web/fetchers/local/http-status.ts
function throwForHttpError(status, url) {
	if (status >= 400) throw new Error(`HTTP ${status} while fetching ${url}`);
}
// src/core/web/fetchers/local/fetch-worker.ts
ensureFetchWorkerDir();
const SOCK = getFetchWorkerSocketPath();
const PIDFILE = getFetchWorkerPidPath();
const NAVIGATION_TIMEOUT_MS = 15e3;
const NETWORK_IDLE_GRACE_MS = 2e3;
const IDLE_EXIT_MS = 3e5;
const MAX_CONCURRENT_PAGES = 6;
const MAX_PAYLOAD_BYTES = 104857600;
const configArg = process.argv[2];
if (!configArg) {
	console.error("usage: fetch-worker <config-json>");
	process.exit(1);
}
const config = JSON.parse(configArg);
const { profileDir, executablePath } = config;
async function probeUserAgent(context) {
	try {
		const page = await context.newPage();
		const userAgent = await Promise.race([page.evaluate(() => navigator.userAgent), new Promise((resolve) => setTimeout(() => resolve(null), 1e4))]);
		await page.close().catch(() => {});
		return userAgent;
	} catch {
		return null;
	}
}
const pendingNotes = [];
function installPlaywrightChromium() {
	const cli = path.join(path.dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "cli.js");
	return new Promise((resolve, reject) => {
		let output = "";
		const child = spawn(process.execPath, [
			cli,
			"install",
			"chromium"
		], { stdio: [
			"ignore",
			"pipe",
			"pipe"
		] });
		child.stdout.on("data", (chunk) => output += chunk.toString());
		child.stderr.on("data", (chunk) => output += chunk.toString());
		child.on("error", reject);
		child.on("exit", (code) => code === 0 ? resolve() : reject(/* @__PURE__ */ new Error(`installing Playwright's Chromium failed: ${output.trim()}`)));
	});
}
let browserExecutable = null;
async function resolveBrowser() {
	const resolved = resolveBrowserExecutable(executablePath, chromium.executablePath(), process.platform, process.env, existsSync);
	if (resolved.needsInstall) {
		await installPlaywrightChromium();
		pendingNotes.push(`installed Playwright's Chromium at ${resolved.path}, since neither Google Chrome nor a chromium on PATH exists`);
	}
	return resolved;
}
async function launchPersistent(headless, userAgent) {
	await mkdir(profileDir, { recursive: true });
	browserExecutable ??= resolveBrowser().catch((error) => {
		browserExecutable = null;
		throw error;
	});
	return chromium.launchPersistentContext(profileDir, {
		headless,
		acceptDownloads: true,
		...userAgent ? { userAgent } : {},
		executablePath: (await browserExecutable).path
	});
}
const browserSession = new BrowserSession({
	launcher: {
		launch: launchPersistent,
		probeUserAgent
	},
	maxConcurrentPages: MAX_CONCURRENT_PAGES,
	interactiveConflictMessage: "interactive browser is open — quit Chrome to resume fetching",
	headlessLaunchError: (error) => /* @__PURE__ */ new Error(`could not launch browser: ${errorMessage(error)} — set web.fetch.browser.executablePath in the librarian settings to choose another`),
	headedLaunchError: (error) => /* @__PURE__ */ new Error(`${CHALLENGE_BLOCKED_MESSAGE} (headed escalation failed: ${errorMessage(error)})`),
	interactiveLaunchError: (error) => /* @__PURE__ */ new Error(`could not open the interactive browser: ${errorMessage(error)}`),
	onInteractiveStateChange: (open) => {
		if (open && idleTimer) clearTimeout(idleTimer);
		if (!open) resetIdleTimer();
	}
});
async function handleFetch(url, downloadDir, onStarted) {
	await mkdir(downloadDir, { recursive: true });
	return browserSession.fetch({
		onStarted,
		shouldEscalate: (error) => error instanceof ChallengeUnresolvedError,
		headless: (context) => fetchInContext(context, url, downloadDir, {
			waitSecs: config.challenge.headlessWaitSecs,
			escalatable: config.challenge.escalation === "headed"
		}),
		headed: (context) => {
			const startedAt = Date.now();
			return fetchInContext(context, url, downloadDir, {
				waitSecs: config.challenge.headedWaitSecs,
				startedAt,
				escalatable: false
			});
		}
	});
}
async function fetchInContext(context, url, downloadDir, challengeWait) {
	const page = await context.newPage();
	try {
		return await fetchWithPage(page, url, downloadDir, challengeWait);
	} finally {
		await page.close().catch(() => {});
	}
}
async function fetchWithPage(page, url, downloadDir, challengeWait) {
	const downloadPromise = page.waitForEvent("download", { timeout: NAVIGATION_TIMEOUT_MS }).catch(() => null);
	let response;
	try {
		response = await page.goto(url, {
			waitUntil: "load",
			timeout: NAVIGATION_TIMEOUT_MS
		});
	} catch (error) {
		const download = await downloadPromise;
		if (!download) throw error;
		return saveDownload(download, downloadDir);
	}
	if (!response) throw new Error("navigation returned no response");
	if (response.headers()["cf-mitigated"] === "challenge") response = await resolveChallenge(page, (challengeWait.startedAt ?? Date.now()) + challengeWait.waitSecs * 1e3, challengeWait.escalatable);
	const finalUrl = page.url();
	throwForHttpError(response.status(), finalUrl);
	const contentType = await page.evaluate(() => document.contentType).catch(() => null) ?? await response.headerValue("content-type") ?? "";
	if (isHtmlContentType(contentType)) {
		await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_GRACE_MS }).catch(() => {});
		const html = await capturePageHtml(page);
		const bytes = Buffer.byteLength(html, "utf8");
		assertWithinCap(bytes);
		const name = "page.html";
		await writeFile(path.join(downloadDir, name), html);
		const title = (await page.title()).trim();
		return {
			finalUrl,
			name,
			contentType,
			bytes,
			...title ? { title } : {}
		};
	}
	const apiResponse = await page.context().request.get(finalUrl, { timeout: NAVIGATION_TIMEOUT_MS });
	throwForHttpError(apiResponse.status(), finalUrl);
	const body = await apiResponse.body();
	assertWithinCap(body.byteLength);
	const headers = apiResponse.headers();
	const name = payloadFilename(headers["content-disposition"], finalUrl);
	await writeFile(path.join(downloadDir, name), body);
	return {
		finalUrl,
		name,
		contentType: headers["content-type"] ?? contentType,
		bytes: body.byteLength
	};
}
const CHALLENGE_BLOCKED_MESSAGE = "blocked by a bot-detection challenge (cloudflare) — run `/browser open` to resolve it manually";
var ChallengeUnresolvedError = class extends Error {
	constructor() {
		super(CHALLENGE_BLOCKED_MESSAGE);
	}
};
async function resolveChallenge(page, deadlineAt, escalatable) {
	const remainingMs = () => Math.max(deadlineAt - Date.now(), 1);
	const response = await page.waitForResponse((response) => response.request().isNavigationRequest() && response.frame() === page.mainFrame() && response.headers()["cf-mitigated"] !== "challenge", { timeout: remainingMs() }).catch(() => null);
	if (!response) {
		if (escalatable) throw new ChallengeUnresolvedError();
		throw new Error(CHALLENGE_BLOCKED_MESSAGE);
	}
	await page.waitForLoadState("load", { timeout: remainingMs() }).catch(() => {});
	return response;
}
async function handleOpenBrowser() {
	await browserSession.openInteractive();
}
async function capturePageHtml(page) {
	return await page.evaluate(() => {
		if (typeof document.documentElement.getHTML !== "function") return null;
		const collect = (root, acc) => {
			for (const el of root.querySelectorAll("*")) if (el.shadowRoot) {
				acc.push(el.shadowRoot);
				collect(el.shadowRoot, acc);
			}
			return acc;
		};
		return document.documentElement.getHTML({ shadowRoots: collect(document, []) });
	}).catch(() => null) ?? await page.content();
}
async function saveDownload(download, downloadDir) {
	const name = sanitizeFilename(download.suggestedFilename());
	const file = path.join(downloadDir, name);
	await download.saveAs(file);
	const { size } = await stat(file);
	if (size > MAX_PAYLOAD_BYTES) {
		await unlink(file).catch(() => {});
		throw new Error(`response is ${size} bytes; the limit is ${MAX_PAYLOAD_BYTES}`);
	}
	return {
		finalUrl: download.url(),
		name,
		contentType: "application/octet-stream",
		bytes: size
	};
}
function isHtmlContentType(contentType) {
	const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return mime === "text/html" || mime === "application/xhtml+xml";
}
function assertWithinCap(bytes) {
	if (bytes > MAX_PAYLOAD_BYTES) throw new Error(`response is ${bytes} bytes; the limit is ${MAX_PAYLOAD_BYTES}`);
}
function payloadFilename(disposition, finalUrl) {
	const dispositionName = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];
	if (dispositionName) return sanitizeFilename(decodeURIComponent(dispositionName));
	try {
		const urlName = path.posix.basename(new URL(finalUrl).pathname);
		if (urlName) return sanitizeFilename(urlName);
	} catch {}
	return "download";
}
function sanitizeFilename(name) {
	const cleaned = path.basename(name.trim()).replace(/[/\\]/g, "-");
	return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : "download";
}
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
let inflight = 0;
let idleTimer = null;
function resetIdleTimer() {
	if (idleTimer) clearTimeout(idleTimer);
	if (browserSession.isInteractiveOpen) return;
	idleTimer = setTimeout(() => {
		if (inflight > 0) {
			resetIdleTimer();
			return;
		}
		shutdown(0);
	}, IDLE_EXIT_MS);
}
let cleanedUp = false;
async function shutdown(code) {
	if (!cleanedUp) {
		cleanedUp = true;
		server.close();
		for (const file of [SOCK, PIDFILE]) try {
			unlinkSync(file);
		} catch {}
		await browserSession.close();
	}
	process.exit(code);
}
function send(socket, event) {
	if (!socket.destroyed) socket.write(`${JSON.stringify(event)}\n`);
}
async function handleRequest(socket, request) {
	if (request.op === "fetch") {
		inflight += 1;
		resetIdleTimer();
		send(socket, {
			id: request.id,
			event: "status",
			stage: "queued"
		});
		try {
			const completion = await handleFetch(request.url, request.downloadDir, () => send(socket, {
				id: request.id,
				event: "status",
				stage: "started",
				budgetSecs: config.challenge.headlessWaitSecs + config.challenge.headedWaitSecs
			}));
			send(socket, {
				id: request.id,
				event: "result",
				op: "fetch",
				...completion,
				notes: pendingNotes.splice(0)
			});
		} catch (error) {
			send(socket, {
				id: request.id,
				event: "error",
				reason: errorMessage(error)
			});
		} finally {
			inflight -= 1;
			resetIdleTimer();
		}
		return;
	}
	if (request.op === "open-browser") {
		try {
			await handleOpenBrowser();
			send(socket, {
				id: request.id,
				event: "result",
				op: "open-browser"
			});
		} catch (error) {
			send(socket, {
				id: request.id,
				event: "error",
				reason: errorMessage(error)
			});
		}
		return;
	}
	const { id, op } = request;
	send(socket, {
		id,
		event: "error",
		reason: `unknown op: ${op}`
	});
}
if (await new Promise((resolve) => {
	const probe = connect(SOCK, () => {
		probe.destroy();
		resolve(true);
	});
	probe.on("error", () => resolve(false));
})) process.exit(0);
try {
	unlinkSync(SOCK);
} catch {}
const HEARTBEAT_INTERVAL_MS = 5e3;
const server = createServer((socket) => {
	const heartbeat = setInterval(() => send(socket, { event: "heartbeat" }), HEARTBEAT_INTERVAL_MS);
	socket.on("close", () => clearInterval(heartbeat));
	createInterface({
		input: socket,
		crlfDelay: Number.POSITIVE_INFINITY
	}).on("line", (line) => {
		let request;
		try {
			request = JSON.parse(line);
		} catch {
			return;
		}
		handleRequest(socket, request);
	});
	socket.on("error", () => {});
});
server.on("error", () => process.exit(0));
server.listen(SOCK, () => {
	writeFileSync(PIDFILE, `${process.pid}\n`);
	resetIdleTimer();
});
process.on("SIGTERM", () => void shutdown(0));
process.on("SIGINT", () => void shutdown(0));
export {};
