import { createFeatureRouter } from '../../shared/types/app.js'
import { mountCreateReservation } from './endpoints/create-reservation.js'
import { mountDeleteReservation } from './endpoints/delete-reservation.js'

export const reservationsRouter = createFeatureRouter()

mountCreateReservation(reservationsRouter)
mountDeleteReservation(reservationsRouter)
