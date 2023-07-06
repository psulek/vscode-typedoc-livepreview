export type ExtensionConfig = {
    hideEmptySignatures: boolean;
    logging?: boolean;
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