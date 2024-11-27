/**
 * Base car interface.
 */
export interface ICar {
    /**
     * @example
     * type Person = \{ name: string, age: number \};
     * const list: Person[] = [Peter, John, Monique];
     * arraySortBy(list, x => x.name, 'desc')
     */
    start(start: number, end: number): 'winner' | 'looser';
}