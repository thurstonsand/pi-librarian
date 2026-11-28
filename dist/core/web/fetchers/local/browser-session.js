export class BrowserSession {
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
        userAgent: undefined,
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
        }
        catch (error) {
            if (operation.shouldEscalate(error))
                return this.escalatedFetch(operation);
            throw error;
        }
    }
    async openInteractive() {
        if (this.interactiveOpen) {
            throw new Error("interactive browser is already open");
        }
        const headless = this.contextPromise ? await this.contextPromise.catch(() => null) : null;
        this.contextPromise = null;
        await headless?.close().catch(() => { });
        this.setInteractiveOpen(true);
        try {
            const context = await this.options.launcher.launch(false);
            this.interactiveContext = context;
            context.on("close", () => {
                if (this.interactiveContext !== context)
                    return;
                this.interactiveContext = null;
                this.setInteractiveOpen(false);
            });
        }
        catch (error) {
            this.setInteractiveOpen(false);
            throw this.options.interactiveLaunchError(error);
        }
    }
    async close() {
        const headless = this.contextPromise ? await this.contextPromise.catch(() => null) : null;
        this.contextPromise = null;
        await headless?.close().catch(() => { });
        const interactive = this.interactiveContext;
        await interactive?.close().catch(() => { });
        if (this.interactiveContext === interactive) {
            this.interactiveContext = null;
            if (this.interactiveOpen)
                this.setInteractiveOpen(false);
        }
    }
    async headlessFetch(operation) {
        while (this.escalation)
            await this.escalation;
        // Count requests admitted through the gate, including slot waiters, so an
        // escalation cannot close their shared context before they run.
        this.activeHeadlessFetches += 1;
        try {
            this.assertNotInteractive();
            const context = await this.getContext();
            return await this.withPageSlot(async () => {
                operation.onStarted();
                return operation.headless(context);
            });
        }
        finally {
            this.activeHeadlessFetches -= 1;
            if (this.activeHeadlessFetches === 0) {
                for (const wake of this.drainWaiters.splice(0))
                    wake();
            }
        }
    }
    async escalatedFetch(operation) {
        // Escalation recovers the shared profile. A request that waited behind one
        // retries headless before deciding it still needs another visible window.
        while (this.escalation) {
            await this.escalation;
            try {
                return await this.headlessFetch({ ...operation, onStarted: () => { } });
            }
            catch (error) {
                if (!operation.shouldEscalate(error))
                    throw error;
            }
        }
        let release;
        this.escalation = new Promise((resolve) => {
            release = resolve;
        });
        try {
            while (this.activeHeadlessFetches > 0) {
                await new Promise((resolve) => this.drainWaiters.push(resolve));
            }
            this.assertNotInteractive();
            const headless = this.contextPromise ? await this.contextPromise.catch(() => null) : null;
            this.contextPromise = null;
            await headless?.close().catch(() => { });
            let headed;
            try {
                headed = await this.options.launcher.launch(false);
            }
            catch (error) {
                throw this.options.headedLaunchError(error);
            }
            try {
                return await operation.headed(headed);
            }
            finally {
                await headed.close().catch(() => { });
            }
        }
        finally {
            this.escalation = null;
            release();
        }
    }
    async getContext() {
        this.contextPromise ??= this.launchContext();
        try {
            return await this.contextPromise;
        }
        catch (error) {
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
        }
        catch (error) {
            throw this.options.headlessLaunchError(error);
        }
    }
    async launchHeadlessWithNormalUserAgent() {
        // A failed probe keeps the original context and retries after its next
        // launch; a successful probe is cached even when no override is needed.
        if (this.headlessUserAgent.probed) {
            return this.options.launcher.launch(true, this.headlessUserAgent.userAgent);
        }
        const probe = await this.options.launcher.launch(true);
        const userAgent = await this.options.launcher.probeUserAgent(probe);
        if (userAgent === null)
            return probe;
        if (!userAgent.includes("HeadlessChrome")) {
            this.headlessUserAgent = { probed: true, userAgent: undefined };
            return probe;
        }
        await probe.close().catch(() => { });
        this.headlessUserAgent = {
            probed: true,
            userAgent: userAgent.replace("HeadlessChrome", "Chrome"),
        };
        return this.options.launcher.launch(true, this.headlessUserAgent.userAgent);
    }
    async withPageSlot(work) {
        if (this.availableSlots > 0) {
            this.availableSlots -= 1;
        }
        else {
            await new Promise((resolve) => this.slotWaiters.push(resolve));
        }
        try {
            return await work();
        }
        finally {
            const next = this.slotWaiters.shift();
            if (next)
                next();
            else
                this.availableSlots += 1;
        }
    }
    assertNotInteractive() {
        if (this.interactiveOpen)
            throw new Error(this.options.interactiveConflictMessage);
    }
    setInteractiveOpen(open) {
        this.interactiveOpen = open;
        this.options.onInteractiveStateChange?.(open);
    }
}
