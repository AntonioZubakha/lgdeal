const EventEmitter = require('events');

class SyncQueue extends EventEmitter {
  constructor(maxConcurrent = 2) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          this.running++;
          console.log(`Starting task. Current running: ${this.running}`);
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          console.log(`Task completed. Current running: ${this.running}`);
          this.processNext();
        }
      };

      this.queue.push(wrappedTask);
      this.processNext();
    });
  }

  processNext() {
    if (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      task();
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length
    };
  }
}

// Create a singleton instance
const syncQueue = new SyncQueue(2);

module.exports = syncQueue; 