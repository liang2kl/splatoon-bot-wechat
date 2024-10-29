type ThrottledFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => boolean;

function throttle<T extends (...args: any[]) => any>(func: T, limit: number): ThrottledFunction<T> {
    let lastRan: number | null = null;

    return function (...args: Parameters<T>) {
        const context = this;

        if (lastRan == null || Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
            return true;
        }

        return false;
    };
}

const log = (...args: any[]) => {
    console.log(`[${new Date().toISOString()}]`, ...args);
}

export { throttle, log };