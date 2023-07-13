// testcase: typeAlias|5-11
// testcase: typeExtends|14-22
// testcase: typePropKind|24-25

/**
 * The type of number or string.
 */
type TypeNumberOrString = 
    |number 
    |string
    ;
const a= 132;

/**
 * Context provided to a class decorator.
 * @template T The type of the decorated class associated with this context
 * is super awesome.
 * @template U this is U ;-)
 */
interface CustomType<
    T extends number,
    U
> {
    /** The kind of element that was decorated. */
    readonly kind: "class"

    readonly value: T;
}