import { createFeatureRouter } from '../../shared/types/app.js'
import { mountCreateReservation } from './endpoints/create-reservation.js'
import { mountGetReservation } from './endpoints/get-reservation.js'
import { mountDeleteReservation } from './endpoints/delete-reservation.js'

export const reservationsRouter = createFeatureRouter()

mountCreateReservation(reservationsRouter)
mountGetReservation(reservationsRouter)
mountDeleteReservation(reservationsRouter)
