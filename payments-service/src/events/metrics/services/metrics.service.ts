import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

export interface ConsumerMetrics {
  totalProcessed: number; // Total de mensagens processadas
  totalSuccess: number; // Mensagens processadas com sucesso
  totalFailed: number; // Mensagens que falharam
  totalRetries: number; // Total de tentativas de retry
  lastProcessedAt: Date | null; // Timestamp do último processamento
  startedAt: Date; // Quando o consumer iniciou
  averageProcessingTime: number; // Tempo médio de processamento em ms
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  /**
   * ============================================
   * MÉTRICAS DE MONITORAMENTO
   * ============================================
   * Armazena estatísticas de processamento em memória
   * Em produção, usaríamos Prometheus, DataDog, etc.
   */

  metrics: ConsumerMetrics = {
    totalProcessed: 0,
    totalSuccess: 0,
    totalFailed: 0,
    totalRetries: 0,
    lastProcessedAt: null,
    startedAt: new Date(),
    averageProcessingTime: 0,
  };

  /**
   * Acumulador para calcular tempo médio de processamento
   * Guardamos a soma total para não precisar armazenar todos os tempos
   */
  totalProcessingTime = 0;

  updateMetrics(success: boolean, startTime: number): void {
    // Calcula o tempo de processamento desta mensagem
    const processingTime = Date.now() - startTime;

    // Incrementa contadores
    this.metrics.totalProcessed++;
    this.metrics.lastProcessedAt = new Date();

    if (success) {
      this.metrics.totalSuccess++;
    } else {
      this.metrics.totalFailed++;
    }

    // Atualiza tempo médio de processamento
    this.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime = Math.round(
      this.totalProcessingTime / this.metrics.totalProcessed,
    );

    // Log de métricas a cada 10 mensagens (ou 100 em produção)

    if (this.metrics.totalProcessed % 10 === 0) {
      this.logMetricsSummary();
    }
  }

  incrementRetryCount(): void {
    this.metrics.totalRetries++;
  }

  logMetricsSummary(): void {
    const successRate =
      this.metrics.totalProcessed > 0
        ? (
            (this.metrics.totalSuccess / this.metrics.totalProcessed) *
            100
          ).toFixed(2)
        : '0';

    this.logger.log('📊 ====== CONSUMER METRICS ======');
    this.logger.log(`.   Total Processed: ${this.metrics.totalProcessed}`);
    this.logger.log(`.   Success: ${this.metrics.totalSuccess}`);
    this.logger.log(`.   Failed: ${this.metrics.totalFailed}`);
    this.logger.log(`.   Retries: ${this.metrics.totalRetries}`);
    this.logger.log(`.   Success Rate: ${successRate}%`);
    this.logger.log(
      `.   Avg Processing Time: ${this.metrics.averageProcessingTime}ms`,
    );
    this.logger.log('📊 ================================');
  }

  getMetrics(): ConsumerMetrics {
    // Retorna cópia para evitar modificação externa
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalRetries: 0,
      lastProcessedAt: null,
      startedAt: new Date(),
      averageProcessingTime: 0,
    };
    this.totalProcessingTime = 0;

    this.logger.log('🔄 Metrics reset');
  }
}
