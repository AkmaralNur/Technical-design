import type { Request, Response } from 'express';
import { COOKIE_OPTIONS, signToken } from '../../middleware/authenticate';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.cookie('token', signToken(user), COOKIE_OPTIONS);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const user = await authService.login(req.body);
  res.cookie('token', signToken(user), COOKIE_OPTIONS);
  req.log?.info({ userId: user.id }, 'login');
  res.json(user);
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: undefined });
  res.status(204).end();
}

export async function me(req: Request, res: Response) {
  res.json(await authService.getMe(req.user!.id));
}
