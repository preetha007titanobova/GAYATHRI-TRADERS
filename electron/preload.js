const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        const validChannels = ['get-machine-id', 'get-license-status', 'save-license', 'app-close-confirmed', 'app-ready'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        const validChannels = [
            'machine-id-response', 
            'license-status-response', 
            'save-license-response',
            'app-close-requested'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
            ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
        }
    }
});
