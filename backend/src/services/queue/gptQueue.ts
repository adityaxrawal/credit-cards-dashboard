import { EventEmitter } from 'events';

export class GptQueue extends EventEmitter {
    private queue: any[] = [];
    private BATCH_SIZE = 40;

    constructor() {
        super();
    }

    enqueue(item: any) {
        this.queue.push(item);
        if (this.queue.length >= this.BATCH_SIZE) {
            this.emit('batch_ready', this.dequeueBatch());
        }
    }

    dequeueBatch(): any[] {
        return this.queue.splice(0, this.BATCH_SIZE);
    }

    flush() {
        if (this.queue.length > 0) {
            this.emit('batch_ready', this.dequeueBatch());
        }
    }

    get length() {
        return this.queue.length;
    }
}

export const gptQueue = new GptQueue();
