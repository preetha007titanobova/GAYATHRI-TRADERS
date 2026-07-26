class PrintQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    addToQueue(taskFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFn, resolve, reject });
            this.processNext();
        });
    }

    async processNext() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const { taskFn, resolve, reject } = this.queue.shift();

        try {
            const result = await taskFn();
            resolve(result);
        } catch (err) {
            console.error('Print queue task failed:', err.message);
            reject(err);
        } finally {
            this.isProcessing = false;
            // Introduce a small delay between prints to allow spooler to breathe
            setTimeout(() => {
                this.processNext();
            }, 500);
        }
    }
}

const printQueue = new PrintQueue();

module.exports = printQueue;
