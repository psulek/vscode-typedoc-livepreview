// testcase: class|8-11
// testcase: run|13-19
// testcase: close|21-26
// testcase: vara|29-30

import { IDummy } from './tc005';

/**
 * Console logger2 `implementation`.
 */
class ConsoleLogger2 implements IDummy {

    /**
     * Just run
     * @returns 123 number
     */
    public run(): number {
        return 123;
    }

    /**
     * close it
     */
    public close(): void {
        // close something
    }
}

/** this is const A! */ 
const a = 123;
console.log(a);