// testcase: MyEventTarget|11-14
// testcase: addEventListener|15-21
// testcase: dispatchEvent|22-25
// testcase: removeEventListener|26-29


interface MyEventTargetReadonly {
    readonlyFunc(): void;
}

/**
 * MyEventTarget is a DOM interface implemented by objects that can receive events and may have listeners for them.
 */
interface MyEventTarget extends MyEventTargetReadonly {
    /**
     * addEventListener doc
     * @param type 
     * @param callback 
     * @param options 
     */
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    /**
     * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
     */
    dispatchEvent(event: Event): boolean;
    /**
     * Removes the event listener in target's event listener list with the same type, callback, and options.
     */
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

declare var MyEventTarget: {
    prototype: MyEventTarget;
    fromFloat32Array(array32: Float32Array): MyEventTarget;
    new(): MyEventTarget;
};

declare var MyEventTargetReadonly: {
    prototype: MyEventTargetReadonly;
    fromFloat32Array(array32: Float32Array): MyEventTargetReadonly;
    new(): MyEventTargetReadonly;
};


type MyEventTargetExtra = MyEventTarget;
declare var MyEventTargetExtra: typeof MyEventTarget;
