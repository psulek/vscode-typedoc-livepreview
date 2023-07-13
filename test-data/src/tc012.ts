// testcase: animal|4-7
// testcase: name|11-14
// testcase: dog|17-20
// testcase: size|21-24


/**
 * Animal interface
 */
interface Animal {
    /**
     * Name of animal
     */
    readonly name: string;
}

/**
 * Dog interface
 */
interface Dog extends Animal {
    /**
     * Size of dog
     */
    readonly size: number;
}