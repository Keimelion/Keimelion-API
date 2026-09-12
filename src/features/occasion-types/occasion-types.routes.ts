import { Hono } from 'hono'
import { mountListOccasionTypes } from './endpoints/list.js'

export const occasionTypesRouter = new Hono()
mountListOccasionTypes(occasionTypesRouter)
