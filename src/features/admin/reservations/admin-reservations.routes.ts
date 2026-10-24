import { createFeatureRouter } from '../../../shared/types/app.js'
import { mountListReservations } from './endpoints/list.js'
import { mountGetReservation } from './endpoints/get.js'
import { mountDeleteReservation } from './endpoints/delete.js'

export const adminReservationsRouter = createFeatureRouter()

mountListReservations(adminReservationsRouter)
mountGetReservation(adminReservationsRouter)
mountDeleteReservation(adminReservationsRouter)
