type ThrottledFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => void;

function throttle<T extends (...args: any[]) => any>(func: T, limit: number): ThrottledFunction<T> {
    let lastFunc: NodeJS.Timeout;
    let lastRan: number;

    return function (...args: Parameters<T>) {
        const context = this;

        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

export { throttle };