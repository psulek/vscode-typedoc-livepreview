export type ExtensionConfig = {
    hideEmptySignatures: boolean;
};

export enum EmptySignaturesTypes {
    hide = 'hide',
    show = 'show'
}

export type PostMessage = {
    command: 'update';
    file: string;
    line: number;
    isEmpty: boolean;
    isUntitled: boolean;
};