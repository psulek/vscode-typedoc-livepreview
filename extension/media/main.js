(function () {
    const element = document.querySelectorAll('a[name]');

    element.forEach(el => {
        el.setAttribute('id', el.getAttribute('name'));
    });

    hljs.highlightAll();

    const vscode = acquireVsCodeApi();

    let message = {
        command: 'update',
        file: '',
        line: 1,
        isEmpty: false,
        isUntitled: false
    };
    

    const header = /** @type {HTMLElement} */ (document.getElementsByTagName('header')[0]);
    const btnReload = /** @type {HTMLElement} */ (document.getElementById('btnReload'));
    btnReload.addEventListener('click', () => {
        vscode.postMessage({
            command: 'reload',
            file: message.file,
            line: message.line,
            isUntitled: message.isUntitled
        });
    });

    window.addEventListener('message', event => {
        message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'update': {
                const css = (message.file && message.file.length > 0) && !message.isEmpty ? 'display-flex' : 'display-none';
                header.classList.length = 0;
                header.classList.add(css);
                break;
            }
        }
    });
}());