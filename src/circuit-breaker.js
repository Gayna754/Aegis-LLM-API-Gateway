export class CircuitBreaker {
  constructor({
    failureThreshold = 3,
    recoveryTimeout = 30000
  } = {}) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;

    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }

  canRequest() {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;

      if (elapsed > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        return true;
      }

      return false;
    }

    return true;
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.failures++;

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
    }
  }

  getState() {
    return this.state;
  }
}