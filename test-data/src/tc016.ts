import { ICar } from './tc016b';

/**
 * {@inheritDoc ICar}
 */
export class Car implements ICar {
    /** {@inheritDoc ICar.start } */
    start(start: number, end: number): 'winner' | 'looser' {
        throw new Error('Method not implemented.');
    }
}