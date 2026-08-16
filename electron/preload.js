const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, ...args) => {
        const validChannels = [
            'get-machine-id', 
            'get-license-status', 
            'save-license', 
            'revoke-license',
            'get-printer-status',
            'detect-printers',
            'set-active-printer',
            'print-html',
            'print-tspl-raw',
            'print-receipt',
            'print-escpos',
            'get-printers',
            'app-close-confirmed'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        }
    },
    receive: (channel, func) => {
        const validChannels = [
            'machine-id-response', 
            'license-status-response', 
            'save-license-response',
            'revoke-license-response',
            'printer-status-response',
            'detect-printers-response',
            'save-printer-response',
            'print-response',
            'print-escpos-response',
            'print-receipt-response',
            'get-printers-response',
            'app-close-requested'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
        }
    }
});
