import { run } from './suite/index';

(async () => {
    try {
        run();
    } catch (err) {
        console.error(err);
    }
})();