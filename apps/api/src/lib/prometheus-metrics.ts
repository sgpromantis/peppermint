// Prometheus-compatible metrics for Peppermint
// Tracks all system metrics including SMTP, tickets, users, and API performance

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
}

interface CounterMetric {
  name: string;
  help: string;
  type: "counter";
  values: MetricValue[];
}

interface GaugeMetric {
  name: string;
  help: string;
  type: "gauge";
  values: MetricValue[];
}

type Metric = CounterMetric | GaugeMetric;

class PrometheusMetrics {
  // SMTP Metrics
  private emailsSentTotal = 0;
  private emailsFailedTotal = 0;
  private emailsReceivedTotal = 0;
  private emailsSentByType: Record<string, number> = {};
  private lastSmtpError: string | null = null;
  private smtpLatencyMs: number[] = [];

  // Ticket Metrics
  private ticketsCreatedTotal = 0;
  private ticketsClosedTotal = 0;
  private ticketsFromImapTotal = 0;

  // User Metrics
  private loginsTotal = 0;
  private loginsByMethod: Record<string, number> = {};
  private failedLoginsTotal = 0;

  // API Metrics
  private apiRequestsTotal = 0;
  private apiRequestsByEndpoint: Record<string, number> = {};
  private apiErrorsTotal = 0;
  private apiLatencyMs: number[] = [];

  // Webhook Metrics
  private webhooksTriggeredTotal = 0;
  private webhooksFailedTotal = 0;

  // SMTP methods
  incrementEmailsSent(type?: string) {
    this.emailsSentTotal++;
    if (type) {
      this.emailsSentByType[type] = (this.emailsSentByType[type] || 0) + 1;
    }
  }

  incrementEmailsFailed(error?: string) {
    this.emailsFailedTotal++;
    if (error) {
      this.lastSmtpError = error;
    }
  }

  incrementEmailsReceived() {
    this.emailsReceivedTotal++;
  }

  recordSmtpLatency(ms: number) {
    this.smtpLatencyMs.push(ms);
    // Keep only last 1000 samples
    if (this.smtpLatencyMs.length > 1000) {
      this.smtpLatencyMs.shift();
    }
  }

  // Ticket methods
  incrementTicketsCreated(fromImap = false) {
    this.ticketsCreatedTotal++;
    if (fromImap) {
      this.ticketsFromImapTotal++;
    }
  }

  incrementTicketsClosed() {
    this.ticketsClosedTotal++;
  }

  // User methods
  incrementLogins(method = "password") {
    this.loginsTotal++;
    this.loginsByMethod[method] = (this.loginsByMethod[method] || 0) + 1;
  }

  incrementFailedLogins() {
    this.failedLoginsTotal++;
  }

  // API methods
  incrementApiRequests(endpoint?: string) {
    this.apiRequestsTotal++;
    if (endpoint) {
      this.apiRequestsByEndpoint[endpoint] =
        (this.apiRequestsByEndpoint[endpoint] || 0) + 1;
    }
  }

  incrementApiErrors() {
    this.apiErrorsTotal++;
  }

  recordApiLatency(ms: number) {
    this.apiLatencyMs.push(ms);
    if (this.apiLatencyMs.length > 1000) {
      this.apiLatencyMs.shift();
    }
  }

  // Webhook methods
  incrementWebhooksTriggered() {
    this.webhooksTriggeredTotal++;
  }

  incrementWebhooksFailed() {
    this.webhooksFailedTotal++;
  }

