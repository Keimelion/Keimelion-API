import { logger } from '../../shared/utils/logger.js'
import { refreshFxRates } from './fx-rates-refresh.js'

try {
  const updatedCount = await refreshFxRates()
  logger.info({ updatedCount }, 'FX rates refresh CLI completed')
  process.exit(0)
} catch (error) {
  logger.error({ error }, 'FX rates refresh CLI failed')
  process.exit(1)
}
