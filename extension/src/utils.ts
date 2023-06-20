export const debounce = (func: Function, ms: number): Function => {
    let timeout: NodeJS.Timeout | null;

    return function wrapper(this: Function, ...args: any[]) {
        const context = this;

        var later = () => {
            timeout = null;
            func.apply(context, args);
        };

        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, ms);
    };
};

export const throttle = (func: Function, ms: number): Function => {

    let isThrottled = false;
    let savedArgs: any[] | null;
    let savedThis: Function | null;

    function wrapper(this: Function, ...args: any[]) {

        if (isThrottled) {
            savedArgs = args;
            savedThis = this;
            return;
        }

        func.apply(this, args);

        isThrottled = true;

        setTimeout(function () {
            isThrottled = false;
            if (savedArgs && savedThis) {
                wrapper.apply(savedThis, [...savedArgs]);
                savedArgs = savedThis = null;
            }
        }, ms);
    }

    return wrapper;
};
