import { ErrorCode, HttpStatus, WaitlistSignupStatuses } from '@keimelion/sdk/enums'
import type {
  WaitlistCreateRequestParsed,
  WaitlistCreateResponseParsed,
} from '@keimelion/sdk/schemas'
import { logger } from '../../shared/utils/logger.js'
import { serviceError } from '../../shared/utils/response.js'
import { insertWaitlistEntryIfAbsent } from './waitlist.repository.js'
import type { ServiceResult } from '../../shared/types/service.js'

const HONEYPOT_HIT_EVENT = 'waitlist_honeypot_hit'

export async function createWaitlistEntry(
  input: WaitlistCreateRequestParsed,
  ip: string,
): Promise<ServiceResult<WaitlistCreateResponseParsed>> {
  if (isHoneypotFilled(input)) {
    logger.info({ event: HONEYPOT_HIT_EVENT, ip })
    return serviceError(ErrorCode.WAITLIST_HONEYPOT_TRIGGERED)
  }

  const isNewEntry = await insertWaitlistEntryIfAbsent(input.email, input.locale)
  if (!isNewEntry) {
    return {
      data: { status: WaitlistSignupStatuses.ALREADY_SUBSCRIBED },
      httpStatus: HttpStatus.OK,
    }
  }

  return { data: { status: WaitlistSignupStatuses.SUBSCRIBED }, httpStatus: HttpStatus.CREATED }
}

function isHoneypotFilled(input: WaitlistCreateRequestParsed): boolean {
  return (input.honeypot ?? '').length > 0
}
