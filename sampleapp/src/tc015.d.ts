// testcase: namespace|7-10
// testcase: version|11-14
// testcase: interface|16-20
// testcase: save|21-26


/**
 * Dummy Type Definition
 */
declare module 'dummy' {
	/**
	 * The version of dummy.
	 */
	export const version: string;

    /**
     * This is the dummiest interface.
     * @see {@link Map<string,number>}
     */
    export interface IDummy {
        /**
         * Save dummy into file.
         * @param file file name where to save dummy
         * @returns a boolean flag whenever saving file was successful (`true`) or not (`false`)
         */
        save(file: string): Promise<boolean>;
    }
}