import { Registry, collectDefaultMetrics } from "prom-client";

/**
 * Creates a Prometheus metrics registry with default configuration
 * Follows the existing config pattern used throughout the codebase
 *
 * @param serviceName - Name of the service (used as default label)
 * @param options - Optional configuration
 * @returns Configured Prometheus Registry
 */
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
