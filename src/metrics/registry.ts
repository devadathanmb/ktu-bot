import { Registry, collectDefaultMetrics } from "prom-client";

export function createMetricsRegistry(
  serviceName: string,
  options: {
    enableDefaultMetrics?: boolean;
    prefix?: string;
  } = {}
): Registry {
  const { enableDefaultMetrics = true, prefix } = options;

  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });

  if (enableDefaultMetrics) {
    collectDefaultMetrics({
      register: registry,
      ...(prefix && { prefix }),
    });
  }

  return registry;
}
