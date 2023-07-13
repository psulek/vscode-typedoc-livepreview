// testcase: access|10-11
// testcase: accessHas|12-15
// testcase: accessGet|16-22


interface IntA<
    This = unknown,
    Value extends (this: This, ...args: any) => any = (this: This, ...args: any) => any,
> {
    /** An object that can be used to access the current value of the class element at runtime. */
    readonly access: {
        /**
         * Determines whether an object has a property with the same name as the decorated element.
         */
        has(object: This): boolean;
        /**
         * Gets the current value of the method from the provided object.
         *
         * @example
         * let fn = context.access.get(instance);
         */
        get(object: This): Value;
    };
}