import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    static init(channel: vscode.OutputChannel) {
        Logger.outputChannel = channel;
    }

    static log(message: string) {
        if (Logger.outputChannel) {
            const timestamp = new Date().toISOString();
            Logger.outputChannel.appendLine(`[${timestamp}]: ${message}`);
        }
    }

    static error(message: string) {
        Logger.log(`ERROR: ${message}`);
    }

    static warn(message: string) {
        Logger.log(`WARN: ${message}`);
    }

    static debug(message: string) {
        Logger.log(`DEBUG: ${message}`);
    }
}