  // Calculate average
  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // Calculate percentile
  private calculatePercentile(arr: number[], percentile: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Get metrics in Prometheus format
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // SMTP Metrics
    lines.push("# HELP peppermint_emails_sent_total Total number of emails sent");
    lines.push("# TYPE peppermint_emails_sent_total counter");
    lines.push(`peppermint_emails_sent_total ${this.emailsSentTotal}`);

    lines.push("# HELP peppermint_emails_failed_total Total number of failed email sends");
    lines.push("# TYPE peppermint_emails_failed_total counter");
    lines.push(`peppermint_emails_failed_total ${this.emailsFailedTotal}`);

    lines.push("# HELP peppermint_emails_received_total Total number of emails received via IMAP");
    lines.push("# TYPE peppermint_emails_received_total counter");
    lines.push(`peppermint_emails_received_total ${this.emailsReceivedTotal}`);

    // Emails by type
    lines.push("# HELP peppermint_emails_sent_by_type_total Emails sent by type");
    lines.push("# TYPE peppermint_emails_sent_by_type_total counter");
    for (const [type, count] of Object.entries(this.emailsSentByType)) {
      lines.push(`peppermint_emails_sent_by_type_total{type="${type}"} ${count}`);
    }

    // SMTP Latency
    if (this.smtpLatencyMs.length > 0) {
      lines.push("# HELP peppermint_smtp_latency_ms SMTP send latency in milliseconds");
      lines.push("# TYPE peppermint_smtp_latency_ms gauge");
      lines.push(`peppermint_smtp_latency_avg_ms ${this.calculateAverage(this.smtpLatencyMs).toFixed(2)}`);
      lines.push(`peppermint_smtp_latency_p50_ms ${this.calculatePercentile(this.smtpLatencyMs, 50)}`);
      lines.push(`peppermint_smtp_latency_p95_ms ${this.calculatePercentile(this.smtpLatencyMs, 95)}`);
      lines.push(`peppermint_smtp_latency_p99_ms ${this.calculatePercentile(this.smtpLatencyMs, 99)}`);
    }

    // Ticket Metrics
    lines.push("# HELP peppermint_tickets_created_total Total tickets created");
    lines.push("# TYPE peppermint_tickets_created_total counter");
    lines.push(`peppermint_tickets_created_total ${this.ticketsCreatedTotal}`);

    lines.push("# HELP peppermint_tickets_closed_total Total tickets closed");
    lines.push("# TYPE peppermint_tickets_closed_total counter");
    lines.push(`peppermint_tickets_closed_total ${this.ticketsClosedTotal}`);

    lines.push("# HELP peppermint_tickets_from_imap_total Tickets created from IMAP emails");
    lines.push("# TYPE peppermint_tickets_from_imap_total counter");
    lines.push(`peppermint_tickets_from_imap_total ${this.ticketsFromImapTotal}`);

    // User Metrics
    lines.push("# HELP peppermint_logins_total Total successful logins");
    lines.push("# TYPE peppermint_logins_total counter");
    lines.push(`peppermint_logins_total ${this.loginsTotal}`);

    lines.push("# HELP peppermint_failed_logins_total Total failed login attempts");
    lines.push("# TYPE peppermint_failed_logins_total counter");
    lines.push(`peppermint_failed_logins_total ${this.failedLoginsTotal}`);

    // Logins by method
    lines.push("# HELP peppermint_logins_by_method_total Logins by authentication method");
    lines.push("# TYPE peppermint_logins_by_method_total counter");
    for (const [method, count] of Object.entries(this.loginsByMethod)) {
      lines.push(`peppermint_logins_by_method_total{method="${method}"} ${count}`);
    }

    // API Metrics
    lines.push("# HELP peppermint_api_requests_total Total API requests");
    lines.push("# TYPE peppermint_api_requests_total counter");
    lines.push(`peppermint_api_requests_total ${this.apiRequestsTotal}`);

    lines.push("# HELP peppermint_api_errors_total Total API errors");
    lines.push("# TYPE peppermint_api_errors_total counter");
    lines.push(`peppermint_api_errors_total ${this.apiErrorsTotal}`);

    // API Latency
    if (this.apiLatencyMs.length > 0) {
      lines.push("# HELP peppermint_api_latency_ms API latency in milliseconds");
      lines.push("# TYPE peppermint_api_latency_ms gauge");
      lines.push(`peppermint_api_latency_avg_ms ${this.calculateAverage(this.apiLatencyMs).toFixed(2)}`);
      lines.push(`peppermint_api_latency_p50_ms ${this.calculatePercentile(this.apiLatencyMs, 50)}`);
      lines.push(`peppermint_api_latency_p95_ms ${this.calculatePercentile(this.apiLatencyMs, 95)}`);
      lines.push(`peppermint_api_latency_p99_ms ${this.calculatePercentile(this.apiLatencyMs, 99)}`);
    }

    // Webhook Metrics
    lines.push("# HELP peppermint_webhooks_triggered_total Total webhooks triggered");
    lines.push("# TYPE peppermint_webhooks_triggered_total counter");
    lines.push(`peppermint_webhooks_triggered_total ${this.webhooksTriggeredTotal}`);

    lines.push("# HELP peppermint_webhooks_failed_total Total failed webhooks");
    lines.push("# TYPE peppermint_webhooks_failed_total counter");
    lines.push(`peppermint_webhooks_failed_total ${this.webhooksFailedTotal}`);

    return lines.join("\n");
  }

  // Get JSON metrics for internal use
  getJsonMetrics() {
    return {
      smtp: {
        sent: this.emailsSentTotal,
        failed: this.emailsFailedTotal,
        received: this.emailsReceivedTotal,
        sentByType: this.emailsSentByType,
        lastError: this.lastSmtpError,
        latency: {
          avg: this.calculateAverage(this.smtpLatencyMs),
          p50: this.calculatePercentile(this.smtpLatencyMs, 50),
          p95: this.calculatePercentile(this.smtpLatencyMs, 95),
          p99: this.calculatePercentile(this.smtpLatencyMs, 99),
        },
      },
      tickets: {
        created: this.ticketsCreatedTotal,
        closed: this.ticketsClosedTotal,
        fromImap: this.ticketsFromImapTotal,
      },
      users: {
        logins: this.loginsTotal,
        loginsByMethod: this.loginsByMethod,
        failedLogins: this.failedLoginsTotal,
      },
      api: {
        requests: this.apiRequestsTotal,
        errors: this.apiErrorsTotal,
        latency: {
          avg: this.calculateAverage(this.apiLatencyMs),
          p50: this.calculatePercentile(this.apiLatencyMs, 50),
          p95: this.calculatePercentile(this.apiLatencyMs, 95),
          p99: this.calculatePercentile(this.apiLatencyMs, 99),
        },
      },
      webhooks: {
        triggered: this.webhooksTriggeredTotal,
        failed: this.webhooksFailedTotal,
      },
    };
  }
}

// Export singleton instance
export const metrics = new PrometheusMetrics();
