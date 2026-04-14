export const DELETION_REASON_VALUES = ['soft_delete_grace', 'inactive_24mo'] as const
export type DeletionReason = (typeof DELETION_REASON_VALUES)[number]
