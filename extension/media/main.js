(function () {
    const element = document.querySelectorAll('a[name]');

    element.forEach(el => {
        el.setAttribute('id', el.getAttribute('name'));
    });

    hljs.highlightAll();

    const vscode = acquireVsCodeApi();

    const current = {
        file: '',
        line: 1
    };

    const btnReload = /** @type {HTMLElement} */ (document.getElementById('btnReload'));
    btnReload.addEventListener('click', () => {
        vscode.postMessage({
            command: 'reload',
            file: current.file,
            line: current.line
        });
    });

    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'update': {
                current.file = message.file;
                current.line = message.line;
                break;
            }
        }
    });
}());