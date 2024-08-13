import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import jwt from 'jsonwebtoken'

import { start } from '@core/init'
import dao from 'dao'
import config from 'config'

import auth from 'controller/auth'

start()

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath('/api')
app.route('/auth', auth)
