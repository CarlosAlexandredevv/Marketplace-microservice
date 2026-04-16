# observability-stack/README.md

# 📈 Observability Stack (Prometheus + Grafana)

Stack de observabilidade do `marketplace-ms` usando **Prometheus** (coleta de métricas) e **Grafana** (visualização).

## 🚀 Como usar

### Subir Prometheus + Grafana

```bash
docker-compose up -d
```

### Acessos

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3010` (usuário `admin`, senha `admin`)

> O Grafana já inicia com o datasource **Prometheus** provisionado automaticamente.

### Parar e remover volumes

```bash
docker-compose down -v
```

