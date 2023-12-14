export class Beacon {
  private serverUrl: string;
  private errorQueue: Error[];
  private timer: NodeJS.Timer | null;
  private readonly throttleTime: number = 5000; // 5 seconds
  private quotaReached: boolean = false;
  private publicKey: string;
  private browserInfo: { name: string; version: string };

  constructor(serverUrl: string, publicKey: string) {
    this.serverUrl = serverUrl;
    this.publicKey = publicKey;
    this.errorQueue = [];
    this.timer = null;
    this.browserInfo = this.getBrowserInfo();
    this.initializeGlobalErrorHandler();
  }

  private getBrowserInfo(): { name: string; version: string } {
    // Implement browser detection logic here
    return { name: 'BrowserName', version: 'BrowserVersion' };
  }

  private initializeGlobalErrorHandler(): void {
    process.on('uncaughtException', (error: Error) => {
      this.queueError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.queueError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`));
    });
  }

  private queueError(error: Error): void {
    if (this.quotaReached) return;

    this.errorQueue.push(error);
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.sendErrorsToServer();
        this.timer = null;
      }, this.throttleTime);
    }
  }

  private async sendErrorsToServer(): Promise<void> {
    if (this.errorQueue.length === 0 || this.quotaReached) return;

    try {
      const errorsToSend = this.errorQueue.map((error) => ({
        errorMessage: error.message,
        stack: error.stack,
        browser: this.browserInfo,
      }));

      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.publicKey}`, // Assuming the public key is used as a bearer token
        },
        body: JSON.stringify({ errors: errorsToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.quotaReached) {
        this.quotaReached = true;
        console.log('Error quota reached, no more errors will be sent.');
      }

      this.errorQueue = [];
      console.log('Errors sent to server:', errorsToSend.length);
    } catch (networkError) {
      console.error('Failed to send errors to server:', networkError);
    }
  }
}
